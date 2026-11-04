-- Customers see each dukan's star rating (from delivered orders) on its card and its page, with
-- the latest comments. Dukandars get a sales report: one call per period with totals, the same
-- figures for the period before, sales by time of day or by day, and the best sellers.

create index if not exists customer_orders_shop_created_idx
  on public.customer_orders (shop_id, created_at)
  where deleted_at is null;

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
             r.rating, r.rating_count,
             case
               when p_lat is null or p_lng is null then null
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
       order by coalesce(ss.is_live, false) desc, distance_m nulls last, s.name
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) x
$$;

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
           'rating', r.rating, 'rating_count', r.rating_count,
           -- Comments only, no names: a rating comes from a delivered order, which is all a
           -- shopper needs to trust it.
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

-- One period's figures for a dukan's online orders. Sales are delivered orders (the cash the
-- dukan has collected); profit uses each product's buying price and leaves out lines whose
-- buying price is not known, so costed_paisa says how much of the sales it covers.
create or replace function private.shop_sales_totals(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with period_orders as (
    select o.id, o.status, o.total_paisa, o.customer_id
      from public.customer_orders o
     where o.shop_id = p_shop_id and o.deleted_at is null
       and o.created_at >= p_from and o.created_at < p_to
  ),
  lines as (
    select coi.line_total_paisa, coi.qty, coi.unit_price_paisa, coalesce(inv.cost_price_paisa, 0) as cost_paisa
      from public.customer_order_items coi
      join period_orders po on po.id = coi.customer_order_id and po.status = 'delivered'
      left join public.shop_inventory inv on inv.id = coi.inventory_id
  )
  select jsonb_build_object(
    'sales_paisa', coalesce((select sum(total_paisa) from period_orders where status = 'delivered'), 0),
    'orders', (select count(*) from period_orders where status not in ('cancelled', 'rejected')),
    'delivered', (select count(*) from period_orders where status = 'delivered'),
    'cancelled', (select count(*) from period_orders where status in ('cancelled', 'rejected')),
    'in_progress', (
      select count(*) from period_orders where status in ('placed', 'accepted', 'packed', 'out_for_delivery')
    ),
    'in_progress_paisa', coalesce((
      select sum(total_paisa) from period_orders where status in ('placed', 'accepted', 'packed', 'out_for_delivery')
    ), 0),
    'customers', (
      select count(distinct customer_id) from period_orders where status not in ('cancelled', 'rejected')
    ),
    -- Whole rupees: an average bill of "Rs 840.60" is noise on a phone.
    'avg_bill_paisa', coalesce((
      select (round(avg(total_paisa) / 100) * 100)::bigint from period_orders where status = 'delivered'
    ), 0),
    'goods_paisa', coalesce((select sum(line_total_paisa) from lines), 0),
    'costed_paisa', coalesce((select sum(line_total_paisa) from lines where cost_paisa > 0), 0),
    'profit_paisa', coalesce((
      select round(sum(qty * (unit_price_paisa - cost_paisa)))::bigint from lines where cost_paisa > 0
    ), 0)
  )
$$;

-- The dukandar's sales report for today, yesterday, the last 7 days or the last 30 days.
-- "Today" and the multi-day periods are compared with the period before up to the same time of
-- day, so a morning is never set against a whole day.
create or replace function public.shop_sales_report(p_shop_id uuid, p_range text default 'today')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Karachi')::date;
  v_tomorrow timestamptz := (v_today + 1)::timestamp at time zone 'Asia/Karachi';
  v_from timestamptz;
  v_to timestamptz;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
begin
  perform private.require_user();
  if p_shop_id is null or not private.has_shop_permission(p_shop_id, 'reports') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  case coalesce(p_range, '')
    when 'today' then
      v_from := v_today::timestamp at time zone 'Asia/Karachi';
      v_to := v_tomorrow;
      v_prev_from := v_from - interval '1 day';
      v_prev_to := v_now - interval '1 day';
    when 'yesterday' then
      v_from := (v_today - 1)::timestamp at time zone 'Asia/Karachi';
      v_to := v_today::timestamp at time zone 'Asia/Karachi';
      v_prev_from := v_from - interval '1 day';
      v_prev_to := v_from;
    when 'week' then
      v_from := (v_today - 6)::timestamp at time zone 'Asia/Karachi';
      v_to := v_tomorrow;
      v_prev_from := v_from - interval '7 days';
      v_prev_to := v_now - interval '7 days';
    when 'month' then
      v_from := (v_today - 29)::timestamp at time zone 'Asia/Karachi';
      v_to := v_tomorrow;
      v_prev_from := v_from - interval '30 days';
      v_prev_to := v_now - interval '30 days';
    else
      raise exception 'invalid_range' using errcode = '22023';
  end case;

  return jsonb_build_object(
    'range', p_range,
    'from', (v_from at time zone 'Asia/Karachi')::date,
    'to', (v_to at time zone 'Asia/Karachi')::date - 1,
    'totals', private.shop_sales_totals(p_shop_id, v_from, v_to),
    'previous', private.shop_sales_totals(p_shop_id, v_prev_from, v_prev_to),
    -- One-day periods: eight 3-hour slots by the time the order was placed. Longer periods: one
    -- entry per day.
    'series', case when p_range in ('today', 'yesterday') then (
      select jsonb_agg(jsonb_build_object(
               'start_hour', b.slot * 3, 'day', null,
               'sales_paisa', coalesce(x.sales, 0), 'orders', coalesce(x.orders, 0)
             ) order by b.slot)
        from generate_series(0, 7) as b(slot)
        left join (
          select floor(extract(hour from o.created_at at time zone 'Asia/Karachi') / 3)::integer as slot,
                 sum(o.total_paisa) filter (where o.status = 'delivered') as sales,
                 count(*) filter (where o.status not in ('cancelled', 'rejected')) as orders
            from public.customer_orders o
           where o.shop_id = p_shop_id and o.deleted_at is null
             and o.created_at >= v_from and o.created_at < v_to
           group by 1
        ) x on x.slot = b.slot
    ) else (
      select jsonb_agg(jsonb_build_object(
               'start_hour', null, 'day', d.day::date,
               'sales_paisa', coalesce(x.sales, 0), 'orders', coalesce(x.orders, 0)
             ) order by d.day)
        from generate_series((v_from at time zone 'Asia/Karachi')::date, v_today, interval '1 day') as d(day)
        left join (
          select (o.created_at at time zone 'Asia/Karachi')::date as day,
                 sum(o.total_paisa) filter (where o.status = 'delivered') as sales,
                 count(*) filter (where o.status not in ('cancelled', 'rejected')) as orders
            from public.customer_orders o
           where o.shop_id = p_shop_id and o.deleted_at is null
             and o.created_at >= v_from and o.created_at < v_to
           group by 1
        ) x on x.day = d.day::date
    ) end,
    'top_products', (
      select coalesce(jsonb_agg(t order by t.sales_paisa desc, t.name), '[]'::jsonb)
        from (
          select coi.name, coi.name_ur, coi.unit::text as unit,
                 sum(coi.qty) as qty, sum(coi.line_total_paisa) as sales_paisa
            from public.customer_order_items coi
            join public.customer_orders o on o.id = coi.customer_order_id
           where o.shop_id = p_shop_id and o.deleted_at is null and o.status = 'delivered'
             and o.created_at >= v_from and o.created_at < v_to
           group by coi.inventory_id, coi.name, coi.name_ur, coi.unit
           order by sum(coi.line_total_paisa) desc, coi.name
           limit 5
        ) t
    )
  );
end;
$$;

revoke execute on function private.shop_sales_totals(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.shop_sales_report(uuid, text) from public, anon;
grant execute on function public.shop_sales_report(uuid, text) to authenticated;
