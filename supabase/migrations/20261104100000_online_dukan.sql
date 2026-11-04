-- The dukandar switches the online dukan on or off and sets the delivery terms from the app.
-- Until now nothing in the app could do it, so a new dukan that had added its products still
-- told every customer "This dukan doesn't take online orders yet".

-- What the "Online dukan" screen shows. Any active member may read it; can_edit says whether
-- this person may change it.
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

-- Switch online orders on or off and, optionally, change the delivery terms. A null argument
-- keeps what is there; 0 for "free delivery above" and an empty tagline clear them. Going
-- online needs at least one product customers can buy, so customers never meet an empty dukan.
create or replace function public.update_shop_storefront(
  p_shop_id uuid,
  p_is_live boolean,
  p_eta_minutes integer default null,
  p_min_order_paisa bigint default null,
  p_delivery_fee_paisa bigint default null,
  p_free_delivery_above_paisa bigint default null,
  p_tagline text default null
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
  if coalesce(p_min_order_paisa, 0) not between 0 and 10000000
     or coalesce(p_delivery_fee_paisa, 0) not between 0 and 100000
     or coalesce(p_free_delivery_above_paisa, 0) not between 0 and 10000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  insert into public.storefront_settings as ss (
    shop_id, is_live, eta_minutes, min_order_paisa, delivery_fee_paisa, free_delivery_above_paisa, tagline
  )
  values (
    p_shop_id, p_is_live, coalesce(p_eta_minutes, 45), coalesce(p_min_order_paisa, 0),
    coalesce(p_delivery_fee_paisa, 0), nullif(p_free_delivery_above_paisa, 0),
    nullif(left(btrim(coalesce(p_tagline, '')), 120), '')
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
         end;

  return public.shop_storefront(p_shop_id);
end;
$$;

revoke execute on function public.shop_storefront(uuid) from public, anon;
revoke execute on function public.update_shop_storefront(uuid, boolean, integer, bigint, bigint, bigint, text) from public, anon;
grant execute on function public.shop_storefront(uuid) to authenticated;
grant execute on function public.update_shop_storefront(uuid, boolean, integer, bigint, bigint, bigint, text) to authenticated;
