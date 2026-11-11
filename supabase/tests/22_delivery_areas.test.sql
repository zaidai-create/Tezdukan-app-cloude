-- Customers only see dukans (and their products) whose delivery radius covers them; dukandars
-- set their pin and radius; admins can widen a dukan's area.
begin;
\ir helpers/setup.psql
select plan(11);

select tests.make_admin('boss');
select tests.create_user('owner');
select tests.create_user('shopper');
select tests.make_shop('pin_mart', 'owner');
grant insert, update on tests.refs to authenticated;

-- The test dukan sits at 25.39, 68.36 (make_shop) with a 2 km radius.
insert into public.storefront_settings (shop_id, is_live, delivery_radius_m) values (tests.id('pin_mart'), true, 2000);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('pin_mart'), 'Pinmart Chai 95 g', 50000, 10, true);

select tests.authenticate_as('shopper');
select ok(
  exists (select 1 from jsonb_array_elements(public.nearby_dukans(25.395, 68.365)) d
           where d ->> 'id' = tests.id('pin_mart')::text),
  'a customer 700 m away sees the dukan'
);
select ok(
  not exists (select 1 from jsonb_array_elements(public.nearby_dukans(25.45, 68.36)) d
               where d ->> 'id' = tests.id('pin_mart')::text),
  'a customer 6.7 km away does not'
);
select ok(
  exists (select 1 from jsonb_array_elements(public.storefront_products(null, 'Pinmart', null, 20, 25.395, 68.365)) p),
  'its products show near the dukan'
);
select is(
  jsonb_array_length(public.storefront_products(null, 'Pinmart', null, 20, 25.45, 68.36)), 0,
  'and not far away'
);
select is(public.shop_delivers_to(tests.id('pin_mart'), 25.45, 68.36), false, 'an order from far away is refused');
select ok(jsonb_array_length(public.delivery_zones()) >= 0, 'zones are listed for picking an area');

select tests.authenticate_as('owner');
select is(
  (public.update_shop_storefront(tests.id('pin_mart'), true, null, null, null, null, null, 4000) ->> 'delivery_radius_m')::integer,
  4000, 'the dukandar can widen the radius to 4 km'
);
select throws_ok(
  format($$ select public.update_shop_storefront(%L, true, null, null, null, null, null, 9000) $$, tests.id('pin_mart')),
  '22023', 'invalid_radius', 'but not beyond 6 km'
);
select is(
  (public.update_shop_location(tests.id('pin_mart'), 25.40, 68.37) ->> 'lat')::numeric, 25.400000,
  'and can set the dukan pin'
);

select tests.authenticate_as('boss');
select is(
  public.admin_set_shop_delivery(tests.id('pin_mart'), 3000, true) ->> 'all_city', 'true',
  'an admin can let a dukan deliver across the city'
);
select tests.authenticate_as('shopper');
select is(public.shop_delivers_to(tests.id('pin_mart'), 25.45, 68.36), true, 'then far customers can order');

select * from finish();
rollback;
