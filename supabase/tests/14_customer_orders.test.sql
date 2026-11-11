-- Customer orders: priced by the database from the live storefront, moved along by the dukan,
-- cancelled by the customer while new, and delivered goods leave the dukan's stock.
begin;
\ir helpers/setup.psql
select plan(14);

select tests.create_user('owner');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
select tests.make_address('home', 'shopper');
grant insert, update on tests.refs to authenticated;

insert into public.storefront_settings (shop_id, is_live, min_order_paisa, delivery_fee_paisa, free_delivery_above_paisa)
values (tests.id('kiryana'), true, 150000, 5000, 1000000);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 100000, 5, true)
returning tests.remember('chai', id);

select tests.authenticate_as('shopper');
select throws_ok(
  format($$ select public.place_customer_order(%L, jsonb_build_array(jsonb_build_object('inventory_id', %L, 'qty', 1)), %L) $$,
         tests.id('kiryana'), tests.id('chai'), tests.id('home')),
  '55000', 'below_minimum', 'an order below the dukan''s minimum is refused'
);
select throws_ok(
  format($$ select public.place_customer_order(%L, jsonb_build_array(jsonb_build_object('inventory_id', %L, 'qty', 9)), %L) $$,
         tests.id('kiryana'), tests.id('chai'), tests.id('home')),
  '55000', 'out_of_stock', 'more than the shelf holds is refused'
);
select tests.remember('order', (public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 2)),
  tests.id('home'), null, 'aaaaaaaa-0000-4000-8000-000000000001'
) ->> 'id')::uuid);
select tests.clear_authentication();

select is(
  (select total_paisa::integer from public.customer_orders where id = tests.id('order')), 205000,
  'the database prices the order: Rs 2,000 of chai and Rs 50 delivery'
);
select is(
  (select line_total_paisa::integer from public.customer_order_items where customer_order_id = tests.id('order')), 200000,
  'each line is snapshotted at the shelf price'
);
select ok(
  exists (select 1 from public.notifications where user_id = tests.id('owner') and data ->> 'event' = 'customer_order.placed'),
  'the dukandar is told a new order arrived'
);

select tests.authenticate_as('shopper');
select is(
  public.place_customer_order(
    tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 2)),
    tests.id('home'), null, 'aaaaaaaa-0000-4000-8000-000000000001'
  ) ->> 'id', tests.id('order')::text,
  'retrying with the same request id returns the same order'
);
select throws_ok(
  format($$ select public.update_customer_order_status(%L, 'accepted') $$, tests.id('order')),
  '55000', 'invalid_transition', 'a customer cannot accept their own order'
);
select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.update_customer_order_status(%L, 'accepted') $$, tests.id('order')),
  '42501', 'not_allowed', 'someone else cannot touch the order'
);

select tests.authenticate_as('owner');
select lives_ok(
  format($$ select public.update_customer_order_status(%L, 'accepted') $$, tests.id('order')),
  'the dukandar accepts the order'
);
select tests.clear_authentication();
select ok(
  exists (select 1 from public.notifications where user_id = tests.id('shopper') and data ->> 'event' = 'customer_order.accepted'),
  'and the customer is told'
);
select tests.authenticate_as('owner');
select lives_ok(
  format($$ select public.update_customer_order_status(%L, 'delivered') $$, tests.id('order')),
  'then marks it delivered'
);
select is(
  (select qty_on_hand::integer from public.shop_inventory where id = tests.id('chai')), 3,
  'delivered goods leave the shelf'
);
select is(
  (select movement_type::text || ':' || qty::integer from public.shop_stock_movements
    where reference_id = tests.id('order')), 'sale:-2',
  'with a sale in the stock ledger'
);
select is(
  (select payment_status::text from public.customer_orders where id = tests.id('order')), 'paid',
  'cash on delivery is paid once delivered'
);

select * from finish();
rollback;
