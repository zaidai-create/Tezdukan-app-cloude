-- =============================================================================================
-- Phase 2 RPCs: dukandar ordering. Catalog reads, the server cart, checkout, order actions and
-- the distributor ledger as the shop sees it. All SECURITY DEFINER with their own permission
-- checks: the caller must hold "orders" on the shop (owners do) or be a booker covering it.
-- Error MESSAGE is a stable key the app translates; DETAIL names the org, product or line.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- search_catalog(shop, query, limit): exact barcode first, then trigram similarity on product
-- text and on product, brand and category aliases (Urdu and Roman Urdu live there). Typos
-- still match ("tapl", "surf exel"). Ties go to what this shop orders most.
-- ---------------------------------------------------------------------------------------------
create or replace function public.search_catalog(p_shop_id uuid, p_query text, p_limit integer default 20)
returns setof public.catalog_item
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
  v_raw text := btrim(coalesce(p_query, ''));
  v_q text := private.search_normalize(v_raw);
begin
  if v_q is null or v_q = '' then
    return;
  end if;
  return query
  with cat as (
    select * from private.catalog_rows(p_shop_id, v_booker)
  ),
  scored as (
    select c.*,
           greatest(
             case
               when v_raw ~ '^[0-9]{8,14}$' and (
                 dp.barcode = v_raw
                 or exists (select 1 from public.pack_units pu where pu.distributor_product_id = dp.id and pu.barcode = v_raw)
               ) then 10
               else 0
             end,
             extensions.word_similarity(v_q, dp.search_text),
             extensions.similarity(v_q, dp.search_text),
             coalesce((
               select max(greatest(
                        extensions.similarity(v_q, a.alias_normalized),
                        extensions.word_similarity(a.alias_normalized, v_q),
                        extensions.word_similarity(v_q, a.alias_normalized)
                      ) * a.weight)
                 from public.product_aliases a
                where a.master_product_id = c.master_product_id
             ), 0),
             0.9 * coalesce((
               select max(greatest(
                        extensions.similarity(v_q, a.alias_normalized),
                        extensions.word_similarity(a.alias_normalized, v_q)
                      ) * a.weight)
                 from public.product_aliases a
                where a.brand_id = c.brand_id
             ), 0),
             0.9 * extensions.word_similarity(private.search_normalize(coalesce(c.brand_name, '')), v_q),
             0.7 * coalesce((
               select max(greatest(
                        extensions.similarity(v_q, a.alias_normalized),
                        extensions.word_similarity(a.alias_normalized, v_q)
                      ) * a.weight)
                 from public.product_aliases a
                where a.category_id = c.category_id
             ), 0)
           )::real as score,
           (select count(*) from public.order_items oi
             where oi.shop_id = p_shop_id and oi.distributor_product_id = c.distributor_product_id) as history
      from cat c
      join public.distributor_products dp on dp.id = c.distributor_product_id
  )
  select s.distributor_product_id, s.org_id, s.org_name, s.master_product_id, s.name, s.name_ur, s.brand_id,
         s.brand_name, s.brand_slug, s.category_id, s.category_slug, s.pack_size_label, s.image_path, s.mrp_paisa,
         s.price_paisa, s.moq_base_qty, s.pack_units, s.scheme, s.in_stock, s.available_base_qty, s.score
    from scored s
   where s.score >= 0.3
   order by s.score desc, s.history desc, s.in_stock desc, s.price_paisa, s.name
   limit greatest(least(coalesce(p_limit, 20), 100), 1);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- browse_catalog: a category (with its children), brand or distributor, sorted and filtered.
--   sort:    popular (city order volume, last 30 days), price_asc, price_desc, margin_desc, newest
--   filters: {in_stock: bool, has_scheme: bool, min_margin_bps: int}
-- ---------------------------------------------------------------------------------------------
create or replace function public.browse_catalog(
  p_shop_id uuid,
  p_category_id uuid default null,
  p_brand_id uuid default null,
  p_org_id uuid default null,
  p_sort text default 'popular',
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 40,
  p_offset integer default 0
)
returns setof public.catalog_item
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
  v_sort text := coalesce(p_sort, 'popular');
  v_filters jsonb := coalesce(p_filters, '{}'::jsonb);
  v_categories uuid[];
  v_city_shops uuid[];
begin
  if v_sort not in ('popular', 'price_asc', 'price_desc', 'margin_desc', 'newest') then
    raise exception 'invalid_sort' using errcode = '22023', detail = v_sort;
  end if;
  if jsonb_typeof(v_filters) <> 'object' then
    raise exception 'invalid_filters' using errcode = '22023';
  end if;
  if p_category_id is not null then
    select array_agg(c.id) into v_categories
      from public.categories c
     where c.id = p_category_id or c.parent_id = p_category_id;
  end if;
  if v_sort = 'popular' then
    select array_agg(s.id) into v_city_shops
      from public.shops s
      join public.service_areas a on a.id = s.area_id
     where coalesce(a.parent_id, a.id) = (
       select coalesce(sa.parent_id, sa.id) from public.shops me join public.service_areas sa on sa.id = me.area_id
        where me.id = p_shop_id
     );
  end if;

  return query
  with cat as (
    select c.*,
           case when c.mrp_paisa > 0 then ((c.mrp_paisa - c.price_paisa) * 10000 / c.mrp_paisa)::integer else 0 end as margin_bps
      from private.catalog_rows(p_shop_id, v_booker) c
     where (v_categories is null or c.category_id = any (v_categories))
       and (p_brand_id is null or c.brand_id = p_brand_id)
       and (p_org_id is null or c.org_id = p_org_id)
       and (not coalesce((v_filters ->> 'in_stock')::boolean, false) or c.in_stock)
       and (not coalesce((v_filters ->> 'has_scheme')::boolean, false) or c.scheme is not null)
  ),
  ranked as (
    select cat.*,
           dp.created_at as added_at,
           case when v_sort = 'popular' then (
             select coalesce(sum(oi.base_qty), 0)
               from public.order_items oi
               join public.orders o on o.id = oi.order_id
              where oi.distributor_product_id = cat.distributor_product_id
                and o.shop_id = any (coalesce(v_city_shops, '{}'::uuid[]))
                and o.status <> 'cancelled'
                and o.created_at > now() - interval '30 days'
           ) end as popularity
      from cat
      join public.distributor_products dp on dp.id = cat.distributor_product_id
     where v_filters ->> 'min_margin_bps' is null or cat.margin_bps >= (v_filters ->> 'min_margin_bps')::integer
  )
  select r.distributor_product_id, r.org_id, r.org_name, r.master_product_id, r.name, r.name_ur, r.brand_id,
         r.brand_name, r.brand_slug, r.category_id, r.category_slug, r.pack_size_label, r.image_path, r.mrp_paisa,
         r.price_paisa, r.moq_base_qty, r.pack_units, r.scheme, r.in_stock, r.available_base_qty,
         coalesce(r.popularity, 0)::real
    from ranked r
   order by
     r.in_stock desc,
     case when v_sort = 'popular' then r.popularity end desc nulls last,
     case when v_sort = 'popular' then (r.image_path is not null) end desc,
     case when v_sort = 'price_asc' then r.price_paisa end asc,
     case when v_sort = 'price_desc' then r.price_paisa end desc,
     case when v_sort = 'margin_desc' then r.margin_bps end desc,
     case when v_sort = 'newest' then r.added_at end desc,
     r.name, r.price_paisa
   limit greatest(least(coalesce(p_limit, 40), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- catalog_facets(shop, category): categories (top level, or the children of a category),
-- brands and distributors, each with the number of products this shop can order.
-- ---------------------------------------------------------------------------------------------
create or replace function public.catalog_facets(p_shop_id uuid, p_category_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
begin
  return (
    with cat as (
      select c.*, coalesce(cc.parent_id, cc.id) as top_category_id, cc.parent_id
        from private.catalog_rows(p_shop_id, v_booker) c
        left join public.categories cc on cc.id = c.category_id
       where p_category_id is null or c.category_id = p_category_id or cc.parent_id = p_category_id
    )
    select jsonb_build_object(
      'categories', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'id', k.id, 'slug', k.slug, 'name', k.name, 'name_ur', k.name_ur, 'tint', k.tint,
                   'image_path', k.image_path, 'product_count', k.product_count
                 )
                 order by k.sort_order, k.name
               )
          from (
            select ct.id, ct.slug, ct.name, ct.name_ur, ct.tint, ct.image_path, ct.sort_order,
                   (select count(*) from cat
                     where (p_category_id is null and cat.top_category_id = ct.id)
                        or (p_category_id is not null and cat.category_id = ct.id)) as product_count
              from public.categories ct
             where ct.is_active
               and ((p_category_id is null and ct.parent_id is null) or ct.parent_id = p_category_id)
          ) k
         where k.product_count > 0
      ), '[]'::jsonb),
      'brands', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'id', b.id, 'slug', b.slug, 'name', b.name, 'name_ur', b.name_ur, 'logo_path', b.logo_path,
                   'product_count', x.n
                 )
                 order by x.n desc, b.name
               )
          from (select cat.brand_id, count(*) as n from cat where cat.brand_id is not null group by cat.brand_id) x
          join public.brands b on b.id = x.brand_id
      ), '[]'::jsonb),
      'distributors', coalesce((
        select jsonb_agg(
                 jsonb_build_object('id', o.id, 'name', o.name, 'logo_path', o.logo_path, 'product_count', x.n)
                 order by x.n desc, o.name
               )
          from (select cat.org_id, count(*) as n from cat group by cat.org_id) x
          join public.organizations o on o.id = x.org_id
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- product_detail(shop, product): the item, its description and images, every live scheme,
-- the same product from other distributors (cheapest first) and what is bought with it.
-- ---------------------------------------------------------------------------------------------
create or replace function public.product_detail(p_shop_id uuid, p_distributor_product_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
  v_item public.catalog_item;
  v_shop public.shops%rowtype;
  v_areas uuid[];
begin
  select * into v_item from private.catalog_rows(p_shop_id, v_booker, array[p_distributor_product_id]);
  if v_item.distributor_product_id is null then
    raise exception 'product_unavailable' using errcode = 'P0002', detail = p_distributor_product_id::text;
  end if;
  select * into v_shop from public.shops where id = p_shop_id;
  v_areas := private.shop_area_ids(p_shop_id);

  return jsonb_build_object(
    'item', to_jsonb(v_item),
    'description', (
      select coalesce(dp.description, mp.description)
        from public.distributor_products dp
        left join public.master_products mp on mp.id = dp.master_product_id
       where dp.id = p_distributor_product_id
    ),
    'images', coalesce((
      select jsonb_agg(x.path order by x.ord, x.sort_order)
        from (
          select v_item.image_path as path, 0 as ord, 0 as sort_order where v_item.image_path is not null
          union
          select pi.path, 1, pi.sort_order from public.product_images pi
           where pi.distributor_product_id = p_distributor_product_id
          union
          select pi.path, 2, pi.sort_order from public.product_images pi
           where v_item.master_product_id is not null and pi.master_product_id = v_item.master_product_id
        ) x
    ), '[]'::jsonb),
    'schemes', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', s.id, 'kind', s.kind, 'name', s.name, 'name_ur', s.name_ur, 'rules', s.rules, 'ends_at', s.ends_at
               )
               order by s.priority desc, s.starts_at desc
             )
        from public.schemes s
       where s.id in (
               select sp.scheme_id from public.scheme_products sp
                where sp.distributor_product_id = p_distributor_product_id and sp.role in ('trigger', 'bundle_item')
             )
         and private.scheme_is_live(s, v_areas, v_shop.tier)
    ), '[]'::jsonb),
    'other_offers', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.price_paisa, c.org_name)
        from private.catalog_rows(p_shop_id, v_booker) c
       where v_item.master_product_id is not null
         and c.master_product_id = v_item.master_product_id
         and c.distributor_product_id <> p_distributor_product_id
    ), '[]'::jsonb),
    'bought_together', coalesce((
      with pairs as (
        select other.distributor_product_id, count(*) as together
          from public.order_items mine
          join public.order_items other on other.order_id = mine.order_id
                                        and other.distributor_product_id <> mine.distributor_product_id
         where mine.distributor_product_id = p_distributor_product_id
           and mine.deleted_at is null and other.deleted_at is null
         group by other.distributor_product_id
      ),
      picks as (
        select c.*, coalesce(p.together, 0) as together
          from private.catalog_rows(p_shop_id, v_booker) c
          left join pairs p on p.distributor_product_id = c.distributor_product_id
         where c.distributor_product_id <> p_distributor_product_id
           and c.org_id = v_item.org_id
           and (p.together is not null or c.category_id is not distinct from v_item.category_id)
         order by coalesce(p.together, 0) desc, c.in_stock desc, (c.image_path is not null) desc, c.name
         limit 6
      )
      select jsonb_agg(
               jsonb_build_object(
                 'distributor_product_id', k.distributor_product_id, 'org_id', k.org_id, 'org_name', k.org_name,
                 'master_product_id', k.master_product_id, 'name', k.name, 'name_ur', k.name_ur,
                 'brand_id', k.brand_id, 'brand_name', k.brand_name, 'brand_slug', k.brand_slug,
                 'category_id', k.category_id, 'category_slug', k.category_slug,
                 'pack_size_label', k.pack_size_label, 'image_path', k.image_path, 'mrp_paisa', k.mrp_paisa,
                 'price_paisa', k.price_paisa, 'moq_base_qty', k.moq_base_qty, 'pack_units', k.pack_units,
                 'scheme', k.scheme, 'in_stock', k.in_stock, 'available_base_qty', k.available_base_qty,
                 'rank', k.together
               )
               order by k.together desc, k.in_stock desc, (k.image_path is not null) desc, k.name
             )
        from picks k
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- shop_home_feed(shop): everything the dukandar home shows in one round trip.
--   order_again  this shop's most recent and frequent products
--   deals        products with a live scheme, then the biggest MRP margin (photos first)
--   trending     most ordered in the shop's zone (14 days), then its city, then the rest
--   categories   top-level categories with products this shop can order
--   brands       top brands by product count
--   delivery     each distributor's next delivery slot
--   banners      live dukan_home banners for this shop
-- ---------------------------------------------------------------------------------------------
create or replace function public.shop_home_feed(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
  v_shop public.shops%rowtype;
  v_areas uuid[];
  v_city uuid;
begin
  select * into v_shop from public.shops where id = p_shop_id;
  v_areas := private.shop_area_ids(p_shop_id);
  select coalesce(a.parent_id, a.id) into v_city from public.service_areas a where a.id = v_shop.area_id;

  return (
    with cat as (
      select * from private.catalog_rows(p_shop_id, v_booker)
    ),
    history as (
      select oi.distributor_product_id, max(o.created_at) as last_at, count(*) as times
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where o.shop_id = p_shop_id and o.status <> 'cancelled' and oi.deleted_at is null and oi.quantity > 0
       group by oi.distributor_product_id
    ),
    demand as (
      select oi.distributor_product_id,
             sum(case when s.area_id = v_shop.area_id then oi.base_qty else 0 end) as zone_qty,
             sum(oi.base_qty) as city_qty
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        join public.shops s on s.id = o.shop_id
        join public.service_areas a on a.id = s.area_id
       where o.created_at > now() - interval '14 days'
         and o.status <> 'cancelled'
         and coalesce(a.parent_id, a.id) = v_city
       group by oi.distributor_product_id
    )
    select jsonb_build_object(
      'order_again', coalesce((
        select jsonb_agg(to_jsonb(x) - 'last_at' - 'times' order by x.last_at desc, x.times desc)
          from (
            select c.*, h.last_at, h.times
              from cat c join history h on h.distributor_product_id = c.distributor_product_id
             order by h.last_at desc, h.times desc
             limit 12
          ) x
      ), '[]'::jsonb),
      'deals', coalesce((
        select jsonb_agg(
                 to_jsonb(x) - 'margin'
                 order by (x.scheme is not null) desc, (x.image_path is not null) desc, x.margin desc, x.name
               )
          from (
            select c.*,
                   case when c.mrp_paisa > 0 then (c.mrp_paisa - c.price_paisa)::numeric / c.mrp_paisa else 0 end as margin
              from cat c
             where c.in_stock
             order by (c.scheme is not null) desc, (c.image_path is not null) desc, margin desc, c.name
             limit 12
          ) x
      ), '[]'::jsonb),
      'trending', coalesce((
        select jsonb_agg(to_jsonb(x) - 'zone_qty' - 'city_qty'
                         order by x.zone_qty desc, x.city_qty desc, (x.image_path is not null) desc, x.name)
          from (
            select c.*, coalesce(d.zone_qty, 0) as zone_qty, coalesce(d.city_qty, 0) as city_qty
              from cat c left join demand d on d.distributor_product_id = c.distributor_product_id
             where c.in_stock
             order by coalesce(d.zone_qty, 0) desc, coalesce(d.city_qty, 0) desc, (c.image_path is not null) desc, c.name
             limit 12
          ) x
      ), '[]'::jsonb),
      'categories', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'id', k.id, 'slug', k.slug, 'name', k.name, 'name_ur', k.name_ur, 'tint', k.tint,
                   'image_path', k.image_path, 'product_count', k.n
                 )
                 order by k.sort_order, k.name
               )
          from (
            select ct.id, ct.slug, ct.name, ct.name_ur, ct.tint, ct.image_path, ct.sort_order,
                   (select count(*) from cat
                      left join public.categories cc on cc.id = cat.category_id
                     where coalesce(cc.parent_id, cc.id) = ct.id) as n
              from public.categories ct
             where ct.is_active and ct.parent_id is null
          ) k
         where k.n > 0
      ), '[]'::jsonb),
      'brands', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'id', b.id, 'slug', b.slug, 'name', b.name, 'name_ur', b.name_ur, 'logo_path', b.logo_path,
                   'product_count', x.n
                 )
                 order by x.n desc, b.name
               )
          from (
            select cat.brand_id, count(*) as n from cat where cat.brand_id is not null
             group by cat.brand_id order by count(*) desc limit 10
          ) x
          join public.brands b on b.id = x.brand_id
      ), '[]'::jsonb),
      'delivery', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'org_id', o.id, 'org_name', o.name,
                   'next_slot_start', s.slot_start, 'next_slot_end', s.slot_end
                 )
                 order by s.slot_start, o.name
               )
          from public.organizations o
          cross join lateral (select * from private.delivery_slots_for(o.id, 1) limit 1) s
         where o.id in (select distinct cat.org_id from cat)
      ), '[]'::jsonb),
      'banners', coalesce((
        select jsonb_agg(
                 jsonb_build_object(
                   'id', bn.id, 'title', bn.title, 'title_ur', bn.title_ur, 'subtitle', bn.subtitle,
                   'image_path', bn.image_path, 'link', bn.link, 'org_id', bn.org_id
                 )
                 order by bn.sort_order, bn.starts_at desc
               )
          from public.banners bn
         where bn.placement = 'dukan_home'
           and bn.is_active
           and bn.starts_at <= now()
           and (bn.ends_at is null or bn.ends_at > now())
           and (bn.area_ids is null or bn.area_ids && v_areas)
           and (bn.segments is null or v_shop.tier = any (bn.segments))
           and (bn.owner_type = 'platform' or bn.org_id in (select private.orderable_org_ids(p_shop_id, v_booker)))
      ), '[]'::jsonb)
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Cart. One server cart per (shop, user): the same cart on every device and for Munshi.
-- cart_summary shape:
--   {item_count, total_paisa, groups: [{org_id, org_name, logo_path, account_status,
--    credit_limit_paisa, credit_available_paisa, min_order_paisa, delivery_fee_paisa,
--    free_delivery_above_paisa, subtotal_paisa, scheme_discount_paisa, delivery_charge_paisa,
--    total_paisa, meets_minimum, short_by_paisa, next_slots: [{start, end}],
--    items: [{cart_item_id, distributor_product_id, item, pack_unit_id, pack_label, base_qty_per_unit, quantity,
--             piece_price_paisa, unit_price_paisa, line_discount_paisa, line_total_paisa,
--             free_base_qty, scheme_applied, problems}]}]}
-- Groups are ordered by subtotal, largest first.
-- ---------------------------------------------------------------------------------------------
create or replace function public.cart_summary(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
begin
  return private.price_cart(p_shop_id, auth.uid(), v_booker);
end;
$$;

-- Sets a line's quantity (0 removes it) and returns the cart summary.
create or replace function public.set_cart_item(
  p_shop_id uuid,
  p_distributor_product_id uuid,
  p_pack_unit_id uuid,
  p_quantity integer,
  p_source public.cart_item_source default 'manual'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_booker uuid := private.require_shop_buyer(p_shop_id);
  v_cart uuid;
begin
  if p_distributor_product_id is null or p_pack_unit_id is null then
    raise exception 'product_required' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 100000 then
    raise exception 'invalid_quantity' using errcode = '22023', detail = coalesce(p_quantity::text, 'null');
  end if;

  select c.id into v_cart from public.carts c where c.shop_id = p_shop_id and c.user_id = v_uid;

  if p_quantity = 0 then
    if v_cart is not null then
      delete from public.cart_items ci
       where ci.cart_id = v_cart
         and ci.distributor_product_id = p_distributor_product_id
         and ci.pack_unit_id = p_pack_unit_id;
    end if;
    return private.price_cart(p_shop_id, v_uid, v_booker);
  end if;

  if not exists (select 1 from private.catalog_rows(p_shop_id, v_booker, array[p_distributor_product_id])) then
    raise exception 'product_unavailable' using errcode = 'P0002', detail = p_distributor_product_id::text;
  end if;
  if not exists (
    select 1 from public.pack_units pu
     where pu.id = p_pack_unit_id and pu.distributor_product_id = p_distributor_product_id
  ) then
    raise exception 'invalid_pack_unit' using errcode = '22023', detail = p_pack_unit_id::text;
  end if;

  if v_cart is null then
    insert into public.carts (shop_id, user_id) values (p_shop_id, v_uid)
    on conflict (shop_id, user_id) do update set updated_at = now()
    returning id into v_cart;
  end if;

  insert into public.cart_items (cart_id, distributor_product_id, pack_unit_id, quantity, added_via)
  values (v_cart, p_distributor_product_id, p_pack_unit_id, p_quantity, coalesce(p_source, 'manual'))
  on conflict (cart_id, distributor_product_id, pack_unit_id)
  do update set quantity = excluded.quantity, added_via = excluded.added_via;

  return private.price_cart(p_shop_id, v_uid, v_booker);
end;
$$;

create or replace function public.clear_cart(p_shop_id uuid, p_org_id uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  perform private.require_shop_buyer(p_shop_id);
  delete from public.cart_items ci
   using public.carts c
   where c.id = ci.cart_id
     and c.shop_id = p_shop_id
     and c.user_id = v_uid
     and (p_org_id is null or ci.org_id = p_org_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- delivery_slots(shop, org, days): the distributor's next delivery windows for this shop.
-- ---------------------------------------------------------------------------------------------
create or replace function public.delivery_slots(p_shop_id uuid, p_org_id uuid, p_days integer default 5)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
begin
  if p_org_id is null or p_org_id not in (select private.orderable_org_ids(p_shop_id, v_booker)) then
    raise exception 'org_unavailable' using errcode = 'P0002', detail = coalesce(p_org_id::text, 'null');
  end if;
  return query
    select s.slot_start, s.slot_end
      from private.delivery_slots_for(p_org_id, least(greatest(coalesce(p_days, 5), 1), 14)) s;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- place_order(shop, client_request_id, payment_method, slots, notes, org_ids)
-- Orders the cart's distributor groups (all, or only p_org_ids) in one transaction: all of
-- them or none. A retry with the same client_request_id returns the orders already placed.
-- Prices and schemes come from price_cart and are snapshotted into order_items.
-- p_slots: {"<org_id>": {"start": ts, "end": ts}} (one of that distributor's slots).
-- ---------------------------------------------------------------------------------------------
create or replace function public.place_order(
  p_shop_id uuid,
  p_client_request_id uuid,
  p_payment_method public.order_payment_method,
  p_slots jsonb,
  p_notes text default null,
  p_org_ids uuid[] default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_booker uuid := private.require_shop_buyer(p_shop_id);
  v_cart uuid;
  v_existing jsonb;
  v_summary jsonb;
  v_group jsonb;
  v_line jsonb;
  v_org uuid;
  v_account public.retailer_accounts%rowtype;
  v_settings jsonb;
  v_shop public.shops%rowtype;
  v_actor_name text;
  v_order_id uuid;
  v_number text;
  v_total bigint;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_available bigint;
  v_problem text;
  v_dp public.distributor_products%rowtype;
  v_pu public.pack_units%rowtype;
  v_scheme_id uuid;
  v_reward uuid;
  v_reward_unit public.pack_units%rowtype;
  v_free integer;
  v_orders jsonb := '[]'::jsonb;
  v_code bytea;
begin
  if p_client_request_id is null then
    raise exception 'client_request_id_required' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'notes_too_long' using errcode = '22023';
  end if;

  -- One checkout of this cart at a time; a concurrent retry waits here, then sees its orders.
  select c.id into v_cart from public.carts c where c.shop_id = p_shop_id and c.user_id = v_uid for update;

  select jsonb_agg(
           jsonb_build_object('id', o.id, 'order_number', o.order_number, 'org_id', o.org_id, 'total_paisa', o.total_paisa)
           order by o.order_number
         )
    into v_existing
    from public.orders o
   where o.shop_id = p_shop_id and o.client_request_id = p_client_request_id;
  if v_existing is not null then
    return jsonb_build_object('orders', v_existing);
  end if;
  if v_cart is null then
    raise exception 'cart_empty' using errcode = '55000';
  end if;

  v_summary := private.price_cart(p_shop_id, v_uid, v_booker, p_org_ids);
  if jsonb_array_length(v_summary -> 'groups') = 0 then
    raise exception 'cart_empty' using errcode = '55000';
  end if;

  select * into v_shop from public.shops where id = p_shop_id;
  select coalesce(nullif(p.full_name, ''), p.phone::text) into v_actor_name from public.profiles p where p.id = v_uid;

  for v_group in select g.value from jsonb_array_elements(v_summary -> 'groups') as g loop
    v_org := (v_group ->> 'org_id')::uuid;
    v_total := (v_group ->> 'total_paisa')::bigint;

    for v_line in select l.value from jsonb_array_elements(v_group -> 'items') as l loop
      if jsonb_array_length(v_line -> 'problems') > 0 then
        v_problem := v_line -> 'problems' ->> 0;
        raise exception '%', case v_problem
                               when 'inactive' then 'product_unavailable'
                               when 'below_moq' then 'below_minimum'
                               else v_problem
                             end
          using errcode = '23514',
                detail = coalesce(v_line -> 'item' ->> 'distributor_product_id', v_line ->> 'cart_item_id');
      end if;
    end loop;

    select * into v_account from public.retailer_accounts ra
     where ra.org_id = v_org and ra.shop_id = p_shop_id
       for update;
    if v_account.id is not null and v_account.status = 'blocked' then
      raise exception 'account_blocked' using errcode = '23514', detail = v_org::text;
    end if;
    if v_account.id is not null and v_account.status = 'on_hold' and p_payment_method = 'credit'
       and (v_account.hold_override_until is null or v_account.hold_override_until <= now()) then
      raise exception 'account_on_hold' using errcode = '23514', detail = v_org::text;
    end if;
    if not (v_group ->> 'meets_minimum')::boolean then
      raise exception 'below_minimum' using errcode = '23514', detail = v_org::text;
    end if;

    v_slot_start := (p_slots -> v_org::text ->> 'start')::timestamptz;
    v_slot_end := (p_slots -> v_org::text ->> 'end')::timestamptz;
    if v_slot_start is null or v_slot_end is null or not exists (
      select 1 from private.delivery_slots_for(v_org, 7) s
       where s.slot_start = v_slot_start and s.slot_end = v_slot_end
    ) then
      raise exception 'slot_unavailable' using errcode = '23514', detail = v_org::text;
    end if;

    if p_payment_method = 'credit' then
      -- Re-read under the account lock: another checkout may have used credit meanwhile.
      v_available := case when v_account.id is null then 0 else
        v_account.credit_limit_paisa - private.receivable_balance(v_org, p_shop_id) - private.open_credit_paisa(v_org, p_shop_id)
      end;
      if v_available < v_total then
        raise exception 'credit_limit_exceeded' using errcode = '23514', detail = v_org::text;
      end if;
    end if;

    if v_account.id is null then
      select o.settings into v_settings from public.organizations o where o.id = v_org;
      insert into public.retailer_accounts (org_id, shop_id, credit_limit_paisa, payment_terms_days, status)
      values (v_org, p_shop_id, 0, coalesce((v_settings ->> 'default_payment_terms_days')::integer, 0), 'active')
      returning * into v_account;
    end if;

    v_number := 'TD-' || lpad(private.next_counter('order_number')::text, 6, '0');
    insert into public.orders (
      order_number, shop_id, org_id, placed_by, placed_by_name, booker_id, source, status, payment_method,
      subtotal_paisa, scheme_discount_paisa, delivery_fee_paisa, total_paisa, ordered_total_paisa,
      delivery_slot_start, delivery_slot_end, delivery_address, notes, client_request_id
    )
    values (
      v_number, p_shop_id, v_org, v_uid, v_actor_name, v_booker,
      case when v_booker is not null then 'booker'::public.order_source else 'app'::public.order_source end,
      'new', p_payment_method,
      (v_group ->> 'subtotal_paisa')::bigint, (v_group ->> 'scheme_discount_paisa')::bigint,
      (v_group ->> 'delivery_charge_paisa')::bigint, v_total, v_total,
      v_slot_start, v_slot_end,
      jsonb_build_object(
        'shop_name', v_shop.name, 'line1', v_shop.address_line, 'area_id', v_shop.area_id,
        'lat', v_shop.lat, 'lng', v_shop.lng, 'phone', v_shop.phone
      ),
      nullif(btrim(coalesce(p_notes, '')), ''), p_client_request_id
    )
    returning id into v_order_id;

    for v_line in select l.value from jsonb_array_elements(v_group -> 'items') as l loop
      select * into v_dp from public.distributor_products where id = (v_line -> 'item' ->> 'distributor_product_id')::uuid;
      select * into v_pu from public.pack_units where id = (v_line ->> 'pack_unit_id')::uuid;
      v_scheme_id := (v_line -> 'scheme_applied' ->> 'id')::uuid;
      v_free := (v_line ->> 'free_base_qty')::integer;
      v_reward := null;
      if v_scheme_id is not null and v_free > 0 then
        select sp.distributor_product_id into v_reward
          from public.scheme_products sp
         where sp.scheme_id = v_scheme_id and sp.role = 'reward' and sp.distributor_product_id <> v_dp.id
         limit 1;
      end if;

      insert into public.order_items (
        order_id, org_id, shop_id, distributor_product_id, master_product_id, pack_unit_id, name, name_ur, sku,
        barcode, image_path, category_id, pack_unit, pack_label, base_qty_per_unit, quantity, piece_price_paisa,
        unit_price_paisa, mrp_paisa, scheme_id, free_base_qty, line_discount_paisa, line_total_paisa
      )
      values (
        v_order_id, v_org, p_shop_id, v_dp.id, v_dp.master_product_id, v_pu.id, v_dp.name,
        v_line -> 'item' ->> 'name_ur', v_dp.sku, v_dp.barcode, v_line -> 'item' ->> 'image_path', v_dp.category_id,
        v_pu.unit, v_pu.label, v_pu.base_qty, (v_line ->> 'quantity')::integer,
        (v_line ->> 'piece_price_paisa')::bigint, (v_line ->> 'unit_price_paisa')::bigint, v_dp.mrp_paisa,
        v_scheme_id, case when v_reward is null then v_free else 0 end,
        (v_line ->> 'line_discount_paisa')::bigint, (v_line ->> 'line_total_paisa')::bigint
      );

      -- Free goods of a different reward product travel as their own zero-quantity line.
      if v_reward is not null then
        select * into v_dp from public.distributor_products where id = v_reward;
        select * into v_reward_unit from public.pack_units
         where distributor_product_id = v_reward order by base_qty limit 1;
        insert into public.order_items (
          order_id, org_id, shop_id, distributor_product_id, master_product_id, pack_unit_id, name, name_ur, sku,
          barcode, image_path, category_id, pack_unit, pack_label, base_qty_per_unit, quantity, piece_price_paisa,
          unit_price_paisa, mrp_paisa, scheme_id, free_base_qty, line_discount_paisa, line_total_paisa
        )
        values (
          v_order_id, v_org, p_shop_id, v_dp.id, v_dp.master_product_id, v_reward_unit.id, v_dp.name, v_dp.name_ur,
          v_dp.sku, v_dp.barcode, v_dp.image_path, v_dp.category_id, v_reward_unit.unit, v_reward_unit.label,
          v_reward_unit.base_qty, 0, v_dp.trade_price_paisa, v_dp.trade_price_paisa * v_reward_unit.base_qty,
          v_dp.mrp_paisa, v_scheme_id, v_free, 0, 0
        );
      end if;
    end loop;

    insert into public.order_status_history (order_id, org_id, shop_id, from_status, to_status, changed_by, changed_by_name)
    values (v_order_id, v_org, p_shop_id, null, 'new', v_uid, v_actor_name);

    v_code := extensions.gen_random_bytes(2);
    insert into public.delivery_otps (order_id, shop_id, code)
    values (v_order_id, p_shop_id, lpad(((get_byte(v_code, 0) * 256 + get_byte(v_code, 1)) % 10000)::text, 4, '0'));

    perform private.notify_org(
      v_org, array['orders.view', 'orders.manage'], 'order',
      'New order ' || v_number,
      v_shop.name || ' · Rs ' || to_char(v_total / 100, 'FM999,999,999,990'),
      jsonb_build_object('event', 'order.created', 'order_id', v_order_id, 'order_number', v_number, 'shop_id', p_shop_id),
      '/distributor/orders/' || v_order_id
    );
    perform private.enqueue_webhook(
      v_org, 'order.created',
      jsonb_build_object('order_id', v_order_id, 'order_number', v_number, 'shop_id', p_shop_id, 'total_paisa', v_total)
    );

    update public.retailer_accounts set last_order_at = now() where id = v_account.id;
    delete from public.cart_items ci where ci.cart_id = v_cart and ci.org_id = v_org;

    v_orders := v_orders || jsonb_build_array(
      jsonb_build_object('id', v_order_id, 'order_number', v_number, 'org_id', v_org, 'total_paisa', v_total)
    );
  end loop;

  return jsonb_build_object('orders', v_orders);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- cancel_order(order, reason): the shop may cancel while the order is new or confirmed; the
-- distributor (orders.manage) any time before delivery. Releases reserved stock and tells the
-- other side.
-- ---------------------------------------------------------------------------------------------
create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
  v_shop_side boolean;
  v_org_side boolean;
  v_name text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_reason is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  v_shop_side := private.has_shop_permission(v_order.shop_id, 'orders');
  v_org_side := private.has_org_permission(v_order.org_id, 'orders.manage');
  if not (v_shop_side or v_org_side) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if not (
    (v_shop_side and v_order.status in ('new', 'confirmed'))
    or (v_org_side and v_order.status in ('new', 'confirmed', 'picking', 'packed', 'dispatched'))
  ) then
    raise exception 'cannot_cancel' using errcode = '55000', detail = v_order.status::text;
  end if;

  select coalesce(nullif(p.full_name, ''), p.phone::text) into v_name from public.profiles p where p.id = v_uid;

  update public.orders
     set status = 'cancelled', cancel_reason = v_reason, cancelled_by = v_uid, cancelled_at = now()
   where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, org_id, shop_id, from_status, to_status, changed_by, changed_by_name, note)
  select v_order.id, v_order.org_id, v_order.shop_id, h.to_status, 'cancelled', v_uid, v_name, v_reason
    from (select hh.to_status from public.order_status_history hh where hh.order_id = v_order.id
           order by hh.created_at desc limit 1) h;

  perform private.release_order_reservations(v_order.id, 'Order cancelled');

  if v_shop_side then
    perform private.notify_org(
      v_order.org_id, array['orders.view', 'orders.manage'], 'order',
      'Order ' || v_order.order_number || ' cancelled', v_reason,
      jsonb_build_object('event', 'order.cancelled', 'order_id', v_order.id, 'order_number', v_order.order_number),
      '/distributor/orders/' || v_order.id
    );
  else
    perform private.notify_shop(
      v_order.shop_id, array['orders'], 'order',
      'Order ' || v_order.order_number || ' cancelled', v_reason,
      jsonb_build_object('event', 'order.cancelled', 'order_id', v_order.id, 'order_number', v_order.order_number),
      '/dukan/orders/' || v_order.id
    );
  end if;
  perform private.enqueue_webhook(
    v_order.org_id, 'order.status_changed',
    jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'status', 'cancelled')
  );
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- reorder(order): puts the order's lines back in the cart at today's prices. Products that are
-- no longer orderable, or whose pack size is gone, are skipped and listed.
-- ---------------------------------------------------------------------------------------------
create or replace function public.reorder(p_order_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
  v_booker uuid;
  v_cart uuid;
  v_added integer := 0;
  v_skipped jsonb := '[]'::jsonb;
  r record;
begin
  select * into v_order from public.orders where id = p_order_id and deleted_at is null;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  v_booker := private.require_shop_buyer(v_order.shop_id);

  insert into public.carts (shop_id, user_id) values (v_order.shop_id, v_uid)
  on conflict (shop_id, user_id) do update set updated_at = now()
  returning id into v_cart;

  for r in
    select oi.name, oi.distributor_product_id, oi.pack_unit_id, oi.quantity,
           exists (select 1 from private.catalog_rows(v_order.shop_id, v_booker, array[oi.distributor_product_id])) as orderable,
           exists (select 1 from public.pack_units pu
                    where pu.id = oi.pack_unit_id and pu.distributor_product_id = oi.distributor_product_id) as unit_ok
      from public.order_items oi
     where oi.order_id = p_order_id and oi.deleted_at is null and oi.quantity > 0
     order by oi.created_at
  loop
    if not r.orderable then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('name', r.name, 'reason', 'unavailable'));
    elsif not r.unit_ok then
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object('name', r.name, 'reason', 'pack_unavailable'));
    else
      insert into public.cart_items (cart_id, distributor_product_id, pack_unit_id, quantity, added_via)
      values (v_cart, r.distributor_product_id, r.pack_unit_id, r.quantity, 'reorder')
      on conflict (cart_id, distributor_product_id, pack_unit_id)
      do update set quantity = least(public.cart_items.quantity + excluded.quantity, 100000), added_via = 'reorder';
      v_added := v_added + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'added', v_added,
    'skipped', v_skipped,
    'cart', private.price_cart(v_order.shop_id, v_uid, v_booker)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- rate_order(order, rating, comment): once, after delivery. Also a review of the distributor.
-- ---------------------------------------------------------------------------------------------
create or replace function public.rate_order(p_order_id uuid, p_rating smallint, p_comment text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
begin
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;
  if p_comment is not null and char_length(p_comment) > 1000 then
    raise exception 'comment_too_long' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found or not private.has_shop_permission(v_order.shop_id, 'orders') then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('delivered', 'partially_delivered') then
    raise exception 'not_delivered' using errcode = '55000', detail = v_order.status::text;
  end if;
  if v_order.rating is not null then
    raise exception 'already_rated' using errcode = '55000';
  end if;
  update public.orders set rating = p_rating where id = p_order_id;
  insert into public.reviews (target_type, org_id, reviewer_id, reviewer_shop_id, order_id, rating, comment)
  values ('organization', v_order.org_id, v_uid, v_order.shop_id, v_order.id, p_rating, nullif(btrim(coalesce(p_comment, '')), ''));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- request_return(order, items, notes, photo_paths): a claim for damaged, short, expired or
-- wrong goods within 7 days of delivery. p_items: [{order_item_id, base_qty, reason}].
-- A line cannot claim more than was delivered (counting earlier claims that were not
-- rejected). Each piece is valued at its invoiced net price.
-- ---------------------------------------------------------------------------------------------
create or replace function public.request_return(
  p_order_id uuid,
  p_items jsonb,
  p_notes text default null,
  p_photo_paths text[] default '{}'
)
returns public.returns
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.orders%rowtype;
  v_return public.returns%rowtype;
  v_item jsonb;
  v_line public.order_items%rowtype;
  v_qty integer;
  v_reason public.return_reason;
  v_delivered integer;
  v_claimed integer;
  v_piece bigint;
  v_reasons public.return_reason[] := '{}'::public.return_reason[];
  v_total bigint := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'notes_too_long' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_photo_paths), 0) > 6 then
    raise exception 'too_many_photos' using errcode = '22023';
  end if;
  select * into v_order from public.orders where id = p_order_id and deleted_at is null for update;
  if not found or not private.has_shop_permission(v_order.shop_id, 'orders') then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status not in ('delivered', 'partially_delivered') then
    raise exception 'not_delivered' using errcode = '55000', detail = v_order.status::text;
  end if;
  if v_order.delivered_at is null or v_order.delivered_at < now() - interval '7 days' then
    raise exception 'return_window_closed' using errcode = '55000';
  end if;

  insert into public.returns (return_number, org_id, shop_id, order_id, status, reason, notes, photo_paths, requested_by)
  values (
    'RT-' || lpad(private.next_counter('return_number')::text, 6, '0'), v_order.org_id, v_order.shop_id, v_order.id,
    'requested', 'other', nullif(btrim(coalesce(p_notes, '')), ''), coalesce(p_photo_paths, '{}'), v_uid
  )
  returning * into v_return;

  for v_item in select i.value from jsonb_array_elements(p_items) as i loop
    begin
      v_qty := (v_item ->> 'base_qty')::integer;
      v_reason := (v_item ->> 'reason')::public.return_reason;
    exception when others then
      raise exception 'invalid_item' using errcode = '22023', detail = v_item::text;
    end;
    if v_qty is null or v_qty <= 0 or v_reason is null then
      raise exception 'invalid_item' using errcode = '22023', detail = v_item::text;
    end if;
    select * into v_line from public.order_items
     where id = (v_item ->> 'order_item_id')::uuid and order_id = v_order.id and deleted_at is null;
    if not found then
      raise exception 'invalid_item' using errcode = '22023', detail = coalesce(v_item ->> 'order_item_id', 'null');
    end if;
    v_delivered := coalesce(v_line.delivered_base_qty, v_line.base_qty) + coalesce(v_line.free_delivered_base_qty, v_line.free_base_qty);
    select coalesce(sum(ri.base_qty), 0) into v_claimed
      from public.return_items ri
      join public.returns rt on rt.id = ri.return_id and rt.status <> 'rejected'
     where ri.order_item_id = v_line.id;
    if v_claimed + v_qty > v_delivered then
      raise exception 'return_exceeds_delivered' using errcode = '23514', detail = v_line.id::text;
    end if;
    -- Free goods are claimable but carry no value.
    v_piece := case
      when coalesce(v_line.delivered_base_qty, v_line.base_qty) > 0
        then coalesce(v_line.invoiced_total_paisa, v_line.line_total_paisa) / coalesce(v_line.delivered_base_qty, v_line.base_qty)
      else 0
    end;
    insert into public.return_items (return_id, org_id, shop_id, order_item_id, distributor_product_id, base_qty, reason, unit_price_paisa, amount_paisa)
    values (v_return.id, v_order.org_id, v_order.shop_id, v_line.id, v_line.distributor_product_id, v_qty, v_reason, v_piece,
            least(v_piece * v_qty, greatest(coalesce(v_line.invoiced_total_paisa, v_line.line_total_paisa), 0)));
    v_total := v_total + least(v_piece * v_qty, greatest(coalesce(v_line.invoiced_total_paisa, v_line.line_total_paisa), 0));
    v_reasons := array_append(v_reasons, v_reason);
  end loop;

  update public.returns
     set claim_total_paisa = v_total,
         reason = case when (select count(distinct x) from unnest(v_reasons) as x) = 1 then v_reasons[1] else 'other' end
   where id = v_return.id
  returning * into v_return;

  perform private.notify_org(
    v_order.org_id, array['orders.manage', 'credit.manage'], 'order',
    'Return claim ' || v_return.return_number,
    'Order ' || v_order.order_number || ' · Rs ' || to_char(v_total / 100, 'FM999,999,999,990'),
    jsonb_build_object('event', 'return.requested', 'return_id', v_return.id, 'order_id', v_order.id),
    '/distributor/orders/' || v_order.id
  );
  return v_return;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- shop_ledger(shop, org, from, to): the distributor's receivable account for this shop, the
-- single source of truth for "how much do I owe". balance_paisa > 0 means the shop owes.
-- Aging buckets the unpaid invoices by days past their due date (payments settle the oldest
-- invoices first).
-- ---------------------------------------------------------------------------------------------
create or replace function public.shop_ledger(
  p_shop_id uuid,
  p_org_id uuid,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account public.retailer_accounts%rowtype;
  v_org public.organizations%rowtype;
  v_balance bigint;
  v_opening bigint;
  v_entries jsonb;
  v_left bigint;
  v_today date := private.pkt_today();
  v_aging jsonb := jsonb_build_object('current', 0, 'd1_30', 0, 'd31_60', 0, 'd61_90', 0, 'd90_plus', 0);
  v_bucket text;
  v_take bigint;
  r record;
begin
  if not (
    private.has_shop_permission(p_shop_id, 'orders') or private.has_shop_permission(p_shop_id, 'reports')
  ) then
    perform private.require_shop_buyer(p_shop_id);
    if p_org_id not in (select private.orderable_org_ids(p_shop_id, private.require_shop_buyer(p_shop_id))) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  select * into v_org from public.organizations where id = p_org_id;
  if not found then
    raise exception 'org_not_found' using errcode = 'P0002';
  end if;
  select * into v_account from public.retailer_accounts where org_id = p_org_id and shop_id = p_shop_id;

  v_balance := private.receivable_balance(p_org_id, p_shop_id);

  select coalesce(sum(e.debit_paisa - e.credit_paisa), 0) into v_opening
    from public.ledger_entries e
    join public.ledger_accounts a on a.id = e.account_id and a.code = 'receivable'
   where e.org_id = p_org_id and e.counterparty_shop_id = p_shop_id and e.deleted_at is null
     and p_from is not null and e.entry_date < p_from;

  with lines as (
    select e.entry_date, e.created_at, e.id, e.debit_paisa, e.credit_paisa, e.memo, e.reference_type, e.reference_id
      from public.ledger_entries e
      join public.ledger_accounts a on a.id = e.account_id and a.code = 'receivable'
     where e.org_id = p_org_id and e.counterparty_shop_id = p_shop_id and e.deleted_at is null
       and (p_from is null or e.entry_date >= p_from)
       and (p_to is null or e.entry_date <= p_to)
  ),
  described as (
    select l.*,
           case l.reference_type
             when 'order' then 'invoice'
             when 'payment' then 'payment'
             when 'credit_note' then 'credit_note'
             else 'adjustment'
           end as kind,
           case l.reference_type
             when 'order' then (select o.order_number from public.orders o where o.id = l.reference_id)
             when 'payment' then (select coalesce(p.reference_no, initcap(p.method::text)) from public.payments p where p.id = l.reference_id)
             when 'credit_note' then (select cn.credit_note_number from public.credit_notes cn where cn.id = l.reference_id)
           end as reference,
           v_opening + sum(l.debit_paisa - l.credit_paisa) over (order by l.entry_date, l.created_at, l.id) as running
      from lines l
  )
  select coalesce(jsonb_agg(
           jsonb_build_object(
             'date', d.entry_date, 'kind', d.kind, 'reference', d.reference, 'description', d.memo,
             'debit_paisa', d.debit_paisa, 'credit_paisa', d.credit_paisa, 'balance_paisa', d.running
           )
           order by d.entry_date, d.created_at, d.id
         ), '[]'::jsonb)
    into v_entries
    from described d;

  -- Unpaid invoices: the newest invoices make up the outstanding balance.
  v_left := greatest(v_balance, 0);
  for r in
    select e.debit_paisa, coalesce(e.due_date, e.entry_date) as due
      from public.ledger_entries e
      join public.ledger_accounts a on a.id = e.account_id and a.code = 'receivable'
     where e.org_id = p_org_id and e.counterparty_shop_id = p_shop_id and e.deleted_at is null
       and e.debit_paisa > 0
     order by e.entry_date desc, e.created_at desc
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.debit_paisa);
    v_bucket := case
      when v_today <= r.due then 'current'
      when v_today - r.due <= 30 then 'd1_30'
      when v_today - r.due <= 60 then 'd31_60'
      when v_today - r.due <= 90 then 'd61_90'
      else 'd90_plus'
    end;
    v_aging := jsonb_set(v_aging, array[v_bucket], to_jsonb((v_aging ->> v_bucket)::bigint + v_take));
    v_left := v_left - v_take;
  end loop;

  return jsonb_build_object(
    'org', jsonb_build_object('id', v_org.id, 'name', v_org.name, 'logo_path', v_org.logo_path),
    'account_status', coalesce(v_account.status::text, 'none'),
    'credit_limit_paisa', coalesce(v_account.credit_limit_paisa, 0),
    'payment_terms_days', coalesce(v_account.payment_terms_days, 0),
    'balance_paisa', v_balance,
    'available_credit_paisa', case when v_account.id is null then 0 else greatest(
      v_account.credit_limit_paisa - v_balance - private.open_credit_paisa(p_org_id, p_shop_id), 0
    ) end,
    'aging', v_aging,
    'opening_balance_paisa', v_opening,
    'entries', v_entries
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- shop_distributors(shop): every distributor the shop can order from, with its terms, the
-- shop's account and balance there, and its rating from retailers.
-- ---------------------------------------------------------------------------------------------
create or replace function public.shop_distributors(p_shop_id uuid)
returns table (
  org_id uuid,
  name text,
  logo_path text,
  area_name text,
  min_order_paisa bigint,
  delivery_fee_paisa bigint,
  free_delivery_above_paisa bigint,
  account_status text,
  credit_limit_paisa bigint,
  balance_paisa bigint,
  product_count bigint,
  rating numeric,
  rating_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booker uuid := private.require_shop_buyer(p_shop_id);
begin
  return query
  with counts as (
    select c.org_id, count(*) as n from private.catalog_rows(p_shop_id, v_booker) c group by c.org_id
  )
  select o.id, o.name, o.logo_path, sa.name, o.min_order_paisa, o.delivery_fee_paisa, o.free_delivery_above_paisa,
         coalesce(ra.status::text, 'none'), coalesce(ra.credit_limit_paisa, 0),
         private.receivable_balance(o.id, p_shop_id),
         coalesce(k.n, 0),
         (select round(avg(rv.rating)::numeric, 1) from public.reviews rv
           where rv.org_id = o.id and rv.target_type = 'organization' and rv.is_published),
         (select count(*)::integer from public.reviews rv
           where rv.org_id = o.id and rv.target_type = 'organization' and rv.is_published)
    from public.organizations o
    left join public.service_areas sa on sa.id = o.area_id
    left join public.retailer_accounts ra on ra.org_id = o.id and ra.shop_id = p_shop_id
    left join counts k on k.org_id = o.id
   where o.id in (select private.orderable_org_ids(p_shop_id, v_booker))
   order by (ra.id is not null) desc, coalesce(k.n, 0) desc, o.name;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges: signed-in users only (each function checks the shop itself).
-- ---------------------------------------------------------------------------------------------
revoke execute on function
  public.search_catalog(uuid, text, integer),
  public.browse_catalog(uuid, uuid, uuid, uuid, text, jsonb, integer, integer),
  public.catalog_facets(uuid, uuid),
  public.product_detail(uuid, uuid),
  public.shop_home_feed(uuid),
  public.cart_summary(uuid),
  public.set_cart_item(uuid, uuid, uuid, integer, public.cart_item_source),
  public.clear_cart(uuid, uuid),
  public.delivery_slots(uuid, uuid, integer),
  public.place_order(uuid, uuid, public.order_payment_method, jsonb, text, uuid[]),
  public.cancel_order(uuid, text),
  public.reorder(uuid),
  public.rate_order(uuid, smallint, text),
  public.request_return(uuid, jsonb, text, text[]),
  public.shop_ledger(uuid, uuid, date, date),
  public.shop_distributors(uuid)
from public, anon;

grant execute on function
  public.search_catalog(uuid, text, integer),
  public.browse_catalog(uuid, uuid, uuid, uuid, text, jsonb, integer, integer),
  public.catalog_facets(uuid, uuid),
  public.product_detail(uuid, uuid),
  public.shop_home_feed(uuid),
  public.cart_summary(uuid),
  public.set_cart_item(uuid, uuid, uuid, integer, public.cart_item_source),
  public.clear_cart(uuid, uuid),
  public.delivery_slots(uuid, uuid, integer),
  public.place_order(uuid, uuid, public.order_payment_method, jsonb, text, uuid[]),
  public.cancel_order(uuid, text),
  public.reorder(uuid),
  public.rate_order(uuid, smallint, text),
  public.request_return(uuid, jsonb, text, text[]),
  public.shop_ledger(uuid, uuid, date, date),
  public.shop_distributors(uuid)
to authenticated, service_role;
