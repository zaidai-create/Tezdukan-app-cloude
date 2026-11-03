-- The distributor's wider view (spec section 6): month to date against last month, the
-- order pipeline, retailers that went quiet, best sellers, category split and stock that
-- will run out soon at the current selling rate. Kept apart from org_dashboard so the home's
-- first paint never waits on the heavier 30-day queries.

create or replace function public.org_insights(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.pkt_today();
  v_month_start date := date_trunc('month', private.pkt_today())::date;
  v_prev_start date := (date_trunc('month', private.pkt_today()) - interval '1 month')::date;
  v_prev_same_day date;
begin
  perform private.require_user();
  if not private.can_view_org_orders(p_org_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- The same number of days into last month, so the comparison is fair on the 3rd and the 30th.
  v_prev_same_day := least(v_prev_start + (v_today - v_month_start), v_month_start - 1);

  return jsonb_build_object(
    'mtd', (
      select jsonb_build_object(
        'sales_paisa', coalesce(sum(o.ordered_total_paisa) filter (where o.created_at >= v_month_start::timestamp at time zone 'Asia/Karachi'), 0),
        'orders', count(*) filter (where o.created_at >= v_month_start::timestamp at time zone 'Asia/Karachi'),
        'prev_sales_paisa', coalesce(sum(o.ordered_total_paisa) filter (
          where o.created_at >= v_prev_start::timestamp at time zone 'Asia/Karachi'
            and o.created_at < (v_prev_same_day + 1)::timestamp at time zone 'Asia/Karachi'), 0)
      )
        from public.orders o
       where o.org_id = p_org_id and o.deleted_at is null and o.status <> 'cancelled'
         and o.created_at >= v_prev_start::timestamp at time zone 'Asia/Karachi'
    ),
    'pipeline', (
      select jsonb_build_object(
        'new', count(*) filter (where o.status = 'new'),
        'confirmed', count(*) filter (where o.status = 'confirmed'),
        'picking', count(*) filter (where o.status = 'picking'),
        'packed', count(*) filter (where o.status = 'packed'),
        'dispatched', count(*) filter (where o.status = 'dispatched')
      )
        from public.orders o
       where o.org_id = p_org_id and o.deleted_at is null
    ),
    'fill_rate', (
      -- Delivered pieces over ordered pieces for orders delivered in the last 30 days.
      select case when coalesce(sum(i.base_qty), 0) = 0 then null
                  else round(100.0 * sum(coalesce(i.delivered_base_qty, 0)) / sum(i.base_qty), 1) end
        from public.order_items i join public.orders o on o.id = i.order_id
       where o.org_id = p_org_id and o.deleted_at is null and i.deleted_at is null
         and o.status in ('delivered', 'partially_delivered')
         and o.delivered_at > now() - interval '30 days'
    ),
    'retailers', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where r.last_at > now() - interval '7 days'),
        'new', count(*) filter (where r.first_at > now() - interval '30 days'),
        'inactive', count(*) filter (where r.last_at <= now() - interval '7 days')
      )
        from (
          select o.shop_id, min(o.created_at) as first_at, max(o.created_at) as last_at
            from public.orders o
           where o.org_id = p_org_id and o.deleted_at is null and o.status <> 'cancelled'
           group by o.shop_id
        ) r
    ),
    'inactive_shops', (
      select coalesce(jsonb_agg(x order by x.last_order_at), '[]'::jsonb)
        from (
          select s.id, s.name, coalesce(s.whatsapp, s.phone) as phone, max(o.created_at) as last_order_at,
                 v_today - (max(o.created_at) at time zone 'Asia/Karachi')::date as days_quiet
            from public.orders o join public.shops s on s.id = o.shop_id
           where o.org_id = p_org_id and o.deleted_at is null and o.status <> 'cancelled'
           group by s.id, s.name, s.whatsapp, s.phone
          having max(o.created_at) <= now() - interval '7 days'
           order by max(o.created_at)
           limit 5
        ) x
    ),
    'top_products', (
      select coalesce(jsonb_agg(x order by x.value_paisa desc), '[]'::jsonb)
        from (
          select i.distributor_product_id as id, min(i.name) as name, min(i.image_path) as image_path,
                 sum(i.quantity)::int as units, sum(i.line_total_paisa) as value_paisa
            from public.order_items i join public.orders o on o.id = i.order_id
           where o.org_id = p_org_id and o.deleted_at is null and i.deleted_at is null
             and o.status <> 'cancelled' and o.created_at > now() - interval '30 days'
           group by i.distributor_product_id
           order by sum(i.line_total_paisa) desc
           limit 5
        ) x
    ),
    'categories', (
      select coalesce(jsonb_agg(x order by x.value_paisa desc), '[]'::jsonb)
        from (
          select c.id, c.name, c.name_ur, sum(i.line_total_paisa) as value_paisa
            from public.order_items i
            join public.orders o on o.id = i.order_id
            join public.categories c on c.id = i.category_id
           where o.org_id = p_org_id and o.deleted_at is null and i.deleted_at is null
             and o.status <> 'cancelled' and o.created_at > now() - interval '30 days'
           group by c.id, c.name, c.name_ur
           order by 4 desc
           limit 5
        ) x
    ),
    'running_low', (
      -- Days of stock left at the last 30 days' selling rate; only products that sell.
      select coalesce(jsonb_agg(x order by x.days_left, x.name), '[]'::jsonb)
        from (
          select p.id, p.name, greatest(coalesce(st.available, 0), 0) as available_base_qty,
                 floor(greatest(coalesce(st.available, 0), 0) / (sold.base_qty / 30.0))::int as days_left
            from public.distributor_products p
            join (
              select i.distributor_product_id, sum(i.base_qty) as base_qty
                from public.order_items i join public.orders o on o.id = i.order_id
               where o.org_id = p_org_id and o.deleted_at is null and i.deleted_at is null
                 and o.status <> 'cancelled' and o.created_at > now() - interval '30 days'
               group by i.distributor_product_id
            ) sold on sold.distributor_product_id = p.id and sold.base_qty > 0
            left join (
              select b.distributor_product_id, sum(b.qty_on_hand - b.qty_reserved) as available
                from public.stock_batches b
               where b.org_id = p_org_id
               group by b.distributor_product_id
            ) st on st.distributor_product_id = p.id
           where p.org_id = p_org_id and p.is_active
             and greatest(coalesce(st.available, 0), 0) / (sold.base_qty / 30.0) < 14
           order by 4, p.name
           limit 6
        ) x
    )
  );
end;
$$;

revoke execute on function public.org_insights(uuid) from public, anon;
grant execute on function public.org_insights(uuid) to authenticated;
