-- =============================================================================================
-- Distributor catalog management: the catalog list with stock, saving a product (with its
-- piece/carton packs and stock received) in one call, and the TezDukan master catalog search
-- that pre-fills a new product (name, Urdu name, brand, category, pack size, photo, barcode).
-- =============================================================================================

-- Master catalog search for "add product": barcode exact first, then the same trigram and
-- alias scoring as the dukandar's search (so "taapal" or "چائے" find Tapal too).
create or replace function public.search_master_products(p_query text, p_limit integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := private.search_normalize(coalesce(p_query, ''));
  v_raw text := btrim(coalesce(p_query, ''));
begin
  perform private.require_user();
  if char_length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(top.row order by top.score desc, top.name)
      from (
    select t.row, t.score, t.name
      from (
        select jsonb_build_object(
                 'id', mp.id, 'name', mp.name, 'name_ur', mp.name_ur,
                 'brand_id', mp.brand_id, 'brand_name', b.name,
                 'category_id', mp.category_id, 'category_name', c.name,
                 'pack_size_label', mp.pack_size_label, 'barcode', mp.barcode,
                 'units_per_carton', mp.units_per_carton, 'mrp_paisa', mp.mrp_paisa,
                 'image_path', mp.image_path
               ) as row,
               mp.name,
               greatest(
                 case when v_raw ~ '^[0-9]{8,14}$' and mp.barcode = v_raw then 10 else 0 end,
                 extensions.word_similarity(v_q, mp.search_text),
                 extensions.similarity(v_q, mp.search_text),
                 coalesce((
                   select max(greatest(
                            extensions.similarity(v_q, a.alias_normalized),
                            extensions.word_similarity(a.alias_normalized, v_q),
                            extensions.word_similarity(v_q, a.alias_normalized)
                          ) * a.weight)
                     from public.product_aliases a
                    where a.master_product_id = mp.id
                 ), 0),
                 0.9 * extensions.word_similarity(private.search_normalize(coalesce(b.name, '')), v_q)
               )::real as score
          from public.master_products mp
          left join public.brands b on b.id = mp.brand_id
          left join public.categories c on c.id = mp.category_id
         where mp.is_active
      ) t
     where t.score >= 0.3
     order by t.score desc, t.name
     limit least(greatest(coalesce(p_limit, 12), 1), 30)
      ) top
  ), '[]'::jsonb);
end;
$$;

-- The distributor's own catalog with stock on hand, newest changes first.
create or replace function public.org_catalog(
  p_org_id uuid,
  p_query text default null,
  p_filter text default 'all',
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(private.search_normalize(coalesce(p_query, '')), '');
  v_items jsonb;
  v_counts jsonb;
begin
  perform private.require_user();
  if p_org_id not in (select private.my_org_ids()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  with stock as (
    select sb.distributor_product_id, sum(sb.qty_on_hand - sb.qty_reserved)::integer as available
      from public.stock_batches sb
     where sb.org_id = p_org_id
       and (sb.expiry_date is null or sb.expiry_date >= private.pkt_today())
     group by sb.distributor_product_id
  ),
  rows as (
    select dp.*, s.available,
           (select pu.base_qty from public.pack_units pu
             where pu.distributor_product_id = dp.id and pu.unit = 'carton') as carton_qty,
           coalesce(dp.image_path, mp.image_path) as photo,
           b.name as brand_name, c.name as category_name
      from public.distributor_products dp
      left join stock s on s.distributor_product_id = dp.id
      left join public.master_products mp on mp.id = dp.master_product_id
      left join public.brands b on b.id = dp.brand_id
      left join public.categories c on c.id = dp.category_id
     where dp.org_id = p_org_id
       and (v_q is null or dp.search_text ilike '%' || v_q || '%' or dp.search_text operator(extensions.%) v_q)
  )
  select
    jsonb_build_object(
      'all', count(*),
      'active', count(*) filter (where is_active),
      'out_of_stock', count(*) filter (where is_active and available is not null and available <= 0),
      'inactive', count(*) filter (where not is_active)
    ),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'name_ur', name_ur, 'sku', sku, 'barcode', barcode,
      'brand_id', brand_id, 'brand_name', brand_name, 'category_id', category_id,
      'category_name', category_name, 'pack_size_label', pack_size_label, 'image_path', photo,
      'master_product_id', master_product_id, 'description', description,
      'mrp_paisa', mrp_paisa, 'trade_price_paisa', trade_price_paisa, 'moq_base_qty', moq_base_qty,
      'is_active', is_active, 'carton_qty', carton_qty, 'available_base_qty', available,
      'updated_at', updated_at
    ) order by updated_at desc) filter (
      where case coalesce(p_filter, 'all')
        when 'active' then is_active
        when 'out_of_stock' then is_active and available is not null and available <= 0
        when 'inactive' then not is_active
        else true
      end
    ), '[]'::jsonb)
    into v_counts, v_items
    from rows;

  return jsonb_build_object(
    'counts', v_counts,
    'items', (
      select coalesce(jsonb_agg(e.value), '[]'::jsonb)
        from (
          select value from jsonb_array_elements(v_items)
          offset greatest(coalesce(p_offset, 0), 0)
          limit least(greatest(coalesce(p_limit, 100), 1), 500)
        ) e
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- save_distributor_product: create or update one product with its packs, and optionally take
-- stock in (a new batch in the default warehouse). p_product keys:
--   id?, master_product_id?, name, name_ur?, brand_id?, category_id?, pack_size_label?, barcode?,
--   sku?, description?, image_path?, mrp_paisa, trade_price_paisa, moq_base_qty?, is_active?,
--   carton_qty? (null removes the carton pack), stock_in_qty?, stock_expiry_date?
-- ---------------------------------------------------------------------------------------------
create or replace function public.save_distributor_product(p_org_id uuid, p_product jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := (p_product ->> 'id')::uuid;
  v_name text := btrim(coalesce(p_product ->> 'name', ''));
  v_trade bigint := (p_product ->> 'trade_price_paisa')::bigint;
  v_mrp bigint := coalesce((p_product ->> 'mrp_paisa')::bigint, 0);
  v_moq integer := coalesce((p_product ->> 'moq_base_qty')::integer, 1);
  v_carton integer := (p_product ->> 'carton_qty')::integer;
  v_stock integer := coalesce((p_product ->> 'stock_in_qty')::integer, 0);
  v_expiry date := (p_product ->> 'stock_expiry_date')::date;
  v_image text := nullif(btrim(coalesce(p_product ->> 'image_path', '')), '');
  v_barcode text := nullif(regexp_replace(coalesce(p_product ->> 'barcode', ''), '\D', '', 'g'), '');
  v_sku text := nullif(btrim(coalesce(p_product ->> 'sku', '')), '');
  v_warehouse uuid;
  v_batch uuid;
begin
  perform private.require_user();
  if not private.has_org_permission(p_org_id, 'catalog.manage') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 160 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if v_trade is null or v_trade <= 0 then
    raise exception 'price_required' using errcode = '22023';
  end if;
  if v_mrp > 0 and v_trade > v_mrp then
    raise exception 'price_above_mrp' using errcode = '22023';
  end if;
  if v_moq < 1 or v_moq > 100000 then
    raise exception 'invalid_moq' using errcode = '22023';
  end if;
  if v_carton is not null and (v_carton < 2 or v_carton > 10000) then
    raise exception 'invalid_carton' using errcode = '22023';
  end if;
  if v_stock < 0 or v_stock > 10000000 then
    raise exception 'invalid_stock' using errcode = '22023';
  end if;
  if v_barcode is not null and v_barcode !~ '^[0-9]{8,14}$' then
    raise exception 'invalid_barcode' using errcode = '22023';
  end if;
  -- Photos come from this distributor's folder or the shared catalog, never another org's.
  if v_image is not null and not (
    v_image like 'org/' || p_org_id::text || '/%' or v_image like 'master/%' or v_image like 'seed/%'
  ) then
    raise exception 'invalid_image' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.distributor_products (
      org_id, master_product_id, name, name_ur, sku, barcode, brand_id, category_id, description,
      pack_size_label, image_path, mrp_paisa, trade_price_paisa, moq_base_qty, is_active
    )
    values (
      p_org_id, (p_product ->> 'master_product_id')::uuid, v_name,
      nullif(btrim(coalesce(p_product ->> 'name_ur', '')), ''),
      coalesce(v_sku, 'TD-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
      v_barcode, (p_product ->> 'brand_id')::uuid, (p_product ->> 'category_id')::uuid,
      nullif(btrim(coalesce(p_product ->> 'description', '')), ''),
      nullif(btrim(coalesce(p_product ->> 'pack_size_label', '')), ''), v_image,
      v_mrp, v_trade, v_moq, coalesce((p_product ->> 'is_active')::boolean, true)
    )
    returning id into v_id;
  else
    update public.distributor_products
       set name = v_name,
           name_ur = nullif(btrim(coalesce(p_product ->> 'name_ur', '')), ''),
           sku = coalesce(v_sku, sku),
           barcode = v_barcode,
           brand_id = (p_product ->> 'brand_id')::uuid,
           category_id = (p_product ->> 'category_id')::uuid,
           description = nullif(btrim(coalesce(p_product ->> 'description', '')), ''),
           pack_size_label = nullif(btrim(coalesce(p_product ->> 'pack_size_label', '')), ''),
           image_path = coalesce(v_image, image_path),
           mrp_paisa = v_mrp,
           trade_price_paisa = v_trade,
           moq_base_qty = v_moq,
           is_active = coalesce((p_product ->> 'is_active')::boolean, is_active)
     where id = v_id and org_id = p_org_id;
    if not found then
      raise exception 'product_not_found' using errcode = 'P0002';
    end if;
  end if;

  -- Packs: always a piece; a carton when given. The bigger pack is what dukans see first.
  -- Only one pack may be the default, so clear it before choosing again.
  update public.pack_units set is_default = false where distributor_product_id = v_id and is_default;
  if v_carton is null then
    delete from public.pack_units where distributor_product_id = v_id and unit = 'carton';
  end if;
  insert into public.pack_units (distributor_product_id, org_id, unit, label, base_qty, is_default)
  values (v_id, p_org_id, 'piece', 'Piece', 1, v_carton is null)
  on conflict (distributor_product_id, unit) do update set is_default = excluded.is_default;
  if v_carton is not null then
    insert into public.pack_units (distributor_product_id, org_id, unit, label, base_qty, is_default)
    values (v_id, p_org_id, 'carton', 'Carton', v_carton, true)
    on conflict (distributor_product_id, unit) do update set base_qty = excluded.base_qty, is_default = true;
  end if;

  if v_stock > 0 then
    select w.id into v_warehouse
      from public.warehouses w
     where w.org_id = p_org_id and w.is_active
     order by w.is_default desc, w.created_at
     limit 1;
    if v_warehouse is null then
      insert into public.warehouses (org_id, name, code, is_default)
      values (p_org_id, 'Main godown', 'MAIN', true)
      returning id into v_warehouse;
    end if;
    insert into public.stock_batches (org_id, warehouse_id, distributor_product_id, expiry_date, qty_on_hand, unit_cost_paisa)
    values (p_org_id, v_warehouse, v_id, v_expiry, v_stock, v_trade)
    returning id into v_batch;
    insert into public.stock_movements (org_id, warehouse_id, batch_id, distributor_product_id, movement_type, quantity, unit_cost_paisa, reference_type, reference_id, reason)
    values (p_org_id, v_warehouse, v_batch, v_id, 'stock_in', v_stock, v_trade, 'product', v_id, 'Stock added from the catalog');
  end if;

  return v_id;
end;
$$;

revoke all on function public.search_master_products(text, integer) from public, anon;
revoke all on function public.org_catalog(uuid, text, text, integer, integer) from public, anon;
revoke all on function public.save_distributor_product(uuid, jsonb) from public, anon;
grant execute on function public.search_master_products(text, integer) to authenticated, service_role;
grant execute on function public.org_catalog(uuid, text, text, integer, integer) to authenticated, service_role;
grant execute on function public.save_distributor_product(uuid, jsonb) to authenticated, service_role;
