-- Dukandar product management: a starter pack of common products to add in one tap, adding
-- products (from the master catalogue or the shop's own) with opening stock, and stock counts.
-- Stock only changes here, through movements, never by a direct update.

-- Common products the shop does not stock yet: ones dukans order most, then two per aisle so a
-- new shop gets a sensible spread. Photos first, so the starter pack looks real.
create or replace function public.shop_starter_pack(p_shop_id uuid, p_limit integer default 16)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if p_shop_id is null or p_shop_id not in (select private.shop_ids_with_permission('inventory')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(x order by x.rank), '[]'::jsonb)
      from (
        select m.id, m.name, m.name_ur, m.pack_size_label, m.image_path, coalesce(m.mrp_paisa, 0) as mrp_paisa,
               c.name as category_name,
               row_number() over (
                 order by coalesce(pop.orders, 0) desc, per_aisle.n, (m.image_path is null), c.sort_order, m.name
               ) as rank
          from public.master_products m
          join public.categories c on c.id = m.category_id
          left join (
            select i.master_product_id, count(*) as orders
              from public.order_items i
             where i.master_product_id is not null and i.deleted_at is null
             group by i.master_product_id
          ) pop on pop.master_product_id = m.id
          cross join lateral (
            select count(*) as n
              from public.master_products m2
             where m2.category_id = m.category_id and m2.is_active
               and ((m2.image_path is null), m2.name) < ((m.image_path is null), m.name)
          ) per_aisle
         where m.is_active
           and not exists (
             select 1 from public.shop_inventory s
              where s.shop_id = p_shop_id and s.master_product_id = m.id and s.is_active
           )
         order by rank
         limit greatest(least(coalesce(p_limit, 16), 40), 1)
      ) x
  );
end;
$$;

-- Adds products in one go. Each item: master_product_id? (copies name, photo, aisle and MRP
-- from the catalogue) or name (the shop's own product), selling_price_paisa, qty?,
-- cost_price_paisa?, pack_size_label?. A product the shop already has (or had) is updated and
-- shown again instead of duplicated. Opening stock is booked as a movement.
create or replace function public.add_shop_products(p_shop_id uuid, p_items jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_master public.master_products;
  v_master_id uuid;
  v_id uuid;
  v_name text;
  v_price bigint;
  v_cost bigint;
  v_qty numeric;
  v_old_qty numeric;
  v_new boolean;
  v_added integer := 0;
  v_updated integer := 0;
begin
  perform private.require_user();
  if p_shop_id is null or p_shop_id not in (select private.shop_ids_with_permission('inventory')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 60 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_master_id := nullif(v_item ->> 'master_product_id', '')::uuid;
    v_price := (v_item ->> 'selling_price_paisa')::bigint;
    v_cost := coalesce((v_item ->> 'cost_price_paisa')::bigint, 0);
    v_qty := coalesce((v_item ->> 'qty')::numeric, 0);
    if v_price is null or v_price < 0 or v_cost < 0 or v_qty < 0 or v_qty <> trunc(v_qty) then
      raise exception 'invalid_items' using errcode = '22023';
    end if;

    v_id := null;
    v_new := false;
    if v_master_id is not null then
      select * into v_master from public.master_products where id = v_master_id and is_active;
      if not found then
        raise exception 'product_not_found' using errcode = 'P0002';
      end if;
      select id, qty_on_hand into v_id, v_old_qty
        from public.shop_inventory where shop_id = p_shop_id and master_product_id = v_master_id;
      if v_id is null then
        insert into public.shop_inventory (
          shop_id, master_product_id, name, name_ur, category_id, brand_id, pack_size_label, barcode,
          mrp_paisa, cost_price_paisa, selling_price_paisa, image_path, low_stock_threshold
        ) values (
          p_shop_id, v_master.id, v_master.name, v_master.name_ur, v_master.category_id, v_master.brand_id,
          v_master.pack_size_label, v_master.barcode, v_master.mrp_paisa, v_cost, v_price, v_master.image_path, 3
        )
        returning id into v_id;
        v_new := true;
      end if;
    else
      v_name := btrim(coalesce(v_item ->> 'name', ''));
      if char_length(v_name) < 2 or char_length(v_name) > 160 then
        raise exception 'invalid_items' using errcode = '22023';
      end if;
      select id, qty_on_hand into v_id, v_old_qty
        from public.shop_inventory
       where shop_id = p_shop_id and master_product_id is null and lower(name) = lower(v_name);
      if v_id is null then
        insert into public.shop_inventory (
          shop_id, name, pack_size_label, cost_price_paisa, selling_price_paisa, low_stock_threshold
        ) values (
          p_shop_id, v_name, nullif(btrim(coalesce(v_item ->> 'pack_size_label', '')), ''), v_cost, v_price, 3
        )
        returning id into v_id;
        v_new := true;
      end if;
    end if;

    if v_new then
      v_added := v_added + 1;
    else
      update public.shop_inventory
         set selling_price_paisa = v_price,
             cost_price_paisa = case when v_cost > 0 then v_cost else cost_price_paisa end,
             is_active = true
       where id = v_id;
      v_updated := v_updated + 1;
    end if;

    if v_qty > 0 then
      update public.shop_inventory set qty_on_hand = qty_on_hand + v_qty where id = v_id
      returning qty_on_hand into v_old_qty;
      insert into public.shop_stock_movements (shop_id, inventory_id, movement_type, qty, balance_after, unit_cost_paisa, reason)
      values (p_shop_id, v_id, case when v_new then 'opening' else 'receive' end::public.shop_stock_movement_type,
              v_qty, v_old_qty, v_cost, 'added from products');
    end if;
  end loop;

  return jsonb_build_object('added', v_added, 'updated', v_updated);
end;
$$;

-- A stock count: sets what is on the shelf now and books the difference as a movement.
create or replace function public.set_shop_stock(p_inventory_id uuid, p_qty numeric)
returns numeric
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.shop_inventory;
begin
  perform private.require_user();
  select * into v_row from public.shop_inventory where id = p_inventory_id for update;
  if not found or v_row.shop_id not in (select private.shop_ids_with_permission('inventory')) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 0 or p_qty > 1000000 or (not v_row.is_loose and p_qty <> trunc(p_qty)) then
    raise exception 'invalid_qty' using errcode = '22023';
  end if;
  if p_qty = v_row.qty_on_hand then
    return p_qty;
  end if;

  update public.shop_inventory set qty_on_hand = p_qty where id = p_inventory_id;
  insert into public.shop_stock_movements (shop_id, inventory_id, movement_type, qty, balance_after, unit_cost_paisa, reason)
  values (v_row.shop_id, p_inventory_id, 'count', p_qty - v_row.qty_on_hand, p_qty, v_row.cost_price_paisa, 'stock count');
  return p_qty;
end;
$$;

revoke execute on function public.shop_starter_pack(uuid, integer) from public, anon;
revoke execute on function public.add_shop_products(uuid, jsonb) from public, anon;
revoke execute on function public.set_shop_stock(uuid, numeric) from public, anon;
grant execute on function public.shop_starter_pack(uuid, integer) to authenticated;
grant execute on function public.add_shop_products(uuid, jsonb) to authenticated;
grant execute on function public.set_shop_stock(uuid, numeric) to authenticated;

-- The distributor's version: common catalogue products the organization does not list yet,
-- with what save_distributor_product needs to add each one.
create or replace function public.org_starter_pack(p_org_id uuid, p_limit integer default 16)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if not private.has_org_permission(p_org_id, 'catalog.manage') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(x order by x.rank), '[]'::jsonb)
      from (
        select m.id, m.name, m.name_ur, m.brand_id, m.category_id, c.name as category_name,
               m.pack_size_label, m.barcode, m.image_path, coalesce(m.mrp_paisa, 0) as mrp_paisa,
               m.units_per_carton,
               row_number() over (
                 order by coalesce(pop.orders, 0) desc, (m.image_path is null), c.sort_order, m.name
               ) as rank
          from public.master_products m
          join public.categories c on c.id = m.category_id
          left join (
            select i.master_product_id, count(*) as orders
              from public.order_items i
             where i.master_product_id is not null and i.deleted_at is null
             group by i.master_product_id
          ) pop on pop.master_product_id = m.id
         where m.is_active
           and not exists (
             select 1 from public.distributor_products d
              where d.org_id = p_org_id and d.master_product_id = m.id
           )
         order by rank
         limit greatest(least(coalesce(p_limit, 16), 40), 1)
      ) x
  );
end;
$$;

revoke execute on function public.org_starter_pack(uuid, integer) from public, anon;
grant execute on function public.org_starter_pack(uuid, integer) to authenticated;
