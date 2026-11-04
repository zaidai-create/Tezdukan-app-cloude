-- Dukandars upload their own photos: product photos from the phone's gallery or camera, and the
-- dukan's logo and banner (like a Daraz store page). Product photos live in the public
-- product-images bucket under shop/<shop_id>/, logo and banner in shop-media under
-- shop/<shop_id>/ (already allowed for storefront and settings staff).

create policy product_images_shop_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'shop'
    and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_permission('inventory'))
  );

create policy product_images_shop_update on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'shop'
    and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_permission('inventory'))
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'shop'
    and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_permission('inventory'))
  );

create policy product_images_shop_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'shop'
    and private.try_uuid((storage.foldername(name))[2]) in (select private.shop_ids_with_permission('inventory'))
  );

-- The dukan's logo, banner and a short "about". Paths must sit in the dukan's own folder, so
-- nobody can point a dukan at someone else's picture. Empty text clears a field; null keeps it.
create or replace function public.update_shop_profile(
  p_shop_id uuid,
  p_photo_path text default null,
  p_cover_path text default null,
  p_description text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_prefix text := 'shop/' || p_shop_id::text || '/';
  v_shop public.shops%rowtype;
begin
  perform private.require_user();
  if p_shop_id is null or p_shop_id not in (select private.shop_ids_with_any_permission(array['storefront', 'settings'])) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if (nullif(p_photo_path, '') is not null and left(p_photo_path, char_length(v_prefix)) <> v_prefix)
     or (nullif(p_cover_path, '') is not null and left(p_cover_path, char_length(v_prefix)) <> v_prefix) then
    raise exception 'invalid_path' using errcode = '22023';
  end if;

  update public.shops
     set photo_path = case when p_photo_path is null then photo_path else nullif(p_photo_path, '') end,
         cover_path = case when p_cover_path is null then cover_path else nullif(p_cover_path, '') end,
         description = case
           when p_description is null then description
           else nullif(left(btrim(p_description), 500), '')
         end
   where id = p_shop_id
  returning * into v_shop;

  return jsonb_build_object(
    'photo_path', v_shop.photo_path, 'cover_path', v_shop.cover_path, 'description', v_shop.description
  );
end;
$$;

-- The "Online dukan" screen shows the logo, banner and about text too.
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
             'photo_path', s.photo_path, 'cover_path', s.cover_path, 'description', s.description,
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

-- Customers see the banner on the dukan page.
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
           'photo_path', s.photo_path, 'cover_path', s.cover_path,
           'area_name', a.name, 'area_name_ur', a.name_ur,
           'is_live', coalesce(ss.is_live, false), 'tagline', ss.tagline,
           'eta_minutes', ss.eta_minutes, 'min_order_paisa', coalesce(ss.min_order_paisa, 0),
           'delivery_fee_paisa', coalesce(ss.delivery_fee_paisa, 0),
           'free_delivery_above_paisa', ss.free_delivery_above_paisa,
           'pickup_enabled', coalesce(ss.pickup_enabled, false),
           'rating', r.rating, 'rating_count', r.rating_count,
           'reviews', (
             select coalesce(jsonb_agg(v order by v.created_at desc), '[]'::jsonb)
               from (
                 select rv.id, rv.rating, rv.comment, rv.created_at
                   from public.reviews rv
                  where rv.target_type = 'shop' and rv.shop_id = s.id and rv.is_published
                    and rv.comment is not null
                  order by rv.created_at desc
                  limit 5
               ) v
           ),
           'products', public.storefront_products(null, null, s.id, 200)
         )
    from public.shops s
    left join public.service_areas a on a.id = s.area_id
    left join public.storefront_settings ss on ss.shop_id = s.id
    cross join lateral (
      select round(avg(rv.rating), 1) as rating, count(*)::integer as rating_count
        from public.reviews rv
       where rv.target_type = 'shop' and rv.shop_id = s.id and rv.is_published
    ) r
   where s.slug = p_slug and s.status = 'approved'
$$;

revoke execute on function public.update_shop_profile(uuid, text, text, text) from public, anon;
grant execute on function public.update_shop_profile(uuid, text, text, text) to authenticated;
