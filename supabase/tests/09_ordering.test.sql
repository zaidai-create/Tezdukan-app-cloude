-- Phase 2 ordering RPCs: pricing precedence, scheme maths, search, the cart, checkout rules
-- (MOQ, minimum order, credit and holds, stock, slots, idempotency, all-or-nothing), cancel
-- windows, reorder, rating, returns, the ledger and tenant isolation.
-- Seeded distributors serve every area, so catalog checks always filter by the test org.
begin;
\ir helpers/setup.psql
select plan(68);

-- Fixtures -----------------------------------------------------------------------------------------
create or replace function tests.make_product(
  p_alias text,
  p_org text,
  p_name text,
  p_trade bigint,
  p_mrp bigint,
  p_moq integer default 1,
  p_carton integer default null,
  p_master text default null
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.distributor_products (org_id, master_product_id, name, sku, trade_price_paisa, mrp_paisa, moq_base_qty)
  values (
    tests.id(p_org), case when p_master is not null then tests.id(p_master) end, p_name,
    'T-' || substr(md5(random()::text), 1, 8), p_trade, p_mrp, p_moq
  )
  returning id into v_id;
  perform tests.remember(p_alias, v_id);
  insert into public.pack_units (distributor_product_id, unit, label, base_qty, is_default)
  values (v_id, 'piece', 'Piece', 1, p_carton is null)
  returning tests.remember(p_alias || ':piece', id) into v_id;
  if p_carton is not null then
    insert into public.pack_units (distributor_product_id, unit, label, base_qty, is_default)
    values (tests.id(p_alias), 'carton', 'Carton', p_carton, true)
    returning tests.remember(p_alias || ':carton', id) into v_id;
  end if;
  return tests.id(p_alias);
end;
$$;

-- {"<org>": {"start", "end"}} with the org's first slot, read through the public RPC (caller's rights).
create or replace function tests.first_slot(p_shop text, p_org text)
returns jsonb
language sql
as $$
  select jsonb_build_object(tests.id(p_org)::text, jsonb_build_object('start', s.slot_start, 'end', s.slot_end))
    from public.delivery_slots(tests.id(p_shop), tests.id(p_org), 1) s
   order by s.slot_start
   limit 1
$$;

-- The cart line for a product in cart_summary, as the current user.
create or replace function tests.cart_line(p_shop text, p_product text)
returns jsonb
language sql
as $$
  select i.value
    from jsonb_array_elements(public.cart_summary(tests.id(p_shop)) -> 'groups') g,
         jsonb_array_elements(g.value -> 'items') i
   where i.value -> 'item' ->> 'distributor_product_id' = tests.id(p_product)::text
$$;

grant execute on all functions in schema tests to anon, authenticated;

select tests.create_user('ali');
select tests.create_user('bilal');
select tests.create_user('dist_x');
select tests.create_user('dist_y');
select tests.create_user('booker_x');
select tests.create_user('stranger');
select tests.make_area('zone_a');
select tests.make_area('zone_b');
select tests.make_shop('shop_a', 'ali', 'approved', tests.id('zone_a'));
select tests.make_shop('shop_b', 'bilal', 'approved', tests.id('zone_b'));
update public.shops set tier = 'gold' where id = tests.id('shop_a');
select tests.make_org('org_x', 'dist_x');
select tests.make_org('org_y', 'dist_y');
select tests.make_org('org_z', 'dist_y');
select tests.add_org_member('org_x', 'booker_x', 'booker');
update public.organizations
   set min_order_paisa = 1000, delivery_fee_paisa = 5000, free_delivery_above_paisa = 100000,
       settings = '{"order_cutoff_time": "23:59", "delivery_days": [1, 2, 3, 4, 5, 6, 7], "enforce_stock": false}'
 where id = tests.id('org_x');
-- org_y delivers only to zone_b and enforces stock; org_z has a high minimum order.
update public.organizations
   set served_area_ids = array[tests.id('zone_b')], settings = '{"enforce_stock": true}'
 where id = tests.id('org_y');
update public.organizations set min_order_paisa = 10000000 where id = tests.id('org_z');

insert into public.master_products (name, name_ur, category_id, pack_size_label)
select 'Tapal Danedar', 'ٹپال دانے دار چائے', c.id, '950 g' from public.categories c order by c.sort_order limit 1
returning tests.remember('mp_tea', id);
insert into public.product_aliases (target_type, master_product_id, alias, language, kind)
values ('product', tests.id('mp_tea'), 'چائے پتی', 'ur', 'generic');

select tests.make_product('tea', 'org_x', 'Tapal Danedar 950 g', 1000, 1200, 1, 12, 'mp_tea');
select tests.make_product('milk', 'org_x', 'Olpers Milk 1 L', 500, 600);
select tests.make_product('masala', 'org_x', 'Shan Biryani 50 g', 200, 250);
select tests.make_product('soap', 'org_x', 'Lux Soap 128 g', 100, 130);
select tests.make_product('oil', 'org_x', 'Dalda Oil 1 L', 300, 360);
select tests.make_product('bun_a', 'org_x', 'Bundle Ketchup', 400, 450);
select tests.make_product('bun_b', 'org_x', 'Bundle Noodles', 300, 350);
select tests.make_product('moq', 'org_x', 'Sugar Bag', 700, 800, 6);
select tests.make_product('gone', 'org_x', 'Discontinued Biscuit', 50, 60);
select tests.make_product('y_tea', 'org_y', 'Tapal Danedar 950 g', 990, 1200, 1, null, 'mp_tea');
select tests.make_product('y_out', 'org_y', 'Haleeb Milk 1 L', 480, 600);
select tests.make_product('z_cheap', 'org_z', 'Matchbox', 10, 12);
update public.distributor_products set barcode = '2009988776655' where id = tests.id('soap');

-- Price tiers: an account tier for shop_a (tea) and an area tier for zone_a (tea and milk).
insert into public.price_tiers (org_id, name, kind, segment) values (tests.id('org_x'), 'Gold', 'segment', 'gold')
returning tests.remember('tier_gold', id);
insert into public.price_tiers (org_id, name, kind, area_id) values (tests.id('org_x'), 'Zone A', 'area', tests.id('zone_a'))
returning tests.remember('tier_zone', id);
insert into public.price_tier_items (price_tier_id, distributor_product_id, price_paisa)
values (tests.id('tier_gold'), tests.id('tea'), 900),
       (tests.id('tier_zone'), tests.id('tea'), 950),
       (tests.id('tier_zone'), tests.id('milk'), 480);
insert into public.retailer_accounts (org_id, shop_id, price_tier_id, credit_limit_paisa, payment_terms_days, assigned_booker_id)
values (tests.id('org_x'), tests.id('shop_a'), tests.id('tier_gold'), 40000, 7, tests.id('org_x:booker_x'))
returning tests.remember('ra_a', id);

-- Schemes on org_x.
insert into public.schemes (org_id, name, kind, rules) values
  (tests.id('org_x'), 'Milk 12+1', 'buy_x_get_y', '{"buy_base_qty": 12, "free_base_qty": 1}'),
  (tests.id('org_x'), 'Masala slab', 'slab_discount', '{"basis": "quantity", "slabs": [{"min": 24, "discount_bps": 200}, {"min": 48, "discount_bps": 300}]}'),
  (tests.id('org_x'), 'Soap 5%', 'flat_discount', '{"discount_bps": 500}'),
  (tests.id('org_x'), 'Oil 10 paisa', 'flat_discount', '{"discount_paisa_per_unit": 10}'),
  (tests.id('org_x'), 'Combo', 'bundle', '{"min_base_qty": 6, "discount_paisa": 1000}'),
  (tests.id('org_x'), 'Silver only', 'flat_discount', '{"discount_bps": 9000}');
update public.schemes set segments = array['silver'::public.shop_tier] where name = 'Silver only' and org_id = tests.id('org_x');
insert into public.scheme_products (scheme_id, distributor_product_id, role)
select s.id, tests.id(x.product), x.role::public.scheme_product_role
  from (values ('Milk 12+1', 'milk', 'trigger'), ('Masala slab', 'masala', 'trigger'), ('Soap 5%', 'soap', 'trigger'),
               ('Oil 10 paisa', 'oil', 'trigger'), ('Combo', 'bun_a', 'bundle_item'), ('Combo', 'bun_b', 'bundle_item'),
               ('Silver only', 'tea', 'trigger')) as x(scheme, product, role)
  join public.schemes s on s.name = x.scheme and s.org_id = tests.id('org_x');

-- Stock at org_y: 5 of the tea, none of the milk (org_y keeps stock records, so milk is out).
insert into public.warehouses (org_id, name, code, is_default) values (tests.id('org_y'), 'Y godown', 'Y1', true)
returning tests.remember('wh_y', id);
insert into public.stock_batches (org_id, warehouse_id, distributor_product_id, qty_on_hand)
values (tests.id('org_y'), tests.id('wh_y'), tests.id('y_tea'), 5);

-- Scheme maths (pure function) ---------------------------------------------------------------------
select is(
  (select row(free_base_qty, discount_paisa)::text from private.scheme_line_effect('buy_x_get_y', '{"buy_base_qty": 12, "free_base_qty": 1}', 25, 0)),
  '(2,0)', 'buy 12 get 1: 25 pieces earn 2 free'
);
select is(
  (select discount_paisa from private.scheme_line_effect('slab_discount', '{"basis": "amount", "slabs": [{"min": 10000, "discount_bps": 100}, {"min": 50000, "discount_bps": 250}]}', 10, 60000)),
  1500::bigint, 'amount slab picks the highest slab reached'
);
select is(
  (select discount_paisa from private.scheme_line_effect('slab_discount', '{"basis": "quantity", "slabs": [{"min": 24, "discount_bps": 200}]}', 23, 4600)),
  0::bigint, 'below the first slab there is no discount'
);
select is(
  (select discount_paisa from private.scheme_line_effect('flat_discount', '{"discount_paisa_per_unit": 50}', 10, 300)),
  300::bigint, 'per-piece discounts never exceed the line'
);

-- Visibility, pricing precedence and search ---------------------------------------------------------
select tests.authenticate_as('ali');
select is(
  (select count(*)::integer from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_x'), p_limit => 100)),
  9, 'shop_a sees every active product of org_x'
);
select is(
  (select price_paisa from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_x'), p_limit => 100)
    where distributor_product_id = tests.id('tea')),
  900::bigint, 'the account price tier wins'
);
select is(
  (select price_paisa from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_x'), p_limit => 100)
    where distributor_product_id = tests.id('milk')),
  480::bigint, 'then the area tier for the shop''s zone'
);
select is(
  (select price_paisa from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_x'), p_limit => 100)
    where distributor_product_id = tests.id('masala')),
  200::bigint, 'then the trade price'
);
select is(
  (select count(*)::integer from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_y'))),
  0, 'a distributor that does not serve the shop''s zone is hidden'
);
select is(
  (select scheme ->> 'name' from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_x'), p_limit => 100)
    where distributor_product_id = tests.id('tea')),
  null, 'a scheme for another shop tier does not apply'
);
select is(
  (select array_agg(name order by price_paisa) from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_x'), p_sort => 'price_asc', p_limit => 3)),
  array['Discontinued Biscuit', 'Lux Soap 128 g', 'Shan Biryani 50 g'], 'price_asc sorts cheapest first'
);
select is(
  (select count(*)::integer from public.browse_catalog(tests.id('shop_a'), p_org_id => tests.id('org_x'), p_filters => '{"has_scheme": true}', p_limit => 100)),
  6, 'has_scheme keeps only products with a live scheme'
);
select throws_ok(
  format($$ select * from public.browse_catalog(%L, p_sort => 'cheapest') $$, tests.id('shop_a')),
  '22023', 'invalid_sort', 'unknown sorts are rejected'
);
select is(
  (select distributor_product_id from public.search_catalog(tests.id('shop_a'), '2009988776655', 5) limit 1),
  tests.id('soap'), 'an exact barcode match comes first'
);
select ok(
  exists (select 1 from public.search_catalog(tests.id('shop_a'), 'tapl', 20) where distributor_product_id = tests.id('tea')),
  'a typo still finds the product'
);
select ok(
  exists (select 1 from public.search_catalog(tests.id('shop_a'), 'چائے پتی', 20) where distributor_product_id = tests.id('tea')),
  'an Urdu alias finds the product'
);
select is(
  (select (public.catalog_facets(tests.id('shop_a')) -> 'distributors') @> jsonb_build_array(jsonb_build_object('id', tests.id('org_x'), 'product_count', 9))),
  true, 'facets count what the shop can order per distributor'
);
select is(
  (select jsonb_array_length(public.product_detail(tests.id('shop_a'), tests.id('tea')) -> 'schemes')),
  0, 'product detail lists only schemes live for this shop'
);

-- Cart and scheme effects -----------------------------------------------------------------------------
select throws_ok(
  format($$ select public.set_cart_item(%L, %L, %L, 1) $$, tests.id('shop_a'), tests.id('tea'), tests.id('milk:piece')),
  '22023', 'invalid_pack_unit', 'a pack unit of another product is rejected'
);
select throws_ok(
  format($$ select public.set_cart_item(%L, %L, %L, -2) $$, tests.id('shop_a'), tests.id('tea'), tests.id('tea:piece')),
  '22023', 'invalid_quantity', 'negative quantities are rejected'
);
select lives_ok(
  format($$
    select public.set_cart_item(%1$L, %2$L, %3$L, 24), public.set_cart_item(%1$L, %4$L, %5$L, 48),
           public.set_cart_item(%1$L, %6$L, %7$L, 10), public.set_cart_item(%1$L, %8$L, %9$L, 5),
           public.set_cart_item(%1$L, %10$L, %11$L, 12), public.set_cart_item(%1$L, %12$L, %13$L, 6),
           public.set_cart_item(%1$L, %14$L, %15$L, 1)
  $$, tests.id('shop_a'), tests.id('milk'), tests.id('milk:piece'), tests.id('masala'), tests.id('masala:piece'),
      tests.id('soap'), tests.id('soap:piece'), tests.id('oil'), tests.id('oil:piece'),
      tests.id('bun_a'), tests.id('bun_a:piece'), tests.id('bun_b'), tests.id('bun_b:piece'),
      tests.id('tea'), tests.id('tea:carton')),
  'lines can be added'
);
select is((tests.cart_line('shop_a', 'milk') ->> 'free_base_qty')::integer, 2, 'buy 12 get 1 gives 2 free on 24');
select is((tests.cart_line('shop_a', 'masala') ->> 'line_discount_paisa')::bigint, 288::bigint, 'slab discount: 3% of 48 pieces');
select is((tests.cart_line('shop_a', 'soap') ->> 'line_discount_paisa')::bigint, 50::bigint, 'flat 5% discount');
select is((tests.cart_line('shop_a', 'oil') ->> 'line_discount_paisa')::bigint, 50::bigint, 'flat paisa-per-piece discount');
select is(
  (tests.cart_line('shop_a', 'bun_a') ->> 'line_discount_paisa')::bigint + (tests.cart_line('shop_a', 'bun_b') ->> 'line_discount_paisa')::bigint,
  1000::bigint, 'one complete bundle set earns its discount once'
);
select is((tests.cart_line('shop_a', 'tea') ->> 'unit_price_paisa')::bigint, 10800::bigint, 'a carton is priced as pieces times the tier price');
select is(
  (select (g -> 'subtotal_paisa')::bigint - (g -> 'scheme_discount_paisa')::bigint + (g -> 'delivery_charge_paisa')::bigint - (g -> 'total_paisa')::bigint
     from jsonb_array_elements(public.cart_summary(tests.id('shop_a')) -> 'groups') g
    where g ->> 'org_id' = tests.id('org_x')::text),
  0::bigint, 'group totals add up'
);
select is(
  (select (g ->> 'delivery_charge_paisa')::bigint from jsonb_array_elements(public.cart_summary(tests.id('shop_a')) -> 'groups') g
    where g ->> 'org_id' = tests.id('org_x')::text),
  5000::bigint, 'the delivery fee applies below the free-delivery threshold'
);
select public.set_cart_item(tests.id('shop_a'), tests.id('moq'), tests.id('moq:piece'), 3);
select is(tests.cart_line('shop_a', 'moq') -> 'problems', '["below_moq"]'::jsonb, 'below the product minimum is flagged');

-- Checkout rules ------------------------------------------------------------------------------------
select throws_ok(
  format($$ select public.place_order(%L, gen_random_uuid(), 'cod', tests.first_slot('shop_a', 'org_x')) $$, tests.id('shop_a')),
  '23514', 'below_minimum', 'an order below a product''s minimum is refused'
);
select public.set_cart_item(tests.id('shop_a'), tests.id('moq'), tests.id('moq:piece'), 6);
select throws_ok(
  format($$ select public.place_order(%L, gen_random_uuid(), 'cod', '{}'::jsonb) $$, tests.id('shop_a')),
  '23514', 'slot_unavailable', 'a slot is required'
);
select throws_ok(
  format($$ select public.place_order(%L, gen_random_uuid(), 'credit', tests.first_slot('shop_a', 'org_x')) $$, tests.id('shop_a')),
  '23514', 'credit_limit_exceeded', 'a credit order above the available credit is refused'
);

-- All or nothing: org_z's group is below its minimum, so org_x is not ordered either.
select public.set_cart_item(tests.id('shop_a'), tests.id('z_cheap'), tests.id('z_cheap:piece'), 2);
select throws_ok(
  format($$ select public.place_order(%L, gen_random_uuid(), 'cod', tests.first_slot('shop_a', 'org_x') || tests.first_slot('shop_a', 'org_z')) $$, tests.id('shop_a')),
  '23514', 'below_minimum', 'one failing distributor stops the whole checkout'
);
select is((select count(*)::integer from public.orders where shop_id = tests.id('shop_a')), 0, 'and nothing was ordered');

select tests.clear_authentication();
update public.retailer_accounts set status = 'on_hold' where id = tests.id('ra_a');
select tests.authenticate_as('ali');
select throws_ok(
  format($$ select public.place_order(%L, gen_random_uuid(), 'credit', tests.first_slot('shop_a', 'org_x'), null, array[%L::uuid]) $$, tests.id('shop_a'), tests.id('org_x')),
  '23514', 'account_on_hold', 'an account on hold cannot order on credit'
);
select tests.clear_authentication();
update public.retailer_accounts set status = 'blocked' where id = tests.id('ra_a');
select tests.authenticate_as('ali');
select throws_ok(
  format($$ select public.place_order(%L, gen_random_uuid(), 'cod', tests.first_slot('shop_a', 'org_x'), null, array[%L::uuid]) $$, tests.id('shop_a'), tests.id('org_x')),
  '23514', 'account_blocked', 'a blocked account cannot order at all'
);
select tests.clear_authentication();
update public.retailer_accounts set status = 'on_hold' where id = tests.id('ra_a');
select tests.authenticate_as('ali');

-- Happy path: cash on delivery is allowed on hold, and a retry returns the same order.
select lives_ok(
  format($$ select public.place_order(%L, '6f1c1c0e-1d7a-4a7b-9b1a-2a3c4d5e6f70', 'cod', tests.first_slot('shop_a', 'org_x'), 'Before 11', array[%L::uuid]) $$,
    tests.id('shop_a'), tests.id('org_x')),
  'cash on delivery is allowed while on hold'
);
select tests.clear_authentication();
select tests.remember('order_a', (select id from public.orders where shop_id = tests.id('shop_a')));
select tests.authenticate_as('ali');
select is(
  (public.place_order(tests.id('shop_a'), '6f1c1c0e-1d7a-4a7b-9b1a-2a3c4d5e6f70', 'cod', '{}'::jsonb) -> 'orders' -> 0 ->> 'id')::uuid,
  tests.id('order_a'), 'a retry with the same request id returns the same order'
);
select is((select count(*)::integer from public.orders where shop_id = tests.id('shop_a')), 1, 'only one order exists');
select is(
  (select subtotal_paisa - scheme_discount_paisa + delivery_fee_paisa - total_paisa from public.orders where id = tests.id('order_a')),
  0::bigint, 'the order total is consistent'
);
select is(
  (select sum(free_base_qty)::integer from public.order_items where order_id = tests.id('order_a') and distributor_product_id = tests.id('milk')),
  2, 'free goods are snapshotted on the order line'
);
select is(
  (select to_status::text from public.order_status_history where order_id = tests.id('order_a')),
  'new', 'status history starts at new'
);
select ok(
  (select code ~ '^[0-9]{4}$' from public.delivery_otps where order_id = tests.id('order_a')),
  'the shop can read its delivery code'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.cart_summary(tests.id('shop_a')) -> 'groups') g
    where g ->> 'org_id' = tests.id('org_x')::text),
  0, 'ordered lines leave the cart; other distributors stay'
);
select tests.clear_authentication();
select ok(
  exists (select 1 from public.notifications where user_id = tests.id('dist_x') and data ->> 'event' = 'order.created'),
  'the distributor is notified'
);
select tests.authenticate_as('dist_x');
select is((select count(*)::integer from public.delivery_otps where order_id = tests.id('order_a')), 0, 'the distributor cannot read the delivery code');
select tests.clear_authentication();

-- Stock (org_y enforces it) ---------------------------------------------------------------------------
select tests.authenticate_as('bilal');
select is(
  (select in_stock from public.browse_catalog(tests.id('shop_b'), p_org_id => tests.id('org_y')) where distributor_product_id = tests.id('y_out')),
  false, 'no stock records for a product means out of stock when the distributor keeps stock'
);
select public.set_cart_item(tests.id('shop_b'), tests.id('y_tea'), tests.id('y_tea:piece'), 8);
select is(tests.cart_line('shop_b', 'y_tea') -> 'problems', '["insufficient_stock"]'::jsonb, 'more than the stock is flagged');
select throws_ok(
  format($$ select public.place_order(%L, gen_random_uuid(), 'cod', tests.first_slot('shop_b', 'org_y')) $$, tests.id('shop_b')),
  '23514', 'insufficient_stock', 'and cannot be ordered'
);

-- Tenant isolation ------------------------------------------------------------------------------------
select throws_ok(
  format($$ select public.cart_summary(%L) $$, tests.id('shop_a')),
  '42501', 'not_allowed', 'another shop''s cart is off limits'
);
select throws_ok(
  format($$ select public.set_cart_item(%L, %L, %L, 1) $$, tests.id('shop_a'), tests.id('tea'), tests.id('tea:piece')),
  '42501', 'not_allowed', 'and so is adding to it'
);
select is(
  (select price_paisa from public.browse_catalog(tests.id('shop_b'), p_org_id => tests.id('org_x'), p_limit => 100)
    where distributor_product_id = tests.id('tea')),
  1000::bigint, 'another shop never gets shop_a''s tier price'
);
select is((select count(*)::integer from public.orders where id = tests.id('order_a')), 0, 'another shop cannot read the order');
select throws_ok(
  format($$ select public.cancel_order(%L, 'not mine') $$, tests.id('order_a')),
  'P0002', 'order_not_found', 'or cancel it'
);
select tests.clear_authentication();

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select * from public.browse_catalog(%L) $$, tests.id('shop_a')),
  '42501', 'not_allowed', 'a user with no role at the shop cannot browse for it'
);
select tests.clear_authentication();

-- A booker orders only from their own distributor ------------------------------------------------------
select tests.authenticate_as('booker_x');
select is(
  (select array_agg(distinct org_id) from public.browse_catalog(tests.id('shop_a'), p_limit => 100)),
  array[tests.id('org_x')], 'the booker sees only their distributor''s products'
);
select tests.clear_authentication();

-- Cancel windows ------------------------------------------------------------------------------------------
update public.orders set status = 'packed' where id = tests.id('order_a');
select tests.authenticate_as('ali');
select throws_ok(
  format($$ select public.cancel_order(%L, 'Changed my mind') $$, tests.id('order_a')),
  '55000', 'cannot_cancel', 'the shop cannot cancel once packing has started'
);
select tests.clear_authentication();
select tests.authenticate_as('dist_x');
select is((public.cancel_order(tests.id('order_a'), 'Route full today')).status::text, 'cancelled', 'the distributor can cancel before delivery');
select tests.clear_authentication();

-- Reorder skips what is gone ---------------------------------------------------------------------------
update public.distributor_products set is_active = false where id = tests.id('soap');
select tests.authenticate_as('ali');
select is(
  (select r -> 'skipped' from public.reorder(tests.id('order_a')) as r),
  '[{"name": "Lux Soap 128 g", "reason": "unavailable"}]'::jsonb, 'reorder skips products that are no longer orderable'
);
select tests.clear_authentication();

-- Rating and returns after delivery --------------------------------------------------------------------
update public.orders set status = 'delivered', delivered_at = now() - interval '1 day' where id = tests.id('order_a');
update public.order_items set delivered_base_qty = base_qty where order_id = tests.id('order_a');
select tests.authenticate_as('ali');
select lives_ok(format($$ select public.rate_order(%L, 5::smallint, 'Shabash') $$, tests.id('order_a')), 'a delivered order can be rated');
select throws_ok(
  format($$ select public.rate_order(%L, 4::smallint) $$, tests.id('order_a')),
  '55000', 'already_rated', 'only once'
);
select throws_ok(
  format($$ select public.request_return(%L, jsonb_build_array(jsonb_build_object('order_item_id', %L, 'base_qty', 30, 'reason', 'damaged'))) $$,
    tests.id('order_a'), (select id from public.order_items where order_id = tests.id('order_a') and distributor_product_id = tests.id('milk'))),
  '23514', 'return_exceeds_delivered', 'a claim cannot exceed what was delivered'
);
select is(
  (select claim_total_paisa from public.request_return(
     tests.id('order_a'),
     jsonb_build_array(jsonb_build_object(
       'order_item_id', (select id from public.order_items where order_id = tests.id('order_a') and distributor_product_id = tests.id('masala')),
       'base_qty', 4, 'reason', 'damaged'))
  )),
  776::bigint, 'a claim is valued at the net price per piece'
);
select tests.clear_authentication();

-- The ledger as the shop sees it -------------------------------------------------------------------------
do $$
declare
  v_journal uuid;
begin
  insert into public.ledger_journals (book_type, org_id, entry_date, reference_type, reference_id)
  values ('org', tests.id('org_x'), current_date - 40, 'order', tests.id('order_a'))
  returning id into v_journal;
  insert into public.ledger_entries (journal_id, account_id, debit_paisa, credit_paisa, entry_date, due_date, reference_type, reference_id)
  values (v_journal, private.org_ledger_account(tests.id('org_x'), 'receivable', tests.id('shop_a')), 20000, 0, current_date - 40, current_date - 33, 'order', tests.id('order_a')),
         (v_journal, private.org_ledger_account(tests.id('org_x'), 'sales'), 0, 20000, current_date - 40, null, 'order', tests.id('order_a'));
end;
$$;
select tests.authenticate_as('ali');
select is((public.shop_ledger(tests.id('shop_a'), tests.id('org_x')) ->> 'balance_paisa')::bigint, 20000::bigint, 'the balance comes from the distributor''s receivable account');
select is((public.shop_ledger(tests.id('shop_a'), tests.id('org_x')) -> 'aging' ->> 'd31_60')::bigint, 20000::bigint, 'an invoice 33 days overdue ages into 31-60');
select is((public.shop_ledger(tests.id('shop_a'), tests.id('org_x')) ->> 'available_credit_paisa')::bigint, 20000::bigint, 'available credit is the limit minus the balance');
select tests.clear_authentication();
select tests.authenticate_as('bilal');
select throws_ok(
  format($$ select public.shop_ledger(%L, %L) $$, tests.id('shop_a'), tests.id('org_x')),
  '42501', 'not_allowed', 'another shop cannot read this ledger'
);
select tests.clear_authentication();

select * from finish();
rollback;
