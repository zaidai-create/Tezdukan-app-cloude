-- The customer app: browse what nearby dukans sell online. RLS keeps a dukan's inventory and
-- storefront settings private to its staff, so customers read them through these definer
-- functions, which return only what a live storefront shows: products marked visible online,
-- their selling price, and the shop's delivery terms.

-- Products on sale at live storefronts, optionally for one category, shop or search.
create or replace function public.storefront_products(
  p_category_id uuid default null,
  p_query text default null,
  p_shop_id uuid default null,
  p_limit integer default 60
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.in_stock desc, x.is_favourite desc, x.name), '[]'::jsonb)
    from (
      select i.id, i.shop_id, s.name as shop_name, s.slug as shop_slug,
             i.name, i.name_ur, i.pack_size_label, i.unit::text as unit, i.is_loose,
             i.selling_price_paisa, i.mrp_paisa, i.category_id, i.is_favourite,
             i.qty_on_hand > 0 as in_stock,
             i.qty_on_hand > 0 and i.qty_on_hand <= i.low_stock_threshold as low_stock,
             coalesce(
               i.image_path,
               mp.image_path,
               (select pi.path from public.product_images pi
                 where pi.master_product_id = i.master_product_id
                 order by pi.sort_order limit 1)
             ) as image_path
        from public.shop_inventory i
        left join public.master_products mp on mp.id = i.master_product_id
        join public.shops s on s.id = i.shop_id and s.status = 'approved'
        join public.storefront_settings ss on ss.shop_id = s.id and ss.is_live
       where i.is_active and i.is_visible_online
         and (p_category_id is null or i.category_id = p_category_id)
         and (p_shop_id is null or i.shop_id = p_shop_id)
         and (
           nullif(btrim(p_query), '') is null
           or i.name ilike '%' || btrim(p_query) || '%'
           or i.name_ur ilike '%' || btrim(p_query) || '%'
         )
       order by i.qty_on_hand > 0 desc, i.is_favourite desc, i.name
       limit least(greatest(coalesce(p_limit, 60), 1), 200)
    ) x
$$;

-- Top-level categories with how many products live storefronts sell in each.
create or replace function public.storefront_categories()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.sort_order, x.name), '[]'::jsonb)
    from (
      select c.id, c.name, c.name_ur, c.slug, c.image_path, c.tint, c.sort_order,
             (select count(*)::integer
                from public.shop_inventory i
                join public.shops s on s.id = i.shop_id and s.status = 'approved'
                join public.storefront_settings ss on ss.shop_id = s.id and ss.is_live
               where i.category_id = c.id and i.is_active and i.is_visible_online) as product_count
        from public.categories c
       where c.parent_id is null and c.is_active
    ) x
$$;

-- One dukan's storefront: signboard, delivery terms and its products.
create or replace function public.storefront_shop(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', s.id, 'name', s.name, 'slug', s.slug, 'description', s.description,
           'address_line', s.address_line, 'phone', s.phone, 'whatsapp', s.whatsapp,
           'photo_path', s.photo_path, 'area_name', a.name, 'area_name_ur', a.name_ur,
           'is_live', coalesce(ss.is_live, false), 'tagline', ss.tagline,
           'eta_minutes', ss.eta_minutes, 'min_order_paisa', coalesce(ss.min_order_paisa, 0),
           'delivery_fee_paisa', coalesce(ss.delivery_fee_paisa, 0),
           'free_delivery_above_paisa', ss.free_delivery_above_paisa,
           'pickup_enabled', coalesce(ss.pickup_enabled, false),
           'products', public.storefront_products(null, null, s.id, 200)
         )
    from public.shops s
    left join public.service_areas a on a.id = s.area_id
    left join public.storefront_settings ss on ss.shop_id = s.id
   where s.slug = p_slug and s.status = 'approved'
$$;

-- Nearby dukans now also say whether they sell online and their delivery terms.
create or replace function public.nearby_dukans(
  p_lat numeric default null,
  p_lng numeric default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.is_live desc, x.distance_m nulls last, x.name), '[]'::jsonb)
    from (
      select s.id, s.name, s.slug, s.kind, s.address_line, s.phone, s.whatsapp, s.photo_path,
             a.name as area_name, a.name_ur as area_name_ur,
             coalesce(ss.is_live, false) as is_live, ss.tagline, ss.eta_minutes,
             coalesce(ss.min_order_paisa, 0) as min_order_paisa,
             coalesce(ss.delivery_fee_paisa, 0) as delivery_fee_paisa,
             ss.free_delivery_above_paisa,
             case
               when p_lat is null or p_lng is null then null
               else round(extensions.st_distance(s.location, private.make_point(p_lat, p_lng)))::integer
             end as distance_m
        from public.shops s
        left join public.service_areas a on a.id = s.area_id
        left join public.storefront_settings ss on ss.shop_id = s.id
       where s.status = 'approved'
       order by coalesce(ss.is_live, false) desc, distance_m nulls last, s.name
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) x
$$;

revoke execute on function public.storefront_products(uuid, text, uuid, integer) from public, anon;
revoke execute on function public.storefront_categories() from public, anon;
revoke execute on function public.storefront_shop(text) from public, anon;
grant execute on function public.storefront_products(uuid, text, uuid, integer) to authenticated;
grant execute on function public.storefront_categories() to authenticated;
grant execute on function public.storefront_shop(text) to authenticated;
