-- Delivery areas. Every dukan has a pin and a delivery radius (1 to 5 km, or the whole city when
-- the TezDukan team allows it). A customer only sees the dukans whose radius covers where they
-- are, and only those dukans' products; an order outside the radius is refused.

-- Does this dukan deliver to this point? Dukans without a pin only serve customers when they
-- deliver across the whole city.
create or replace function private.delivers_to(
  p_location extensions.geography,
  p_radius_m integer,
  p_all_city boolean,
  p_lat numeric,
  p_lng numeric
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_all_city, false)
      or (
        p_location is not null and p_lat is not null and p_lng is not null
        and extensions.st_dwithin(p_location, private.make_point(p_lat, p_lng), coalesce(p_radius_m, 3000))
      )
$$;

create or replace function public.shop_delivers_to(p_shop_id uuid, p_lat numeric, p_lng numeric)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.delivers_to(s.location, ss.delivery_radius_m, ss.serves_all_city, p_lat, p_lng)
      from public.shops s
      join public.storefront_settings ss on ss.shop_id = s.id
     where s.id = p_shop_id
  ), false)
$$;

-- Nearby dukans: with a location, only those that deliver there, nearest first. Without one, the
-- app asks for the location first, so the list is the fallback for older clients.
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
             coalesce(ss.delivery_radius_m, 3000) as delivery_radius_m,
             r.rating, r.rating_count,
             case
               when p_lat is null or p_lng is null or s.location is null then null
               else round(extensions.st_distance(s.location, private.make_point(p_lat, p_lng)))::integer
             end as distance_m
        from public.shops s
        left join public.service_areas a on a.id = s.area_id
        left join public.storefront_settings ss on ss.shop_id = s.id
        cross join lateral (
          select round(avg(rv.rating), 1) as rating, count(*)::integer as rating_count
            from public.reviews rv
           where rv.target_type = 'shop' and rv.shop_id = s.id and rv.is_published
        ) r
       where s.status = 'approved'
         and (
           p_lat is null or p_lng is null
           or private.delivers_to(s.location, ss.delivery_radius_m, ss.serves_all_city, p_lat, p_lng)
         )
       order by coalesce(ss.is_live, false) desc, distance_m nulls last, s.name
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) x
$$;

-- Products from live dukans; with a location (and no single dukan asked for), only from dukans
-- that deliver there. The new arguments come last so existing calls keep working.
drop function if exists public.storefront_products(uuid, text, uuid, integer);
create function public.storefront_products(
  p_category_id uuid default null,
  p_query text default null,
  p_shop_id uuid default null,
  p_limit integer default 60,
  p_lat numeric default null,
  p_lng numeric default null
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
           p_shop_id is not null or p_lat is null or p_lng is null
           or private.delivers_to(s.location, ss.delivery_radius_m, ss.serves_all_city, p_lat, p_lng)
         )
         and (
           nullif(btrim(p_query), '') is null
           or i.name ilike '%' || btrim(p_query) || '%'
           or i.name_ur ilike '%' || btrim(p_query) || '%'
         )
       order by i.qty_on_hand > 0 desc, i.is_favourite desc, i.name
       limit least(greatest(coalesce(p_limit, 60), 1), 200)
    ) x
$$;

-- The "Online dukan" screen also shows the pin and the delivery radius.
create or replace function public.shop_storefront(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if p_shop_id is null or p_shop_id not in (select private.my_shop_ids()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
             'shop_id', s.id, 'name', s.name, 'slug', s.slug,
             'is_approved', s.status = 'approved',
             'is_live', coalesce(ss.is_live, false),
             'tagline', ss.tagline,
             'eta_minutes', coalesce(ss.eta_minutes, 45),
             'min_order_paisa', coalesce(ss.min_order_paisa, 0),
             'delivery_fee_paisa', coalesce(ss.delivery_fee_paisa, 0),
             'free_delivery_above_paisa', ss.free_delivery_above_paisa,
             'delivery_radius_m', coalesce(ss.delivery_radius_m, 3000),
             'serves_all_city', coalesce(ss.serves_all_city, false),
             'lat', s.lat, 'lng', s.lng, 'address_line', s.address_line,
             'visible_products', (
               select count(*)::integer from public.shop_inventory i
                where i.shop_id = s.id and i.is_active and i.is_visible_online and i.qty_on_hand > 0
             ),
             'can_edit', private.has_shop_permission(s.id, 'storefront')
           )
      from public.shops s
      left join public.storefront_settings ss on ss.shop_id = s.id
     where s.id = p_shop_id
  );
end;
$$;

-- update_shop_storefront gains the delivery radius (1 to 5 km for the dukandar).
drop function if exists public.update_shop_storefront(uuid, boolean, integer, bigint, bigint, bigint, text);
create function public.update_shop_storefront(
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
  if p_delivery_radius_m is not null and p_delivery_radius_m not between 500 and 5000 then
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

-- The dukandar sets the dukan's pin, standing in the dukan and using the phone's location.
create or replace function public.update_shop_location(p_shop_id uuid, p_lat numeric, p_lng numeric)
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
  -- Roughly Pakistan, so a mistyped or spoofed point cannot land the dukan elsewhere.
  if p_lat is null or p_lng is null or p_lat not between 23 and 37.5 or p_lng not between 60 and 78 then
    raise exception 'invalid_location' using errcode = '22023';
  end if;
  update public.shops set lat = round(p_lat, 6), lng = round(p_lng, 6) where id = p_shop_id;
  perform private.audit(
    'shop.location_set', 'shop', p_shop_id, null, p_shop_id, null,
    jsonb_build_object('lat', round(p_lat, 6), 'lng', round(p_lng, 6))
  );
  return public.shop_storefront(p_shop_id);
end;
$$;

-- The TezDukan team can set any dukan's radius, up to 15 km, or let it serve the whole city.
create or replace function public.admin_set_shop_delivery(p_shop_id uuid, p_radius_m integer, p_all_city boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.storefront_settings%rowtype;
begin
  perform private.require_admin();
  if p_radius_m is null or p_radius_m not between 500 and 15000 or p_all_city is null then
    raise exception 'invalid_radius' using errcode = '22023';
  end if;
  select * into v_before from public.storefront_settings where shop_id = p_shop_id;
  insert into public.storefront_settings as ss (shop_id, delivery_radius_m, serves_all_city)
  values (p_shop_id, p_radius_m, p_all_city)
  on conflict (shop_id) do update
     set delivery_radius_m = p_radius_m, serves_all_city = p_all_city;
  perform private.audit(
    'shop.delivery_area', 'shop', p_shop_id, null, p_shop_id,
    jsonb_build_object('radius_m', v_before.delivery_radius_m, 'all_city', v_before.serves_all_city),
    jsonb_build_object('radius_m', p_radius_m, 'all_city', p_all_city)
  );
  return jsonb_build_object('radius_m', p_radius_m, 'all_city', p_all_city);
end;
$$;

-- Admin's dukan list also shows each dukan's delivery area.
create or replace function public.admin_shops(
  p_status text default null,
  p_query text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := private.phone_digits(p_query);
begin
  perform private.require_staff();
  return (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (
        select s.id, s.name, s.slug, s.status::text as status, s.tier::text as tier, s.phone,
               s.address_line, a.name as area, s.created_at, s.rejection_reason,
               p.full_name as owner_name, p.phone as owner_phone,
               coalesce(ss.is_live, false) as is_live,
               coalesce(ss.delivery_radius_m, 3000) as delivery_radius_m,
               coalesce(ss.serves_all_city, false) as serves_all_city,
               s.lat, s.lng,
               (select count(*)::integer from public.shop_inventory i
                 where i.shop_id = s.id and i.is_active and i.is_visible_online and i.qty_on_hand > 0) as products,
               o.orders as orders_30d, o.sales as sales_30d,
               r.rating, r.rating_count
          from public.shops s
          left join public.service_areas a on a.id = s.area_id
          left join public.profiles p on p.id = s.owner_id
          left join public.storefront_settings ss on ss.shop_id = s.id
          cross join lateral (
            select (count(*) filter (where co.status not in ('cancelled', 'rejected')))::integer as orders,
                   coalesce(sum(co.total_paisa) filter (where co.status = 'delivered'), 0) as sales
              from public.customer_orders co
             where co.shop_id = s.id and co.deleted_at is null
               and co.created_at >= now() - interval '30 days'
          ) o
          cross join lateral (
            select round(avg(rv.rating), 1) as rating, count(*)::integer as rating_count
              from public.reviews rv
             where rv.target_type = 'shop' and rv.shop_id = s.id and rv.is_published
          ) r
         where (p_status is null or s.status::text = p_status)
           and (
             v_query is null
             or s.name ilike '%' || v_query || '%'
             or p.full_name ilike '%' || v_query || '%'
             or a.name ilike '%' || v_query || '%'
             or (v_digits is not null and (s.phone like '%' || v_digits || '%' or p.phone like '%' || v_digits || '%'))
           )
         order by s.created_at desc
         limit least(greatest(coalesce(p_limit, 100), 1), 200)
      ) x
  );
end;
$$;

-- Hyderabad's zones with their centre, for customers who pick an area instead of sharing GPS.
create or replace function public.delivery_zones()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'name', a.name, 'name_ur', a.name_ur, 'lat', a.center_lat, 'lng', a.center_lng
         ) order by a.sort_order, a.name), '[]'::jsonb)
    from public.service_areas a
   where a.is_active and a.kind = 'zone' and a.center_lat is not null
$$;

revoke execute on function private.delivers_to(extensions.geography, integer, boolean, numeric, numeric) from public, anon;
revoke execute on function public.shop_delivers_to(uuid, numeric, numeric) from public, anon;
revoke execute on function public.storefront_products(uuid, text, uuid, integer, numeric, numeric) from public, anon;
revoke execute on function public.update_shop_storefront(uuid, boolean, integer, bigint, bigint, bigint, text, integer) from public, anon;
revoke execute on function public.update_shop_location(uuid, numeric, numeric) from public, anon;
revoke execute on function public.admin_set_shop_delivery(uuid, integer, boolean) from public, anon;
revoke execute on function public.delivery_zones() from public, anon;
grant execute on function public.shop_delivers_to(uuid, numeric, numeric) to authenticated;
grant execute on function public.storefront_products(uuid, text, uuid, integer, numeric, numeric) to authenticated;
grant execute on function public.update_shop_storefront(uuid, boolean, integer, bigint, bigint, bigint, text, integer) to authenticated;
grant execute on function public.update_shop_location(uuid, numeric, numeric) to authenticated;
grant execute on function public.admin_set_shop_delivery(uuid, integer, boolean) to authenticated;
grant execute on function public.delivery_zones() to authenticated;
