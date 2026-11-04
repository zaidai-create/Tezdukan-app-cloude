-- Dukan ratings show to customers, and the dukandar's sales report counts the right orders and
-- stays private to people allowed to see reports.
begin;
\ir helpers/setup.psql
select plan(12);

select tests.create_user('owner');
select tests.create_user('cashier');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
select tests.add_shop_staff('kiryana', 'cashier', 'cashier', array['billing']);
grant insert, update on tests.refs to authenticated;

insert into public.storefront_settings (shop_id, is_live, min_order_paisa, delivery_fee_paisa)
values (tests.id('kiryana'), true, 0, 0);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, cost_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 50000, 40000, 10, true)
returning tests.remember('chai', id);
select slug as kiryana_slug from public.shops where id = tests.id('kiryana') \gset

select tests.authenticate_as('shopper');
select tests.remember('order', (public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 2)),
  'House 1, Street 2'
) ->> 'id')::uuid);
select public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 1)),
  'House 1, Street 2'
);

select tests.clear_authentication();
update public.customer_orders set status = 'delivered', delivered_at = now() where id = tests.id('order');

select tests.authenticate_as('shopper');
select public.rate_customer_order(tests.id('order'), 4, 'Fresh and quick');

select is(
  (select (d ->> 'rating')::numeric from jsonb_array_elements(public.nearby_dukans()) d
    where d ->> 'id' = tests.id('kiryana')::text),
  4.0, 'a dukan card shows its rating'
);
select is(
  (public.storefront_shop(:'kiryana_slug') ->> 'rating_count')::integer,
  1, 'the dukan page counts its ratings'
);
select is(
  public.storefront_shop(:'kiryana_slug') -> 'reviews' -> 0 ->> 'comment',
  'Fresh and quick', 'and shows the latest comments'
);

select tests.authenticate_as('owner');
select is(
  (public.shop_sales_report(tests.id('kiryana'), 'today') -> 'totals' ->> 'sales_paisa')::bigint,
  100000::bigint, 'sales count delivered orders only'
);
select is(
  (public.shop_sales_report(tests.id('kiryana'), 'today') -> 'totals' ->> 'orders')::integer,
  2, 'orders count every order that is not cancelled'
);
select is(
  (public.shop_sales_report(tests.id('kiryana'), 'today') -> 'totals' ->> 'profit_paisa')::bigint,
  20000::bigint, 'profit is selling price minus buying price'
);
select is(
  jsonb_array_length(public.shop_sales_report(tests.id('kiryana'), 'today') -> 'series'),
  8, 'a day is shown in eight 3-hour slots'
);
select is(
  jsonb_array_length(public.shop_sales_report(tests.id('kiryana'), 'week') -> 'series'),
  7, 'a week is shown day by day'
);
select is(
  public.shop_sales_report(tests.id('kiryana'), 'month') -> 'top_products' -> 0 ->> 'name',
  'Testo Chai 95 g', 'best sellers are listed'
);
select throws_ok(
  format($$ select public.shop_sales_report(%L, 'decade') $$, tests.id('kiryana')),
  '22023', 'invalid_range', 'an unknown period is refused'
);

select tests.authenticate_as('cashier');
select throws_ok(
  format($$ select public.shop_sales_report(%L, 'today') $$, tests.id('kiryana')),
  '42501', 'not_allowed', 'staff without report access cannot read it'
);

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.shop_sales_report(%L, 'today') $$, tests.id('kiryana')),
  '42501', 'not_allowed', 'someone else cannot read the report'
);

select * from finish();
rollback;
