-- Dukandar product management: starter pack, adding products with opening stock, stock counts.
begin;
\ir helpers/setup.psql
select plan(11);

select tests.create_user('owner');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
select tests.create_user('dist_owner');
select tests.make_org('wholesale', 'dist_owner');
grant insert, update on tests.refs to authenticated;

select tests.authenticate_as('owner');
select ok(jsonb_array_length(public.shop_starter_pack(tests.id('kiryana'), 5)) = 5, 'the starter pack offers common products');

select tests.remember('first_master', (public.shop_starter_pack(tests.id('kiryana'), 1) -> 0 ->> 'id')::uuid);
select is(
  public.add_shop_products(tests.id('kiryana'), jsonb_build_array(
    jsonb_build_object('master_product_id', tests.id('first_master'), 'selling_price_paisa', 25000, 'qty', 10),
    jsonb_build_object('name', 'Ghar ka achaar', 'selling_price_paisa', 30000, 'qty', 0)
  )),
  '{"added": 2, "updated": 0}'::jsonb,
  'a catalogue product and the shop''s own product are added'
);
select is(
  (select qty_on_hand from public.shop_inventory where shop_id = tests.id('kiryana') and master_product_id = tests.id('first_master')),
  10.000, 'opening stock is on the shelf'
);
select is(
  (select count(*)::integer from public.shop_stock_movements where shop_id = tests.id('kiryana') and movement_type = 'opening'),
  1, 'and booked as an opening movement'
);
select ok(
  not exists (select 1 from jsonb_array_elements(public.shop_starter_pack(tests.id('kiryana'), 40)) e
               where (e.value ->> 'id')::uuid = tests.id('first_master')),
  'products the shop has leave the starter pack'
);
select is(
  public.add_shop_products(tests.id('kiryana'), jsonb_build_array(
    jsonb_build_object('master_product_id', tests.id('first_master'), 'selling_price_paisa', 26000)
  )),
  '{"added": 0, "updated": 1}'::jsonb,
  'adding it again updates the price instead of duplicating'
);

select tests.remember('achaar', (select id from public.shop_inventory where shop_id = tests.id('kiryana') and name = 'Ghar ka achaar'));
select is(public.set_shop_stock(tests.id('achaar'), 4), 4::numeric, 'a stock count sets the shelf quantity');

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.add_shop_products(%L, '[{"name": "Sneaky", "selling_price_paisa": 1}]'::jsonb) $$, tests.id('kiryana')),
  '42501', 'not_allowed', 'someone else cannot add products to the dukan'
);
select throws_ok(
  format($$ select public.set_shop_stock(%L, 99) $$, tests.id('achaar')),
  '42501', 'not_allowed', 'or change its stock'
);

select throws_ok(
  format($$ select public.org_starter_pack(%L) $$, tests.id('wholesale')),
  '42501', 'not_allowed', 'only the distributor''s own team sees its starter pack'
);

select tests.authenticate_as('dist_owner');
select ok(jsonb_array_length(public.org_starter_pack(tests.id('wholesale'), 6)) = 6, 'a new distributor gets common products to list');

select * from finish();
rollback;
