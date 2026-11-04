-- A dukandar can switch the online dukan on (only with products to sell) and set delivery
-- terms; staff without storefront access and strangers cannot.
begin;
\ir helpers/setup.psql
select plan(10);

select tests.create_user('owner');
select tests.create_user('cashier');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
select tests.add_shop_staff('kiryana', 'cashier', 'cashier', array['billing']);
grant insert, update on tests.refs to authenticated;

select tests.authenticate_as('owner');
select is(
  (public.shop_storefront(tests.id('kiryana')) ->> 'is_live')::boolean, false,
  'a new dukan starts offline'
);
select throws_ok(
  format($$ select public.update_shop_storefront(%L, true) $$, tests.id('kiryana')),
  '22023', 'no_products', 'it cannot go online with nothing to sell'
);

select tests.clear_authentication();
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 50000, 10, true);

select tests.authenticate_as('owner');
select is(
  (public.update_shop_storefront(tests.id('kiryana'), true) ->> 'is_live')::boolean, true,
  'with products it goes online in one tap'
);
select is(
  (public.update_shop_storefront(tests.id('kiryana'), true, 20, 30000, 5000, 150000, 'Fresh daily') ->> 'eta_minutes')::integer,
  20, 'delivery terms can be set'
);
select is(
  (public.update_shop_storefront(tests.id('kiryana'), false) ->> 'delivery_fee_paisa')::bigint, 5000::bigint,
  'switching off keeps the delivery terms'
);
select is(
  public.update_shop_storefront(tests.id('kiryana'), false, null, null, null, 0, '') ->> 'free_delivery_above_paisa',
  null, 'zero clears free delivery'
);
select throws_ok(
  format($$ select public.update_shop_storefront(%L, true, 2) $$, tests.id('kiryana')),
  '22023', 'invalid_eta', 'a delivery time under 5 minutes is refused'
);

select tests.authenticate_as('cashier');
select is(
  (public.shop_storefront(tests.id('kiryana')) ->> 'can_edit')::boolean, false,
  'staff can see the online dukan but not change it'
);
select throws_ok(
  format($$ select public.update_shop_storefront(%L, true) $$, tests.id('kiryana')),
  '42501', 'not_allowed', 'staff without storefront access cannot switch it'
);

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.shop_storefront(%L) $$, tests.id('kiryana')),
  '42501', 'not_allowed', 'someone else cannot read it'
);

select * from finish();
rollback;
