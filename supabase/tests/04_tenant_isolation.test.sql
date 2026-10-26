-- Tenant isolation (the spec's acceptance test): a dukandar cannot see another shop's data, a
-- distributor cannot see another distributor's data, bookers/riders see only what is assigned to
-- them, customers see only their own rows, anon sees only reference data.
begin;
\ir helpers/setup.psql
select plan(59);

-- Fixtures (as postgres) --------------------------------------------------------------------------
select tests.create_user('ali');
select tests.create_user('bilal');
select tests.create_user('cashier');
select tests.create_user('dist_x');
select tests.create_user('dist_y');
select tests.create_user('booker_x');
select tests.create_user('rider_x');
select tests.create_user('cust');
select tests.create_user('cust2');
select tests.create_user('stranger');
select tests.make_admin('adm');

select tests.make_area('zone_a');
select tests.make_shop('shop_a', 'ali', 'approved', tests.id('zone_a'));
select tests.make_shop('shop_b', 'bilal', 'approved', tests.id('zone_a'));
select tests.add_shop_staff('shop_a', 'cashier', 'cashier', array['billing']);
select tests.make_org('org_x', 'dist_x');
select tests.make_org('org_y', 'dist_y');
select tests.add_org_member('org_x', 'booker_x', 'booker');
select tests.add_org_member('org_x', 'rider_x', 'rider');

insert into public.categories (name, slug) values ('Test Tea', 'test-tea') returning tests.remember('cat', id);

insert into public.distributor_products (org_id, name, sku, trade_price_paisa, mrp_paisa, category_id)
values (tests.id('org_x'), 'X Tea 950 g', 'X-TEA-950', 180000, 199000, tests.id('cat'))
returning tests.remember('dp_x', id);
insert into public.distributor_products (org_id, name, sku, trade_price_paisa, mrp_paisa, category_id)
values (tests.id('org_y'), 'Y Tea 950 g', 'Y-TEA-950', 181000, 199000, tests.id('cat'))
returning tests.remember('dp_y', id);
insert into public.pack_units (distributor_product_id, unit, label, base_qty, is_default)
values (tests.id('dp_x'), 'piece', 'Piece', 1, true), (tests.id('dp_y'), 'piece', 'Piece', 1, true);

insert into public.price_tiers (org_id, name, kind, segment) values (tests.id('org_x'), 'Gold', 'segment', 'gold') returning tests.remember('tier_x', id);
insert into public.price_tiers (org_id, name, kind, segment) values (tests.id('org_y'), 'Gold', 'segment', 'gold') returning tests.remember('tier_y', id);
insert into public.price_tier_items (price_tier_id, distributor_product_id, price_paisa)
values (tests.id('tier_x'), tests.id('dp_x'), 175000), (tests.id('tier_y'), tests.id('dp_y'), 176000);

insert into public.retailer_accounts (org_id, shop_id, credit_limit_paisa, assigned_booker_id)
values (tests.id('org_x'), tests.id('shop_a'), 5000000, tests.id('org_x:booker_x'))
returning tests.remember('ra_xa', id);
insert into public.retailer_accounts (org_id, shop_id) values (tests.id('org_y'), tests.id('shop_b')) returning tests.remember('ra_yb', id);
insert into public.retailer_accounts (org_id, shop_id) values (tests.id('org_x'), tests.id('shop_b')) returning tests.remember('ra_xb', id);

insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand)
values (tests.id('shop_a'), 'A Tea', 199000, 10) returning tests.remember('inv_a', id);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand)
values (tests.id('shop_b'), 'B Tea', 199000, 10) returning tests.remember('inv_b', id);

insert into public.shop_customers (shop_id, name) values (tests.id('shop_a'), 'Ahmed Bhai') returning tests.remember('kc_a', id);
insert into public.shop_customers (shop_id, name) values (tests.id('shop_b'), 'Saleem Bhai') returning tests.remember('kc_b', id);

insert into public.pos_bills (shop_id, client_id, bill_number, status, subtotal_paisa, total_paisa, paid_cash_paisa)
values (tests.id('shop_a'), gen_random_uuid(), 1, 'completed', 10000, 10000, 10000) returning tests.remember('bill_a', id);
insert into public.pos_bills (shop_id, client_id, bill_number, status, subtotal_paisa, total_paisa, paid_cash_paisa)
values (tests.id('shop_b'), gen_random_uuid(), 1, 'completed', 10000, 10000, 10000) returning tests.remember('bill_b', id);

insert into public.orders (order_number, shop_id, org_id, payment_method, subtotal_paisa, total_paisa, booker_id)
values ('T-XA', tests.id('shop_a'), tests.id('org_x'), 'cod', 10000, 10000, tests.id('org_x:booker_x')) returning tests.remember('o_xa', id);
insert into public.orders (order_number, shop_id, org_id, payment_method, subtotal_paisa, total_paisa)
values ('T-YB', tests.id('shop_b'), tests.id('org_y'), 'cod', 10000, 10000) returning tests.remember('o_yb', id);
insert into public.orders (order_number, shop_id, org_id, payment_method, subtotal_paisa, total_paisa)
values ('T-XB', tests.id('shop_b'), tests.id('org_x'), 'credit', 10000, 10000) returning tests.remember('o_xb', id);
insert into public.order_items (order_id, org_id, shop_id, distributor_product_id, name, pack_unit, base_qty_per_unit, quantity, piece_price_paisa, unit_price_paisa, line_total_paisa)
select o.id, o.org_id, o.shop_id, case when o.org_id = tests.id('org_x') then tests.id('dp_x') else tests.id('dp_y') end,
       'Tea', 'piece', 1, 1, 10000, 10000, 10000
  from public.orders o where o.order_number in ('T-XA', 'T-YB', 'T-XB');
insert into public.delivery_otps (order_id, shop_id, code) values (tests.id('o_xa'), tests.id('shop_a'), '4821');

insert into public.riders (org_id, member_id) values (tests.id('org_x'), tests.id('org_x:rider_x')) returning tests.remember('rider_x_row', id);
insert into public.trips (org_id, trip_number, rider_id) values (tests.id('org_x'), 'TR-1', tests.id('rider_x_row')) returning tests.remember('trip_x', id);
insert into public.trip_stops (trip_id, order_id, sequence, org_id, shop_id)
values (tests.id('trip_x'), tests.id('o_xb'), 1, tests.id('org_x'), tests.id('shop_b'));

-- org_x book: shop_a owes Rs 100 (Dr receivable[shop_a] / Cr sales).
insert into public.ledger_accounts (book_type, org_id, code, name, counterparty_type, counterparty_shop_id)
values ('org', tests.id('org_x'), 'receivable', 'Receivable: Shop A', 'shop', tests.id('shop_a')) returning tests.remember('acc_x_recv_a', id);
insert into public.ledger_accounts (book_type, org_id, code, name) values ('org', tests.id('org_x'), 'sales', 'Sales') returning tests.remember('acc_x_sales', id);
insert into public.ledger_journals (book_type, org_id, memo) values ('org', tests.id('org_x'), 'Invoice T-XA') returning tests.remember('j_x', id);
insert into public.ledger_entries (journal_id, account_id, debit_paisa) values (tests.id('j_x'), tests.id('acc_x_recv_a'), 10000);
insert into public.ledger_entries (journal_id, account_id, credit_paisa) values (tests.id('j_x'), tests.id('acc_x_sales'), 10000);
-- shop_b khata: Saleem Bhai owes Rs 50.
insert into public.ledger_accounts (book_type, shop_id, code, name, counterparty_type, counterparty_customer_id)
values ('shop', tests.id('shop_b'), 'receivable', 'Khata: Saleem Bhai', 'shop_customer', tests.id('kc_b')) returning tests.remember('acc_b_khata', id);
insert into public.ledger_accounts (book_type, shop_id, code, name) values ('shop', tests.id('shop_b'), 'sales', 'Sales') returning tests.remember('acc_b_sales', id);
insert into public.ledger_journals (book_type, shop_id, memo) values ('shop', tests.id('shop_b'), 'Udhaar') returning tests.remember('j_b', id);
insert into public.ledger_entries (journal_id, account_id, debit_paisa) values (tests.id('j_b'), tests.id('acc_b_khata'), 5000);
insert into public.ledger_entries (journal_id, account_id, credit_paisa) values (tests.id('j_b'), tests.id('acc_b_sales'), 5000);

insert into public.customer_orders (order_number, shop_id, customer_id, shop_name, subtotal_paisa, total_paisa)
values ('C-1', tests.id('shop_a'), tests.id('cust'), 'Shop A', 5000, 5000) returning tests.remember('co_1', id);
insert into public.customer_orders (order_number, shop_id, customer_id, shop_name, subtotal_paisa, total_paisa)
values ('C-2', tests.id('shop_b'), tests.id('cust2'), 'Shop B', 5000, 5000) returning tests.remember('co_2', id);
insert into public.addresses (user_id, line1) values (tests.id('cust'), 'House 1, Unit 6, Latifabad') returning tests.remember('addr_c', id);
insert into public.addresses (user_id, line1) values (tests.id('cust2'), 'House 9, Qasimabad') returning tests.remember('addr_c2', id);
insert into public.notifications (user_id, kind, title) values (tests.id('ali'), 'system', 'For Ali'), (tests.id('bilal'), 'system', 'For Bilal');

-- Dukandar (shop owner) -----------------------------------------------------------------------------
select tests.authenticate_as('ali');
select set_eq($$ select id from public.shops $$, array[tests.id('shop_a')], 'dukandar sees only their own shop');
select is((select count(*) from public.shop_staff where shop_id = tests.id('shop_b')), 0::bigint, 'dukandar cannot see another shop''s staff');
select set_eq($$ select id from public.shop_inventory $$, array[tests.id('inv_a')], 'dukandar sees only their own inventory');
select set_eq($$ select id from public.shop_customers $$, array[tests.id('kc_a')], 'dukandar sees only their own khata customers');
select set_eq($$ select id from public.pos_bills $$, array[tests.id('bill_a')], 'dukandar sees only their own POS bills');
select set_eq($$ select id from public.orders $$, array[tests.id('o_xa')], 'dukandar sees only their own B2B orders');
select is((select count(*) from public.order_items where order_id <> tests.id('o_xa')), 0::bigint, 'dukandar sees no other order lines');
select is((select count(*) from public.delivery_otps where order_id = tests.id('o_xa')), 1::bigint, 'the ordering shop can read its delivery OTP');
select results_eq(
  $$ select account_id, debit_paisa from public.ledger_entries $$,
  format($$ values (%L::uuid, 10000::bigint) $$, tests.id('acc_x_recv_a')),
  'dukandar reads only the distributor receivable lines that name their shop'
);
select results_eq(
  $$ select balance_paisa from public.ledger_account_balances $$,
  $$ values (10000::bigint) $$,
  'dukandar sees what they owe the distributor through the balances view'
);
select set_eq($$ select id from public.retailer_accounts $$, array[tests.id('ra_xa')], 'dukandar sees only their own distributor accounts');
select set_eq($$ select id from public.customer_orders $$, array[tests.id('co_1')], 'dukandar sees only their own storefront orders');
select is((select count(*) from public.notifications), 1::bigint, 'notifications are private to their recipient');
select is((select count(*) from public.price_tier_items), 0::bigint, 'distributor price tiers stay internal to the distributor');
select throws_ok(
  format($$ insert into public.shop_inventory (shop_id, name, selling_price_paisa) values (%L, 'Injected', 100) $$, tests.id('shop_b')),
  '42501', null, 'dukandar cannot add inventory to another shop'
);
select is(
  tests.row_count(format($$ update public.shop_inventory set selling_price_paisa = 1 where id = %L $$, tests.id('inv_b'))),
  0, 'dukandar cannot change another shop''s prices'
);
select throws_ok(
  format($$ insert into public.shop_staff (shop_id, phone, role) values (%L, '+923119990000', 'manager') $$, tests.id('shop_b')),
  '42501', null, 'dukandar cannot add staff to another shop'
);
select is(
  tests.row_count($$ delete from public.notifications where title = 'For Bilal' $$),
  0, 'users cannot delete other users'' notifications'
);
select tests.clear_authentication();

-- Shop staff with limited permissions ---------------------------------------------------------------
select tests.authenticate_as('cashier');
select is((select count(*) from public.shop_inventory), 1::bigint, 'a cashier (billing) sees the shop''s items');
select is((select count(*) from public.orders), 0::bigint, 'a cashier without the orders permission sees no B2B orders');
select is((select count(*) from public.ledger_entries), 0::bigint, 'a cashier without khata/reports sees no ledger');
select is(
  tests.row_count(format($$ update public.shop_inventory set selling_price_paisa = 1 where id = %L $$, tests.id('inv_a'))),
  0, 'a cashier without the inventory permission cannot change prices'
);
select is((select count(*) from public.profiles), 2::bigint, 'shop co-members can read each other''s profiles');
select tests.clear_authentication();

-- Distributor owner -------------------------------------------------------------------------------------
select tests.authenticate_as('dist_x');
select set_eq($$ select id from public.distributor_products $$, array[tests.id('dp_x')], 'distributor sees only their own products');
select set_eq($$ select id from public.orders $$, array[tests.id('o_xa'), tests.id('o_xb')], 'distributor sees only their own orders');
select set_eq($$ select id from public.retailer_accounts $$, array[tests.id('ra_xa'), tests.id('ra_xb')], 'distributor sees only their own retailers');
select set_eq(
  $$ select distinct journal_id from public.ledger_entries $$, array[tests.id('j_x')],
  'distributor sees only their own ledger'
);
select set_eq($$ select price_tier_id from public.price_tier_items $$, array[tests.id('tier_x')], 'distributor sees only their own price tiers');
select is((select count(*) from public.delivery_otps), 0::bigint, 'the distributor cannot read delivery OTPs');
select set_eq($$ select id from public.shops $$, array[tests.id('shop_a'), tests.id('shop_b')], 'distributor sees the shops it supplies');
select is((select count(*) from public.shop_inventory) + (select count(*) from public.pos_bills) + (select count(*) from public.shop_customers), 0::bigint, 'distributor sees nothing of the shops'' own books');
select is((select count(*) from public.org_members where org_id = tests.id('org_y')), 0::bigint, 'distributor cannot see another distributor''s team');
select throws_ok(
  format($$ insert into public.distributor_products (org_id, name, sku, trade_price_paisa) values (%L, 'Injected', 'INJ-1', 1) $$, tests.id('org_y')),
  '42501', null, 'distributor cannot add products to another distributor'
);
select is(
  tests.row_count(format($$ update public.retailer_accounts set notes = 'x' where id = %L $$, tests.id('ra_yb'))),
  0, 'distributor cannot edit another distributor''s retailer account'
);
select tests.clear_authentication();

select tests.authenticate_as('dist_y');
select set_eq($$ select id from public.orders $$, array[tests.id('o_yb')], 'second distributor sees only its own order');
select set_eq($$ select id from public.distributor_products $$, array[tests.id('dp_y')], 'second distributor sees only its own products');
select is((select count(*) from public.ledger_entries), 0::bigint, 'second distributor sees none of the first distributor''s ledger');
select tests.clear_authentication();

-- Order booker and rider ------------------------------------------------------------------------------
select tests.authenticate_as('booker_x');
select set_eq($$ select id from public.orders $$, array[tests.id('o_xa')], 'a booker sees only the orders they booked');
select set_eq($$ select id from public.retailer_accounts $$, array[tests.id('ra_xa')], 'a booker sees only the retailers assigned to them');
select set_eq($$ select id from public.distributor_products $$, array[tests.id('dp_x')], 'a booker sees their distributor''s catalog');
select is((select count(*) from public.trips), 0::bigint, 'a booker sees no delivery trips');
select is((select count(*) from public.ledger_entries where counterparty_shop_id = tests.id('shop_b')), 0::bigint, 'a booker sees no dues of shops they do not cover');
select tests.clear_authentication();

select tests.authenticate_as('rider_x');
select set_eq($$ select id from public.orders $$, array[tests.id('o_xb')], 'a rider sees only orders on their trips');
select is((select count(*) from public.trip_stops), 1::bigint, 'a rider sees their own trip stops');
select is((select count(*) from public.retailer_accounts), 0::bigint, 'a rider sees no retailer accounts');
select is((select count(*) from public.delivery_otps), 0::bigint, 'a rider cannot read delivery OTPs');
select tests.clear_authentication();

-- Customers ------------------------------------------------------------------------------------------------
select tests.authenticate_as('cust');
select set_eq($$ select id from public.customer_orders $$, array[tests.id('co_1')], 'a customer sees only their own orders');
select set_eq($$ select id from public.addresses $$, array[tests.id('addr_c')], 'a customer sees only their own addresses');
select is((select count(*) from public.profiles), 1::bigint, 'a customer sees only their own profile');
select is((select count(*) from public.shops) + (select count(*) from public.orders), 0::bigint, 'a customer cannot read shops or B2B orders directly');
select throws_ok(
  format($$ insert into public.addresses (user_id, line1) values (%L, 'Someone else''s house') $$, tests.id('cust2')),
  '42501', null, 'a customer cannot create an address for someone else'
);
select tests.clear_authentication();

select tests.authenticate_as('stranger');
select is(
  (select count(*) from public.organizations) + (select count(*) from public.distributor_products) + (select count(*) from public.shops),
  0::bigint,
  'a user with no shop or org sees no distributors, products or shops'
);
select tests.clear_authentication();

-- Anonymous -----------------------------------------------------------------------------------------------------
select tests.authenticate_anon();
select ok((select count(*) from public.categories) >= 1, 'anon can read reference data (categories)');
select throws_ok($$ select count(*) from public.shops $$, '42501', null, 'anon cannot read shops');
select throws_ok($$ select count(*) from public.orders $$, '42501', null, 'anon cannot read orders');
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select count(*) from public.distributor_products $$, '42501', null, 'anon cannot read distributor catalogs');
select throws_ok($$ insert into public.categories (name, slug) values ('Spam', 'spam') $$, '42501', null, 'anon cannot write reference data');
select tests.clear_authentication();

-- Platform admin ----------------------------------------------------------------------------------------------
select tests.authenticate_as('adm');
select ok((select count(*) from public.orders where order_number like 'T-%') = 3, 'platform admins can read every order');
select tests.clear_authentication();

select * from finish();
rollback;
