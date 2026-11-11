-- The storefront as a showroom: one tile per product across dukans (the cheapest offer), search
-- that knows Roman Urdu names, sorting and a brand filter, a product page with sizes and other
-- dukans, counts only of what can be delivered, and stars that only a buyer can give.
begin;
\ir helpers/setup.psql
select plan(27);

select tests.create_user('owner');
select tests.create_user('owner_two');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('near_one', 'owner');
select tests.make_shop('near_two', 'owner_two');
select tests.make_address('home', 'shopper');
grant insert, update on tests.refs to authenticated;

-- Both dukans sit at 25.39, 68.36 and deliver 3 km (the default).
insert into public.storefront_settings (shop_id, is_live, eta_minutes, min_order_paisa, delivery_fee_paisa)
values (tests.id('near_one'), true, 30, 0, 0), (tests.id('near_two'), true, 20, 0, 0);

insert into public.categories (name, slug) values ('Testo Dairy', 'testo-dairy')
returning tests.remember('dairy', id);
insert into public.brands (name, slug) values ('Zorbo', 'zorbo-test')
returning tests.remember('zorbo', id);
insert into public.master_products (name, category_id, brand_id)
values ('Zorbo Milk 1 L', tests.id('dairy'), tests.id('zorbo'))
returning tests.remember('milk', id);
insert into public.product_aliases (target_type, master_product_id, alias)
values ('product', tests.id('milk'), 'qeemti doodh');

insert into public.shop_inventory (shop_id, name, master_product_id, category_id, selling_price_paisa, mrp_paisa, qty_on_hand, is_visible_online)
values (tests.id('near_one'), 'Zorbo Milk 1 L', tests.id('milk'), tests.id('dairy'), 30000, 32000, 10, true)
returning tests.remember('milk_one', id);
insert into public.shop_inventory (shop_id, name, master_product_id, category_id, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('near_two'), 'Zorbo Milk 1 L', tests.id('milk'), tests.id('dairy'), 28000, 10, true)
returning tests.remember('milk_two', id);
insert into public.shop_inventory (shop_id, name, brand_id, category_id, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('near_one'), 'Zorbo Milk 250 ml', tests.id('zorbo'), tests.id('dairy'), 9000, 10, true)
returning tests.remember('milk_small', id);
insert into public.shop_inventory (shop_id, name, category_id, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('near_one'), 'Plainio Dahi 400 g', tests.id('dairy'), 5000, 10, true)
returning tests.remember('dahi', id);

select tests.authenticate_as('shopper');

-- One tile per product across dukans.
select is(
  (select count(*)::integer from jsonb_array_elements(public.storefront_products(null, 'Zorbo Milk 1 L', null, 50, 25.395, 68.365)) p
    where p ->> 'name' = 'Zorbo Milk 1 L'),
  1, 'two dukans selling the same product make one tile'
);
select is(
  (select p ->> 'shop_id' from jsonb_array_elements(public.storefront_products(null, 'Zorbo Milk 1 L', null, 50, 25.395, 68.365)) p
    where p ->> 'name' = 'Zorbo Milk 1 L'),
  tests.id('near_two')::text, 'the tile is the cheapest offer'
);
select is(
  (select (p ->> 'offers')::integer from jsonb_array_elements(public.storefront_products(null, 'Zorbo Milk 1 L', null, 50, 25.395, 68.365)) p
    where p ->> 'name' = 'Zorbo Milk 1 L'),
  2, 'and says how many dukans have it'
);
select ok(
  exists (select 1 from jsonb_array_elements(public.storefront_products(null, null, tests.id('near_one'), 50)) p
           where p ->> 'id' = tests.id('milk_one')::text),
  'inside a dukan its own offer shows, cheapest or not'
);

-- Search, sorting, brands.
select ok(
  exists (select 1 from jsonb_array_elements(public.storefront_products(null, 'doodh', null, 50, 25.395, 68.365)) p
           where p ->> 'name' = 'Zorbo Milk 1 L'),
  'a Roman Urdu name finds the product through its alias'
);
select ok(
  exists (select 1 from jsonb_array_elements(public.storefront_products(null, 'zorbo mlik', null, 50, 25.395, 68.365)) p
           where p ->> 'name' = 'Zorbo Milk 1 L'),
  'a spelling mistake still finds it'
);
select is(
  jsonb_array_length(public.storefront_products(null, 'xylophone', null, 50, 25.395, 68.365)), 0,
  'something no dukan has finds nothing'
);
select is(
  public.storefront_products(tests.id('dairy'), null, null, 50, 25.395, 68.365, null, 'price_asc') -> 0 ->> 'name',
  'Plainio Dahi 400 g', 'cheapest first puts the cheapest first'
);
select is(
  public.storefront_products(tests.id('dairy'), null, null, 50, 25.395, 68.365, null, 'price_desc') -> 0 ->> 'name',
  'Zorbo Milk 1 L', 'dearest first puts the dearest first'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.storefront_products(null, null, null, 50, 25.395, 68.365, tests.id('zorbo'))) p),
  2, 'a brand filter shows only that brand (one tile per product)'
);
select ok(
  exists (select 1 from jsonb_array_elements(public.storefront_brands(25.395, 68.365)) b
           where b ->> 'id' = tests.id('zorbo')::text),
  'the brand is offered to browse where it can be delivered'
);
select ok(
  not exists (select 1 from jsonb_array_elements(public.storefront_brands(25.45, 68.36)) b
               where b ->> 'id' = tests.id('zorbo')::text),
  'and not 6.7 km away'
);

-- Counts are of what can be delivered.
select is(
  (select (c ->> 'product_count')::integer from jsonb_array_elements(public.storefront_categories(25.395, 68.365)) c
    where c ->> 'id' = tests.id('dairy')::text),
  4, 'a category counts what can be delivered to the shopper'
);
select is(
  (select (c ->> 'product_count')::integer from jsonb_array_elements(public.storefront_categories(25.45, 68.36)) c
    where c ->> 'id' = tests.id('dairy')::text),
  0, 'and nothing where no dukan delivers'
);

-- The product page.
select is(
  jsonb_array_length(public.storefront_product(tests.id('milk_one'), 25.395, 68.365) -> 'sizes'), 2,
  'the product page lists the sizes the dukan has'
);
select is(
  public.storefront_product(tests.id('milk_one'), 25.395, 68.365) -> 'offers' -> 0 ->> 'shop_id',
  tests.id('near_two')::text, 'and the other dukan selling the same product'
);
select ok(
  (select bool_and(s ->> 'id' = tests.id('dahi')::text)
     from jsonb_array_elements(public.storefront_product(tests.id('milk_one'), 25.395, 68.365) -> 'similar') s),
  'similar products leave out the product itself, its sizes and its other offers'
);

-- Stars: only for a delivered order, only by the buyer.
select tests.remember('order', (public.place_customer_order(
  tests.id('near_one'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('milk_one'), 'qty', 1)),
  tests.id('home')
) ->> 'id')::uuid);
select tests.remember('line', (select id from public.customer_order_items where customer_order_id = tests.id('order')));

select throws_ok(
  format($$ select public.rate_order_items(%L, jsonb_build_array(jsonb_build_object('item_id', %L, 'rating', 5))) $$,
         tests.id('order'), tests.id('line')),
  '22023', 'not_delivered', 'an order that has not arrived cannot be rated'
);

select tests.clear_authentication();
update public.customer_orders set status = 'delivered', delivered_at = now() where id = tests.id('order');

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.rate_order_items(%L, jsonb_build_array(jsonb_build_object('item_id', %L, 'rating', 1))) $$,
         tests.id('order'), tests.id('line')),
  'P0002', 'order_not_found', 'someone else cannot rate the order'
);

select tests.authenticate_as('shopper');
select is(
  public.rate_order_items(tests.id('order'), jsonb_build_array(jsonb_build_object('item_id', tests.id('line'), 'rating', 5))),
  1, 'the buyer rates what they bought'
);
select is(
  (select (p ->> 'rating')::numeric from jsonb_array_elements(public.storefront_products(null, 'Zorbo Milk 1 L', null, 50, 25.395, 68.365)) p
    where p ->> 'name' = 'Zorbo Milk 1 L'),
  5.0, 'the stars show on the product at every dukan that sells it'
);
select public.rate_order_items(tests.id('order'), jsonb_build_array(jsonb_build_object('item_id', tests.id('line'), 'rating', 3)));
select is(
  (select rating_sum::text || '/' || rating_count::text from public.product_rating_stats where id = tests.id('milk')),
  '3/1', 'rating again replaces the earlier stars'
);
select throws_ok(
  format($$ select public.rate_order_items(%L, jsonb_build_array(jsonb_build_object('item_id', %L, 'rating', 6))) $$,
         tests.id('order'), tests.id('line')),
  '22023', 'invalid_rating', 'six stars are refused'
);
select throws_ok(
  format($$ insert into public.product_ratings (customer_order_item_id, customer_order_id, shop_id, product_key, rating)
            values (%L, %L, %L, %L, 5) $$,
         tests.id('line'), tests.id('order'), tests.id('near_one'), tests.id('milk')),
  '42501', null, 'stars cannot be written around the function'
);
select ok(
  exists (select 1 from jsonb_array_elements(public.my_buy_again(12, 25.395, 68.365)) p
           where p ->> 'id' = tests.id('milk_one')::text),
  'what was bought shows in Buy again'
);
select is(
  public.my_buy_again(12, 25.45, 68.36), '[]'::jsonb,
  'but not where the dukan does not deliver'
);

-- Who can read the ratings themselves.
select tests.authenticate_as('owner_two');
select is(
  (select count(*)::integer from public.product_ratings), 0,
  'another dukan does not see who rated what'
);

select * from finish();
rollback;
