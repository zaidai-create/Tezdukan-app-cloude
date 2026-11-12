-- When something in an order is not on the shelf. The customer says at checkout what they want
-- (call me, send something similar, or just remove it); the dukandar removes the line or
-- replaces it with a similar product at the same price or less, and the order's total follows.
-- The line as it was is kept in customer_order_changes, so the customer sees what changed and
-- every report, stock movement and "Buy again" keeps reading only what is really in the order.

create type public.unavailable_choice as enum ('call_me', 'replace', 'remove');
create type public.order_change_kind as enum ('removed', 'replaced');

alter table public.customer_orders
  add column if_unavailable public.unavailable_choice not null default 'call_me';
comment on column public.customer_orders.if_unavailable is
  'What the customer wants when an item is not available: call_me, replace (similar item, same price or less) or remove.';

create table public.customer_order_changes (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  customer_id uuid references public.profiles (id) on delete set null,
  kind public.order_change_kind not null,
  item_name text not null,
  item_name_ur text,
  qty numeric(12, 3) not null check (qty > 0),
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  line_total_paisa bigint not null check (line_total_paisa >= 0),
  new_name text,
  new_name_ur text,
  new_unit_price_paisa bigint check (new_unit_price_paisa >= 0),
  new_line_total_paisa bigint check (new_line_total_paisa >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((kind = 'replaced') = (new_name is not null))
);
comment on table public.customer_order_changes is
  'Lines a dukan removed or replaced in a customer order, as they were. Written only by remove_order_item / replace_order_item.';
create index customer_order_changes_customer_order_id_idx on public.customer_order_changes (customer_order_id);
create index customer_order_changes_shop_id_idx on public.customer_order_changes (shop_id);
create index customer_order_changes_customer_id_idx on public.customer_order_changes (customer_id);
create index customer_order_changes_created_by_idx on public.customer_order_changes (created_by);

create trigger set_row_metadata before insert or update on public.customer_order_changes
  for each row execute function private.set_row_metadata();

alter table public.customer_order_changes enable row level security;
create policy customer_order_changes_select on public.customer_order_changes for select to authenticated
  using (
    customer_id = (select auth.uid())
    or shop_id in (select private.shop_ids_with_permission('customer_orders'))
    or (select private.is_platform_staff())
  );
grant select on public.customer_order_changes to authenticated;
grant all on public.customer_order_changes to service_role;

-- ---------------------------------------------------------------------------------------------
-- Placing an order with the choice. The five-argument version stays for older app builds; this
-- one takes the choice as a required sixth argument, so a call always matches exactly one.
-- ---------------------------------------------------------------------------------------------
create or replace function public.place_customer_order(
  p_shop_id uuid,
  p_items jsonb,
  p_address_id uuid,
  p_note text,
  p_request_id uuid,
  p_if_unavailable public.unavailable_choice
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_placed jsonb;
begin
  v_placed := public.place_customer_order(p_shop_id, p_items, p_address_id, p_note, p_request_id);
  update public.customer_orders
     set if_unavailable = coalesce(p_if_unavailable, 'call_me')
   where id = (v_placed ->> 'id')::uuid and customer_id = (select auth.uid()) and status = 'placed';
  return v_placed;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Changing lines. Only the dukan's people with the customer-orders permission, only before the
-- order is on its way, and never the last line (an order with nothing left is rejected instead).
-- ---------------------------------------------------------------------------------------------
create or replace function private.recount_customer_order(p_order_id uuid)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.customer_orders%rowtype;
begin
  update public.customer_orders o
     set subtotal_paisa = x.subtotal,
         items_count = x.items,
         -- The delivery fee stays as agreed: a missing item never makes delivery dearer.
         total_paisa = x.subtotal - o.discount_paisa + o.delivery_fee_paisa
    from (
      select coalesce(sum(line_total_paisa), 0) as subtotal, coalesce(ceil(sum(qty)), 0)::integer as items
        from public.customer_order_items
       where customer_order_id = p_order_id
    ) x
   where o.id = p_order_id
  returning o.* into v_order;
  return v_order;
end;
$$;

create or replace function private.lock_changeable_line(p_item_id uuid)
returns public.customer_order_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.customer_order_items%rowtype;
  v_order public.customer_orders%rowtype;
begin
  perform private.require_user();
  select * into v_item from public.customer_order_items where id = p_item_id;
  if v_item.id is null then
    raise exception 'item_not_found' using errcode = 'P0002';
  end if;
  if not private.has_shop_permission(v_item.shop_id, 'customer_orders') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into v_order from public.customer_orders
   where id = v_item.customer_order_id and deleted_at is null for update;
  if v_order.status not in ('placed', 'accepted', 'packed') then
    raise exception 'invalid_transition' using errcode = '55000';
  end if;
  return v_item;
end;
$$;

create or replace function public.remove_order_item(p_item_id uuid)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.customer_order_items%rowtype := private.lock_changeable_line(p_item_id);
  v_order public.customer_orders%rowtype;
begin
  if (select count(*) from public.customer_order_items where customer_order_id = v_item.customer_order_id) <= 1 then
    raise exception 'last_item' using errcode = '55000';
  end if;
  insert into public.customer_order_changes (
    customer_order_id, shop_id, customer_id, kind, item_name, item_name_ur, qty, unit_price_paisa, line_total_paisa
  )
  values (
    v_item.customer_order_id, v_item.shop_id, v_item.customer_id, 'removed', v_item.name, v_item.name_ur,
    v_item.qty, v_item.unit_price_paisa, v_item.line_total_paisa
  );
  delete from public.customer_order_items where id = v_item.id;
  v_order := private.recount_customer_order(v_item.customer_order_id);

  perform private.audit(
    'customer_order.item_removed', 'customer_order', v_order.id, null, v_order.shop_id,
    jsonb_build_object('item', v_item.name, 'line_total_paisa', v_item.line_total_paisa),
    jsonb_build_object('total_paisa', v_order.total_paisa)
  );
  if v_order.customer_id is not null then
    perform private.notify(
      v_order.customer_id, 'order',
      format('%s was not available', v_item.name),
      format('Removed from order %s. New total Rs %s', v_order.order_number, v_order.total_paisa / 100),
      jsonb_build_object('event', 'customer_order.item_removed', 'customer_order_id', v_order.id,
                         'order_number', v_order.order_number, 'item', v_item.name),
      '/orders/' || v_order.id
    );
  end if;
  return v_order;
end;
$$;

-- Products of the same dukan that could stand in for a line: the same kind of thing (same
-- category; a line without one has no stand-in), in stock, at the same price or less.
create or replace function public.order_item_replacements(p_item_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_item public.customer_order_items%rowtype;
  v_category uuid;
begin
  perform private.require_user();
  select * into v_item from public.customer_order_items where id = p_item_id;
  if v_item.id is null or not private.has_shop_permission(v_item.shop_id, 'customer_orders') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select i.category_id into v_category from public.shop_inventory i where i.id = v_item.inventory_id;
  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.same_category desc, x.selling_price_paisa desc, x.name), '[]'::jsonb)
      from (
        select i.id, i.name, i.name_ur, i.pack_size_label, i.selling_price_paisa, i.qty_on_hand,
               coalesce(i.image_path, mp.image_path) as image_path,
               coalesce(i.category_id = v_category, false) as same_category
          from public.shop_inventory i
          left join public.master_products mp on mp.id = i.master_product_id
         where i.shop_id = v_item.shop_id
           and i.is_active
           and i.id is distinct from v_item.inventory_id
           and i.qty_on_hand >= v_item.qty
           and i.selling_price_paisa <= v_item.unit_price_paisa
           and i.category_id = v_category
         order by coalesce(i.category_id = v_category, false) desc, i.selling_price_paisa desc, i.name
         limit 30
      ) x
  );
end;
$$;

create or replace function public.replace_order_item(p_item_id uuid, p_inventory_id uuid)
returns public.customer_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.customer_order_items%rowtype := private.lock_changeable_line(p_item_id);
  v_new public.shop_inventory%rowtype;
  v_image text;
  v_order public.customer_orders%rowtype;
begin
  select * into v_order from public.customer_orders where id = v_item.customer_order_id;
  if v_order.if_unavailable = 'remove' then
    raise exception 'customer_wants_removal' using errcode = '55000';
  end if;
  select * into v_new from public.shop_inventory
   where id = p_inventory_id and shop_id = v_item.shop_id and is_active;
  if v_new.id is null or v_new.id = v_item.inventory_id then
    raise exception 'item_unavailable' using errcode = '55000';
  end if;
  if v_new.qty_on_hand < v_item.qty then
    raise exception 'out_of_stock' using errcode = '55000', detail = v_new.name;
  end if;
  if v_new.selling_price_paisa > v_item.unit_price_paisa then
    raise exception 'replacement_costs_more' using errcode = '55000';
  end if;
  select coalesce(v_new.image_path, mp.image_path) into v_image
    from public.master_products mp where mp.id = v_new.master_product_id;

  insert into public.customer_order_changes (
    customer_order_id, shop_id, customer_id, kind, item_name, item_name_ur, qty, unit_price_paisa,
    line_total_paisa, new_name, new_name_ur, new_unit_price_paisa, new_line_total_paisa
  )
  values (
    v_item.customer_order_id, v_item.shop_id, v_item.customer_id, 'replaced', v_item.name, v_item.name_ur,
    v_item.qty, v_item.unit_price_paisa, v_item.line_total_paisa, v_new.name, v_new.name_ur,
    v_new.selling_price_paisa, round(v_item.qty * v_new.selling_price_paisa)
  );
  update public.customer_order_items
     set inventory_id = v_new.id,
         name = v_new.name,
         name_ur = v_new.name_ur,
         image_path = coalesce(v_image, v_new.image_path),
         unit = v_new.unit,
         unit_price_paisa = v_new.selling_price_paisa,
         mrp_paisa = v_new.mrp_paisa,
         line_total_paisa = round(v_item.qty * v_new.selling_price_paisa)
   where id = v_item.id;
  v_order := private.recount_customer_order(v_item.customer_order_id);

  perform private.audit(
    'customer_order.item_replaced', 'customer_order', v_order.id, null, v_order.shop_id,
    jsonb_build_object('item', v_item.name, 'unit_price_paisa', v_item.unit_price_paisa),
    jsonb_build_object('item', v_new.name, 'unit_price_paisa', v_new.selling_price_paisa, 'total_paisa', v_order.total_paisa)
  );
  if v_order.customer_id is not null then
    perform private.notify(
      v_order.customer_id, 'order',
      format('%s replaced with %s', v_item.name, v_new.name),
      format('Order %s. New total Rs %s', v_order.order_number, v_order.total_paisa / 100),
      jsonb_build_object('event', 'customer_order.item_replaced', 'customer_order_id', v_order.id,
                         'order_number', v_order.order_number, 'item', v_item.name, 'new_item', v_new.name),
      '/orders/' || v_order.id
    );
  end if;
  return v_order;
end;
$$;

revoke execute on function public.place_customer_order(uuid, jsonb, uuid, text, uuid, public.unavailable_choice) from public, anon;
revoke execute on function public.remove_order_item(uuid) from public, anon;
revoke execute on function public.replace_order_item(uuid, uuid) from public, anon;
revoke execute on function public.order_item_replacements(uuid) from public, anon;
revoke execute on function private.recount_customer_order(uuid) from public, anon;
revoke execute on function private.lock_changeable_line(uuid) from public, anon;
grant execute on function public.place_customer_order(uuid, jsonb, uuid, text, uuid, public.unavailable_choice) to authenticated;
grant execute on function public.remove_order_item(uuid) to authenticated;
grant execute on function public.replace_order_item(uuid, uuid) to authenticated;
grant execute on function public.order_item_replacements(uuid) to authenticated;
grant execute on function private.recount_customer_order(uuid) to authenticated, service_role;
grant execute on function private.lock_changeable_line(uuid) to authenticated, service_role;
