-- The dukandar's home: one call for today's online sales and orders, the live order queue,
-- low stock and stock on its way from distributors. Any active member of the dukan may read it.

create or replace function public.shop_dashboard(p_shop_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Karachi')::date;
begin
  perform private.require_user();
  if p_shop_id is null or p_shop_id not in (select private.my_shop_ids()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'shop', (
      select jsonb_build_object('name', s.name, 'slug', s.slug, 'is_live', coalesce(ss.is_live, false))
        from public.shops s left join public.storefront_settings ss on ss.shop_id = s.id
       where s.id = p_shop_id
    ),
    'today', (
      select jsonb_build_object(
        'sales_paisa', coalesce(sum(o.total_paisa) filter (where o.status = 'delivered'), 0),
        'orders', count(*) filter (where o.status not in ('cancelled', 'rejected')),
        'delivered', count(*) filter (where o.status = 'delivered')
      )
        from public.customer_orders o
       where o.shop_id = p_shop_id and o.deleted_at is null
         and (o.created_at at time zone 'Asia/Karachi')::date = v_today
    ),
    'counts', (
      select jsonb_build_object(
        'new', count(*) filter (where o.status = 'placed'),
        'active', count(*) filter (where o.status in ('accepted', 'packed', 'out_for_delivery'))
      )
        from public.customer_orders o
       where o.shop_id = p_shop_id and o.deleted_at is null
    ),
    'week', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'sales_paisa', coalesce(x.sales, 0)) order by d.day), '[]'::jsonb)
        from generate_series(v_today - 6, v_today, interval '1 day') as d(day)
        left join (
          select (o.delivered_at at time zone 'Asia/Karachi')::date as day, sum(o.total_paisa) as sales
            from public.customer_orders o
           where o.shop_id = p_shop_id and o.status = 'delivered' and o.deleted_at is null
             and o.delivered_at >= (v_today - 6)::timestamp at time zone 'Asia/Karachi'
           group by 1
        ) x on x.day = d.day::date
    ),
    'queue', (
      select coalesce(jsonb_agg(q order by q.sort, q.created_at), '[]'::jsonb)
        from (
          select o.id, o.order_number, o.customer_name, o.status, o.total_paisa, o.items_count, o.created_at,
                 o.delivery_address ->> 'text' as address,
                 case o.status when 'placed' then 0 else 1 end as sort,
                 (select string_agg(i.name, ', ' order by i.created_at)
                    from (select name, created_at from public.customer_order_items
                           where customer_order_id = o.id order by created_at limit 3) i) as items_preview
            from public.customer_orders o
           where o.shop_id = p_shop_id and o.deleted_at is null
             and o.status in ('placed', 'accepted', 'packed', 'out_for_delivery')
           order by case o.status when 'placed' then 0 else 1 end, o.created_at
           limit 6
        ) q
    ),
    'low_stock', (
      select coalesce(jsonb_agg(l order by l.qty_on_hand, l.name), '[]'::jsonb)
        from (
          select i.id, i.name, i.qty_on_hand, i.low_stock_threshold
            from public.shop_inventory i
           where i.shop_id = p_shop_id and i.is_active and i.qty_on_hand <= i.low_stock_threshold
           order by i.qty_on_hand, i.name
           limit 6
        ) l
    ),
    'stock', (
      select jsonb_build_object(
        'products', count(*),
        'low', count(*) filter (where i.qty_on_hand <= i.low_stock_threshold),
        'value_paisa', coalesce(sum(round(i.qty_on_hand * i.cost_price_paisa)), 0)
      )
        from public.shop_inventory i
       where i.shop_id = p_shop_id and i.is_active
    ),
    'incoming', (
      select jsonb_build_object('orders', count(*), 'total_paisa', coalesce(sum(o.total_paisa), 0))
        from public.orders o
       where o.shop_id = p_shop_id and o.status in ('confirmed', 'picking', 'packed', 'dispatched')
    )
  );
end;
$$;

revoke execute on function public.shop_dashboard(uuid) from public, anon;
grant execute on function public.shop_dashboard(uuid) to authenticated;
