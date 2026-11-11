-- Buy again, order again and ratings: only for the customer's own orders, only what a live
-- dukan still has, and a rating only after delivery.
begin;
\ir helpers/setup.psql
select plan(9);

select tests.create_user('owner');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
select tests.make_address('home', 'shopper');
grant insert, update on tests.refs to authenticated;

insert into public.storefront_settings (shop_id, is_live, min_order_paisa, delivery_fee_paisa)
values (tests.id('kiryana'), true, 0, 0);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 50000, 10, true)
returning tests.remember('chai', id);

select tests.authenticate_as('shopper');
select tests.remember('order', (public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 2)),
  tests.id('home')
) ->> 'id')::uuid);

select is(public.my_buy_again() -> 0 ->> 'name', 'Testo Chai 95 g', 'what was ordered shows in Buy again');
select is(
  (public.reorder_customer_order(tests.id('order')) -> 0 ->> 'qty')::integer, 2,
  'Order again brings back the same quantity'
);
select throws_ok(
  format($$ select public.rate_customer_order(%L, 5) $$, tests.id('order')),
  '22023', 'not_delivered', 'an order cannot be rated before it is delivered'
);

select tests.clear_authentication();
update public.customer_orders set status = 'delivered', delivered_at = now() where id = tests.id('order');

select tests.authenticate_as('shopper');
select is((public.rate_customer_order(tests.id('order'), 4, 'Fresh and quick') ->> 'rating')::integer, 4, 'a delivered order can be rated');
select is((public.rate_customer_order(tests.id('order'), 5) ->> 'rating')::integer, 5, 'rating again changes it');
select is(
  (select count(*)::integer from public.reviews where customer_order_id = tests.id('order')), 1,
  'one rating per order'
);

select tests.authenticate_as('stranger');
select is(public.my_buy_again(), '[]'::jsonb, 'someone else sees nothing in Buy again');
select throws_ok(
  format($$ select public.reorder_customer_order(%L) $$, tests.id('order')),
  'P0002', 'order_not_found', 'or reorders another person''s order'
);
select throws_ok(
  format($$ select public.rate_customer_order(%L, 1) $$, tests.id('order')),
  'P0002', 'order_not_found', 'or rates it'
);

select * from finish();
rollback;
