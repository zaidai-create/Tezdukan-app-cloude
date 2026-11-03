-- The dukandar's home: only the dukan's own people can read it, and it counts what happened.
begin;
\ir helpers/setup.psql
select plan(5);

select tests.create_user('owner');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
grant insert, update on tests.refs to authenticated;

insert into public.storefront_settings (shop_id, is_live) values (tests.id('kiryana'), true);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, low_stock_threshold, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 50000, 2, 5, true)
returning tests.remember('chai', id);

select tests.authenticate_as('shopper');
select public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 1)),
  'House 1, Street 2'
);

select tests.authenticate_as('owner');
select is((public.shop_dashboard(tests.id('kiryana')) -> 'counts' ->> 'new')::integer, 1, 'a new online order shows on the dukan home');
select is((public.shop_dashboard(tests.id('kiryana')) -> 'today' ->> 'orders')::integer, 1, 'and counts in today''s orders');
select is(jsonb_array_length(public.shop_dashboard(tests.id('kiryana')) -> 'queue'), 1, 'and waits in the live queue');
select is(public.shop_dashboard(tests.id('kiryana')) -> 'low_stock' -> 0 ->> 'name', 'Testo Chai 95 g', 'low stock is listed');

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.shop_dashboard(%L) $$, tests.id('kiryana')),
  '42501', 'not_allowed', 'someone else cannot read the dukan''s home'
);

select * from finish();
rollback;
