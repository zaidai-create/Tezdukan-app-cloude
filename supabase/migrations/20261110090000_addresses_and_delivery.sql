-- Delivery addresses done properly. A customer keeps up to five addresses, each with a map pin;
-- the chosen one decides which dukans they see, and an order carries that address (pin
-- included) so the dukan and the rider can open it on a map. The database refuses an order to
-- an address outside the dukan's delivery radius. Dukandars may now deliver up to 6 km.

-- ---------------------------------------------------------------------------------------------
-- Addresses: a cap, and exactly one default per person.
-- ---------------------------------------------------------------------------------------------
create or replace function private.tg_addresses_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.addresses a where a.user_id = new.user_id) >= 5 then
      raise exception 'too_many_addresses' using errcode = '54000';
    end if;
    -- The first address is the default without being asked.
    if not exists (select 1 from public.addresses a where a.user_id = new.user_id) then
      new.is_default := true;
    end if;
  end if;
  -- A new default replaces the old one (one default per person is a unique index).
  if new.is_default and (tg_op = 'INSERT' or not old.is_default) then
    update public.addresses
       set is_default = false
     where user_id = new.user_id and is_default and id <> new.id;
  end if;
  return new;
end;
$$;

create or replace function private.tg_addresses_promote_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Deleting the default hands it to the address used most recently.
  if old.is_default then
    update public.addresses
       set is_default = true
     where id = (
       select a.id from public.addresses a
        where a.user_id = old.user_id
        order by a.updated_at desc
        limit 1
     );
  end if;
  return null;
end;
$$;

revoke execute on function private.tg_addresses_guard() from public, anon;
revoke execute on function private.tg_addresses_promote_default() from public, anon;
grant execute on function private.tg_addresses_guard() to authenticated, service_role;
grant execute on function private.tg_addresses_promote_default() to authenticated, service_role;

create trigger addresses_guard
  before insert or update of is_default on public.addresses
  for each row execute function private.tg_addresses_guard();
create trigger addresses_promote_default
  after delete on public.addresses
  for each row execute function private.tg_addresses_promote_default();

-- ---------------------------------------------------------------------------------------------
-- Orders go to a saved address. The text typed by hand is gone: the address row gives the
-- words and the pin, and the pin must be inside the dukan's delivery radius.
-- ---------------------------------------------------------------------------------------------
drop function if exists public.place_customer_order(uuid, jsonb, text, text, uuid);
create function public.place_customer_order(
  p_shop_id uuid,
  p_items jsonb,
  p_address_id uuid,
  p_note text default null,
  p_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_profile public.profiles%rowtype;
  v_shop public.shops%rowtype;
  v_settings public.storefront_settings%rowtype;
  v_address public.addresses%rowtype;
  v_existing public.customer_orders%rowtype;
  v_line jsonb;
  v_item public.shop_inventory%rowtype;
  v_qty integer;
  v_subtotal bigint := 0;
  v_count integer := 0;
  v_fee bigint;
  v_order public.customer_orders%rowtype;
begin
  if p_request_id is not null then
    select * into v_existing from public.customer_orders
     where client_request_id = p_request_id and customer_id = v_uid;
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'order_number', v_existing.order_number,
                                'total_paisa', v_existing.total_paisa);
    end if;
  end if;

  select * into v_shop from public.shops where id = p_shop_id and status = 'approved';
  select * into v_settings from public.storefront_settings where shop_id = p_shop_id;
  if v_shop.id is null or not coalesce(v_settings.is_live, false) then
    raise exception 'shop_not_taking_orders' using errcode = '55000';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'empty_order' using errcode = '22023';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_uid;
  if v_address.id is null then
    raise exception 'address_required' using errcode = '22023';
  end if;
  if v_address.lat is null or v_address.lng is null then
    raise exception 'address_location_required' using errcode = '22023';
  end if;
  if not private.delivers_to(
    v_shop.location, v_settings.delivery_radius_m, v_settings.serves_all_city, v_address.lat, v_address.lng
  ) then
    raise exception 'out_of_area' using errcode = '55000';
  end if;

  -- Price and check every line against the dukan's shelf.
  for v_line in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_line ->> 'qty')::integer;
    if v_qty is null or v_qty not between 1 and 999 then
      raise exception 'invalid_quantity' using errcode = '22023';
    end if;
    select * into v_item from public.shop_inventory
     where id = (v_line ->> 'inventory_id')::uuid and shop_id = p_shop_id
       and is_active and is_visible_online;
    if v_item.id is null then
      raise exception 'item_unavailable' using errcode = '55000';
    end if;
    if v_item.qty_on_hand < v_qty then
      raise exception 'out_of_stock' using errcode = '55000', detail = v_item.name;
    end if;
    v_subtotal := v_subtotal + v_item.selling_price_paisa * v_qty;
    v_count := v_count + v_qty;
  end loop;

  if v_subtotal < coalesce(v_settings.min_order_paisa, 0) then
    raise exception 'below_minimum' using errcode = '55000';
  end if;
  v_fee := case
    when v_settings.free_delivery_above_paisa is not null and v_subtotal >= v_settings.free_delivery_above_paisa then 0
    else coalesce(v_settings.delivery_fee_paisa, 0)
  end;

  select * into v_profile from public.profiles where id = v_uid;
  insert into public.customer_orders (
    order_number, shop_id, customer_id, shop_name, customer_name, customer_phone,
    items_count, subtotal_paisa, delivery_fee_paisa, total_paisa,
    address_id, delivery_address, notes, client_request_id
  )
  values (
    'C-' || lpad(private.next_counter('customer_order_number')::text, 6, '0'),
    p_shop_id, v_uid, v_shop.name, v_profile.full_name, v_profile.phone,
    v_count, v_subtotal, v_fee, v_subtotal + v_fee,
    v_address.id,
    -- A snapshot: the order keeps its address even if the customer edits or deletes theirs.
    jsonb_strip_nulls(jsonb_build_object(
      'text', concat_ws(', ', nullif(btrim(v_address.line2), ''), btrim(v_address.line1)),
      'label', v_address.label,
      'landmark', nullif(btrim(v_address.landmark), ''),
      'lat', v_address.lat,
      'lng', v_address.lng
    )),
    nullif(btrim(p_note), ''), p_request_id
  )
  returning * into v_order;

  insert into public.customer_order_items (
    customer_order_id, shop_id, customer_id, inventory_id, name, name_ur, image_path, unit,
    qty, unit_price_paisa, mrp_paisa, line_total_paisa
  )
  select v_order.id, p_shop_id, v_uid, i.id, i.name, i.name_ur,
         coalesce(i.image_path, mp.image_path), i.unit,
         (l ->> 'qty')::integer, i.selling_price_paisa, i.mrp_paisa,
         i.selling_price_paisa * (l ->> 'qty')::integer
    from jsonb_array_elements(p_items) l
    join public.shop_inventory i on i.id = (l ->> 'inventory_id')::uuid
    left join public.master_products mp on mp.id = i.master_product_id;

  perform private.notify_shop(
    p_shop_id, array['customer_orders'], 'order',
    format('New order %s', v_order.order_number),
    format('%s · Rs %s', coalesce(v_profile.full_name, 'Customer'), v_order.total_paisa / 100),
    jsonb_build_object('event', 'customer_order.placed', 'customer_order_id', v_order.id,
                       'order_number', v_order.order_number, 'total_paisa', v_order.total_paisa,
                       'customer_name', v_profile.full_name),
    '/dukan/customer-orders/' || v_order.id
  );

  return jsonb_build_object('id', v_order.id, 'order_number', v_order.order_number,
                            'total_paisa', v_order.total_paisa);
end;
$$;

revoke execute on function public.place_customer_order(uuid, jsonb, uuid, text, uuid) from public, anon;
grant execute on function public.place_customer_order(uuid, jsonb, uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A dukandar may deliver up to 6 km (it was 5). The TezDukan team can still set more.
-- ---------------------------------------------------------------------------------------------
create or replace function public.update_shop_storefront(
  p_shop_id uuid,
  p_is_live boolean,
  p_eta_minutes integer default null,
  p_min_order_paisa bigint default null,
  p_delivery_fee_paisa bigint default null,
  p_free_delivery_above_paisa bigint default null,
  p_tagline text default null,
  p_delivery_radius_m integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if p_shop_id is null or not private.has_shop_permission(p_shop_id, 'storefront') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_is_live is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_is_live and not exists (
    select 1 from public.shops s where s.id = p_shop_id and s.status = 'approved'
  ) then
    raise exception 'shop_not_approved' using errcode = '22023';
  end if;
  if p_is_live and not exists (
    select 1 from public.shop_inventory i
     where i.shop_id = p_shop_id and i.is_active and i.is_visible_online and i.qty_on_hand > 0
  ) then
    raise exception 'no_products' using errcode = '22023';
  end if;
  if p_eta_minutes is not null and (p_eta_minutes < 5 or p_eta_minutes > 240) then
    raise exception 'invalid_eta' using errcode = '22023';
  end if;
  if p_delivery_radius_m is not null and p_delivery_radius_m not between 500 and 6000 then
    raise exception 'invalid_radius' using errcode = '22023';
  end if;
  if coalesce(p_min_order_paisa, 0) not between 0 and 10000000
     or coalesce(p_delivery_fee_paisa, 0) not between 0 and 100000
     or coalesce(p_free_delivery_above_paisa, 0) not between 0 and 10000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  insert into public.storefront_settings as ss (
    shop_id, is_live, eta_minutes, min_order_paisa, delivery_fee_paisa, free_delivery_above_paisa,
    tagline, delivery_radius_m
  )
  values (
    p_shop_id, p_is_live, coalesce(p_eta_minutes, 45), coalesce(p_min_order_paisa, 0),
    coalesce(p_delivery_fee_paisa, 0), nullif(p_free_delivery_above_paisa, 0),
    nullif(left(btrim(coalesce(p_tagline, '')), 120), ''), coalesce(p_delivery_radius_m, 3000)
  )
  on conflict (shop_id) do update
     set is_live = p_is_live,
         eta_minutes = coalesce(p_eta_minutes, ss.eta_minutes),
         min_order_paisa = coalesce(p_min_order_paisa, ss.min_order_paisa),
         delivery_fee_paisa = coalesce(p_delivery_fee_paisa, ss.delivery_fee_paisa),
         free_delivery_above_paisa = case
           when p_free_delivery_above_paisa is null then ss.free_delivery_above_paisa
           else nullif(p_free_delivery_above_paisa, 0)
         end,
         tagline = case
           when p_tagline is null then ss.tagline
           else nullif(left(btrim(p_tagline), 120), '')
         end,
         delivery_radius_m = coalesce(p_delivery_radius_m, ss.delivery_radius_m);

  return public.shop_storefront(p_shop_id);
end;
$$;
