-- Delivery addresses: one default per person, at most five, private to their owner; an order
-- goes to a saved address with a pin, and never outside the dukan's delivery radius.
begin;
\ir helpers/setup.psql
select plan(15);

select tests.create_user('owner');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
grant insert, update on tests.refs to authenticated;

-- The test dukan sits at 25.39, 68.36 and delivers 3 km (the default).
insert into public.storefront_settings (shop_id, is_live) values (tests.id('kiryana'), true);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 50000, 10, true)
returning tests.remember('chai', id);

select tests.authenticate_as('shopper');
insert into public.addresses (label, line1, line2, landmark, lat, lng)
values ('Home', 'Street 2, Qasimabad, Hyderabad', 'House 1', 'Near the masjid', 25.395, 68.365)
returning tests.remember('home', id);
select is(
  (select is_default from public.addresses where id = tests.id('home')), true,
  'the first address becomes the default without being asked'
);

insert into public.addresses (label, line1, lat, lng, is_default)
values ('Work', 'Auto Bhan Road, Latifabad, Hyderabad', 25.45, 68.36, true)
returning tests.remember('work', id);
select is(
  (select count(*)::integer from public.addresses where is_default), 1,
  'a new default replaces the old one'
);
select is(
  (select is_default from public.addresses where id = tests.id('work')), true,
  'and it is the new address'
);

delete from public.addresses where id = tests.id('work');
select is(
  (select is_default from public.addresses where id = tests.id('home')), true,
  'deleting the default hands it to the address that is left'
);

insert into public.addresses (label, line1, lat, lng)
values ('Work', 'Auto Bhan Road, Latifabad, Hyderabad', 25.45, 68.36)
returning tests.remember('far', id);
insert into public.addresses (label, line1) values ('Other', 'Old address without a pin')
returning tests.remember('unpinned', id);
insert into public.addresses (label, line1, lat, lng) values
  ('Other', 'Fourth place, Hyderabad', 25.39, 68.36),
  ('Other', 'Fifth place, Hyderabad', 25.39, 68.36);
select throws_ok(
  $$ insert into public.addresses (label, line1, lat, lng) values ('Other', 'Sixth place, Hyderabad', 25.39, 68.36) $$,
  '54000', 'too_many_addresses', 'a sixth address is refused'
);

select throws_ok(
  format($$ select public.place_customer_order(%L, jsonb_build_array(jsonb_build_object('inventory_id', %L, 'qty', 1)), %L) $$,
         tests.id('kiryana'), tests.id('chai'), tests.id('far')),
  '55000', 'out_of_area', 'an order to an address 6.7 km away is refused'
);
select throws_ok(
  format($$ select public.place_customer_order(%L, jsonb_build_array(jsonb_build_object('inventory_id', %L, 'qty', 1)), %L) $$,
         tests.id('kiryana'), tests.id('chai'), tests.id('unpinned')),
  '22023', 'address_location_required', 'so is one to an address without a map pin'
);
select tests.remember('order', (public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 1)),
  tests.id('home')
) ->> 'id')::uuid);
select tests.clear_authentication();
select is(
  (select address_id from public.customer_orders where id = tests.id('order')), tests.id('home'),
  'the order remembers which address it goes to'
);
select is(
  (select delivery_address ->> 'text' from public.customer_orders where id = tests.id('order')),
  'House 1, Street 2, Qasimabad, Hyderabad',
  'and keeps the words: house first, then the street'
);
select is(
  (select (delivery_address ->> 'lat')::numeric from public.customer_orders where id = tests.id('order')), 25.395,
  'and the pin, so the dukan can open it on a map'
);
select is(
  (select delivery_address ->> 'landmark' from public.customer_orders where id = tests.id('order')),
  'Near the masjid', 'and the landmark'
);

select tests.authenticate_as('stranger');
select is(
  (select count(*)::integer from public.addresses), 0,
  'nobody else can read a person''s addresses'
);
select throws_ok(
  format($$ select public.place_customer_order(%L, jsonb_build_array(jsonb_build_object('inventory_id', %L, 'qty', 1)), %L) $$,
         tests.id('kiryana'), tests.id('chai'), tests.id('home')),
  '22023', 'address_required', 'or order to someone else''s address'
);

select tests.authenticate_as('owner');
select is(
  (public.update_shop_storefront(tests.id('kiryana'), true, null, null, null, null, null, 6000) ->> 'delivery_radius_m')::integer,
  6000, 'a dukandar can deliver up to 6 km'
);
select throws_ok(
  format($$ select public.update_shop_storefront(%L, true, null, null, null, null, null, 7000) $$, tests.id('kiryana')),
  '22023', 'invalid_radius', 'but not further on their own'
);

select * from finish();
rollback;
