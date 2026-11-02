-- The customer app sees only what live storefronts sell online.
begin;
\ir helpers/setup.psql
select plan(7);

select tests.create_user('owner');
select tests.create_user('shopper');
grant insert, update on tests.refs to authenticated;

insert into public.shops (owner_id, name, slug, phone, address_line, lat, lng, status)
values (tests.id('owner'), 'Live Kiryana', 'live-kiryana', '+923001110001', 'Shop 1', 25.39, 68.37, 'approved')
returning tests.remember('live', id);
insert into public.shops (owner_id, name, slug, phone, address_line, lat, lng, status)
values (tests.id('owner'), 'Closed Kiryana', 'closed-kiryana', '+923001110002', 'Shop 2', 25.39, 68.37, 'approved')
returning tests.remember('closed', id);
insert into public.storefront_settings (shop_id, is_live) values (tests.id('live'), true), (tests.id('closed'), false);

insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('live'), 'Testo Chai 95 g', 12000, 10, true)
returning tests.remember('chai', id);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('live'), 'Hidden Biscuit', 5000, 10, false)
returning tests.remember('hidden', id);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('closed'), 'Closed Shop Tea', 9000, 10, true)
returning tests.remember('closed_item', id);

select tests.authenticate_as('shopper');
select ok(
  public.storefront_products(null, 'testo', null, 50) @> jsonb_build_array(jsonb_build_object('id', tests.id('chai'))),
  'a customer finds a product a live dukan sells online'
);
select ok(
  not (public.storefront_products(null, null, null, 200) @> jsonb_build_array(jsonb_build_object('id', tests.id('hidden')))),
  'but not one the dukan hides from online'
);
select ok(
  not (public.storefront_products(null, null, null, 200) @> jsonb_build_array(jsonb_build_object('id', tests.id('closed_item')))),
  'nor anything from a dukan that is not selling online'
);
select is(
  public.storefront_shop('live-kiryana') ->> 'name', 'Live Kiryana',
  'a live storefront opens by its slug'
);
select is(
  jsonb_array_length(public.storefront_shop('live-kiryana') -> 'products'), 1,
  'with only its online products'
);
select is(
  (select count(*)::integer from public.shop_inventory), 0,
  'the inventory table itself stays private to the dukan'
);
select is(
  (public.nearby_dukans(25.39, 68.37, 50) -> 0 ->> 'is_live')::boolean, true,
  'nearby lists dukans selling online first'
);

select * from finish();
rollback;
