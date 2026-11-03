-- Customer side: "Buy again" on Home, "Order again" on an order, and rating a delivered order.
-- Rows come back in the same shape as storefront_products, so the app shows them with the same
-- product cards and cart.

-- Products this customer has ordered before that a live dukan still has in stock, most ordered
-- first.
create or replace function public.my_buy_again(p_limit integer default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) - 'times' order by x.times desc, x.name), '[]'::jsonb)
    from (
      select i.id, i.shop_id, s.name as shop_name, s.slug as shop_slug,
             i.name, i.name_ur, i.pack_size_label, i.unit::text as unit, i.is_loose,
             i.selling_price_paisa, i.mrp_paisa, i.category_id, i.is_favourite,
             true as in_stock,
             i.qty_on_hand <= i.low_stock_threshold as low_stock,
             coalesce(i.image_path, mp.image_path) as image_path,
             b.times
        from (
          select coi.inventory_id, count(*) as times
            from public.customer_order_items coi
            join public.customer_orders co on co.id = coi.customer_order_id
           where co.customer_id = (select auth.uid()) and co.deleted_at is null
             and co.status not in ('cancelled', 'rejected')
           group by coi.inventory_id
        ) b
        join public.shop_inventory i on i.id = b.inventory_id
        left join public.master_products mp on mp.id = i.master_product_id
        join public.shops s on s.id = i.shop_id and s.status = 'approved'
        join public.storefront_settings ss on ss.shop_id = s.id and ss.is_live
       where i.is_active and i.is_visible_online and i.qty_on_hand > 0
       order by b.times desc, i.name
       limit least(greatest(coalesce(p_limit, 12), 1), 40)
    ) x
$$;

-- The lines of one of the customer's orders that can be ordered again now, at today's price,
-- each with the quantity ordered last time (capped by what is on the shelf).
create or replace function public.reorder_customer_order(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.customer_orders o
     where o.id = p_order_id and o.customer_id = (select auth.uid()) and o.deleted_at is null
  ) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.name), '[]'::jsonb)
      from (
        select i.id, i.shop_id, s.name as shop_name, s.slug as shop_slug,
               i.name, i.name_ur, i.pack_size_label, i.unit::text as unit, i.is_loose,
               i.selling_price_paisa, i.mrp_paisa, i.category_id, i.is_favourite,
               true as in_stock,
               i.qty_on_hand <= i.low_stock_threshold as low_stock,
               coalesce(i.image_path, mp.image_path) as image_path,
               least(coi.qty, greatest(floor(i.qty_on_hand), 1))::integer as qty
          from public.customer_order_items coi
          join public.shop_inventory i on i.id = coi.inventory_id
          left join public.master_products mp on mp.id = i.master_product_id
          join public.shops s on s.id = i.shop_id and s.status = 'approved'
          join public.storefront_settings ss on ss.shop_id = s.id and ss.is_live
         where coi.customer_order_id = p_order_id
           and i.is_active and i.is_visible_online and i.qty_on_hand > 0
      ) x
  );
end;
$$;

-- A delivered order's rating for its dukan: 1 to 5 stars and an optional comment. Rating again
-- changes the earlier rating.
create or replace function public.rate_customer_order(p_order_id uuid, p_rating integer, p_comment text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_order public.customer_orders;
  v_review public.reviews;
begin
  select * into v_order
    from public.customer_orders o
   where o.id = p_order_id and o.customer_id = v_uid and o.deleted_at is null;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'not_delivered' using errcode = '22023';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;

  insert into public.reviews (target_type, shop_id, reviewer_id, customer_order_id, rating, comment, is_published)
  values ('shop', v_order.shop_id, v_uid, v_order.id, p_rating,
          nullif(left(btrim(coalesce(p_comment, '')), 1000), ''), true)
  on conflict (customer_order_id) do update
     set rating = excluded.rating, comment = excluded.comment, updated_at = now()
  returning * into v_review;

  return jsonb_build_object('id', v_review.id, 'rating', v_review.rating, 'comment', v_review.comment);
end;
$$;

revoke execute on function public.my_buy_again(integer) from public, anon;
revoke execute on function public.reorder_customer_order(uuid) from public, anon;
revoke execute on function public.rate_customer_order(uuid, integer, text) from public, anon;
grant execute on function public.my_buy_again(integer) to authenticated;
grant execute on function public.reorder_customer_order(uuid) to authenticated;
grant execute on function public.rate_customer_order(uuid, integer, text) to authenticated;
