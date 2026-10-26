-- Financial and stock integrity: no direct client writes (RPC only), stock quantities only via
-- RPCs, balanced and immutable journals, soft delete instead of hard delete, credit terms need
-- credit.manage.
begin;
\ir helpers/setup.psql
select plan(32);

select tests.create_user('ali');
select tests.create_user('dist_x');
select tests.create_user('sales_x');
select tests.make_shop('shop_a', 'ali');
select tests.make_org('org_x', 'dist_x');
select tests.add_org_member('org_x', 'sales_x', 'warehouse', array['retailers.manage']);

insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand)
values (tests.id('shop_a'), 'Tapal Danedar 950 g', 199000, 12) returning tests.remember('inv_a', id);
insert into public.orders (order_number, shop_id, org_id, payment_method, subtotal_paisa, total_paisa)
values ('F-1', tests.id('shop_a'), tests.id('org_x'), 'cod', 50000, 50000) returning tests.remember('order_1', id);
insert into public.retailer_accounts (org_id, shop_id, credit_limit_paisa)
values (tests.id('org_x'), tests.id('shop_a'), 1000000) returning tests.remember('ra', id);
insert into public.ledger_accounts (book_type, org_id, code, name, counterparty_type, counterparty_shop_id)
values ('org', tests.id('org_x'), 'receivable', 'Receivable: Shop A', 'shop', tests.id('shop_a')) returning tests.remember('acc_recv', id);
insert into public.ledger_accounts (book_type, org_id, code, name)
values ('org', tests.id('org_x'), 'sales', 'Sales') returning tests.remember('acc_sales', id);

-- No direct writes to financial / stock tables, even for a shop owner ------------------------------
select tests.authenticate_as('ali');
select throws_ok(
  format($$ insert into public.pos_bills (shop_id, client_id, bill_number, subtotal_paisa, total_paisa, paid_cash_paisa) values (%L, gen_random_uuid(), 1, 100, 100, 100) $$, tests.id('shop_a')),
  '42501', null, 'POS bills cannot be inserted directly'
);
select throws_ok(
  format($$ insert into public.ledger_journals (book_type, shop_id) values ('shop', %L) $$, tests.id('shop_a')),
  '42501', null, 'journals cannot be inserted directly'
);
select throws_ok(
  format($$ insert into public.ledger_entries (journal_id, account_id, debit_paisa) values (gen_random_uuid(), %L, 100) $$, tests.id('acc_recv')),
  '42501', null, 'ledger entries cannot be inserted directly'
);
select throws_ok(
  format($$ update public.orders set total_paisa = 0, subtotal_paisa = 0 where id = %L $$, tests.id('order_1')),
  '42501', null, 'orders cannot be updated directly'
);
select throws_ok($$ delete from public.payments $$, '42501', null, 'payments cannot be deleted');
select throws_ok(
  format($$ insert into public.expenses (shop_id, category, amount_paisa) values (%L, 'rent', 100) $$, tests.id('shop_a')),
  '42501', null, 'expenses go through RPCs'
);
select throws_ok(
  format($$ insert into public.shop_stock_movements (shop_id, inventory_id, movement_type, qty, balance_after) values (%L, %L, 'receive', 5, 17) $$, tests.id('shop_a'), tests.id('inv_a')),
  '42501', null, 'shop stock movements cannot be written directly'
);
select throws_ok(
  $$ insert into public.stock_movements (org_id, warehouse_id, batch_id, distributor_product_id, movement_type, quantity) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'stock_in', 5) $$,
  '42501', null, 'warehouse stock movements cannot be written directly'
);
select throws_ok(
  format($$ insert into public.customer_orders (order_number, shop_id, shop_name) values ('X', %L, 'x') $$, tests.id('shop_a')),
  '42501', null, 'customer orders go through RPCs'
);
select throws_ok(
  format($$ update public.shop_inventory set qty_on_hand = 999 where id = %L $$, tests.id('inv_a')),
  '42501', null, 'stock quantity cannot be edited directly'
);
select throws_ok(
  format($$ insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand) values (%L, 'Lux 128 g', 15000, 50) $$, tests.id('shop_a')),
  '42501', null, 'new items cannot be created with stock (opening stock is an RPC)'
);
select lives_ok(
  format($$ insert into public.shop_inventory (shop_id, name, selling_price_paisa) values (%L, 'Lux Soft Touch 128 g', 15000) $$, tests.id('shop_a')),
  'items can be added without stock'
);
select is(
  (select qty_on_hand from public.shop_inventory where name = 'Lux Soft Touch 128 g'),
  0.000::numeric,
  'new items start with zero stock'
);
select is(
  tests.row_count(format($$ update public.shop_inventory set selling_price_paisa = 205000, low_stock_threshold = 3 where id = %L $$, tests.id('inv_a'))),
  1,
  'price and threshold can be edited directly'
);
select tests.clear_authentication();

-- Credit terms need credit.manage ----------------------------------------------------------------------
select tests.authenticate_as('sales_x');
select is(
  tests.row_count(format($$ update public.retailer_accounts set notes = 'Pays on Fridays' where id = %L $$, tests.id('ra'))),
  1,
  'retailers.manage can edit retailer notes'
);
select throws_ok(
  format($$ update public.retailer_accounts set credit_limit_paisa = 99999999 where id = %L $$, tests.id('ra')),
  '42501', 'not_authorized', 'retailers.manage alone cannot raise a credit limit'
);
select throws_ok(
  format($$ update public.retailer_accounts set hold_override_until = now() + interval '7 days' where id = %L $$, tests.id('ra')),
  '42501', 'not_authorized', 'retailers.manage alone cannot override a credit hold'
);
select tests.clear_authentication();

select tests.authenticate_as('dist_x');
select is(
  tests.row_count(format($$ update public.retailer_accounts set credit_limit_paisa = 2000000 where id = %L $$, tests.id('ra'))),
  1,
  'the owner (credit.manage) can change the credit limit'
);
select ok(
  exists (select 1 from public.audit_logs where entity_id = tests.id('ra') and action = 'retailer_accounts.update'),
  'credit limit changes are audited'
);
select tests.clear_authentication();

-- Double-entry integrity (as the RPC owner would write) ------------------------------------------------
select throws_ok(
  format($$
    do $d$
    declare v_j uuid;
    begin
      insert into public.ledger_journals (book_type, org_id) values ('org', %L) returning id into v_j;
      insert into public.ledger_entries (journal_id, account_id, debit_paisa) values (v_j, %L, 10000);
      insert into public.ledger_entries (journal_id, account_id, credit_paisa) values (v_j, %L, 9000);
      set constraints all immediate;
    end
    $d$ $$, tests.id('org_x'), tests.id('acc_recv'), tests.id('acc_sales')),
  '23514', 'unbalanced_journal', 'an unbalanced journal is rejected'
);
select throws_ok(
  format($$
    do $d$
    declare v_j uuid;
    begin
      insert into public.ledger_journals (book_type, org_id) values ('org', %L) returning id into v_j;
      insert into public.ledger_entries (journal_id, account_id, debit_paisa) values (v_j, %L, 10000);
      set constraints all immediate;
    end
    $d$ $$, tests.id('org_x'), tests.id('acc_recv')),
  '23514', 'unbalanced_journal', 'a one-line journal is rejected'
);
select throws_ok(
  format($$ insert into public.ledger_entries (journal_id, account_id, debit_paisa, credit_paisa) values (gen_random_uuid(), %L, 100, 100) $$, tests.id('acc_recv')),
  '23514', null, 'an entry cannot have both a debit and a credit'
);

insert into public.ledger_journals (book_type, org_id, memo) values ('org', tests.id('org_x'), 'Invoice F-1') returning tests.remember('j_ok', id);
insert into public.ledger_entries (journal_id, account_id, debit_paisa) values (tests.id('j_ok'), tests.id('acc_recv'), 50000) returning tests.remember('e_dr', id);
insert into public.ledger_entries (journal_id, account_id, credit_paisa) values (tests.id('j_ok'), tests.id('acc_sales'), 50000) returning tests.remember('e_cr', id);
select lives_ok($$ set constraints all immediate $$, 'a balanced journal is accepted');
set constraints all deferred;

select is(
  (select counterparty_shop_id from public.ledger_entries where id = tests.id('e_dr')),
  tests.id('shop_a'),
  'entries copy the counterparty from their account'
);
select throws_ok(
  format($$ update public.ledger_entries set debit_paisa = 1 where id = %L $$, tests.id('e_dr')),
  '55000', 'ledger_entries_are_immutable', 'posted entries cannot be edited'
);
select throws_ok(
  format($$
    do $d$
    begin
      update public.ledger_entries set deleted_at = now() where id = %L;
      set constraints all immediate;
    end
    $d$ $$, tests.id('e_cr')),
  '23514', 'unbalanced_journal', 'soft-deleting one side of a journal is rejected'
);
select throws_ok(
  format($$ delete from public.ledger_entries where id = %L $$, tests.id('e_dr')),
  '55000', 'hard_delete_not_allowed', 'ledger entries are never hard-deleted'
);
select throws_ok(
  format($$ delete from public.orders where id = %L $$, tests.id('order_1')),
  '55000', 'hard_delete_not_allowed', 'orders are never hard-deleted'
);
select lives_ok(
  format($$ update public.orders set deleted_at = now() where id = %L $$, tests.id('order_1')),
  'orders can be soft-deleted by trusted code'
);
select throws_ok(
  format($$ insert into public.orders (order_number, shop_id, org_id, payment_method, subtotal_paisa, total_paisa) values ('F-BAD', %L, %L, 'cod', 1000, 999) $$, tests.id('shop_a'), tests.id('org_x')),
  '23514', null, 'order totals must add up'
);
select throws_ok(
  format($$ insert into public.pos_bills (shop_id, client_id, bill_number, subtotal_paisa, total_paisa, paid_cash_paisa) values (%L, gen_random_uuid(), 77, 1000, 1000, 500) $$, tests.id('shop_a')),
  '23514', null, 'a completed bill must be fully paid (cash + digital + udhaar - change = total)'
);

insert into public.audit_logs (action, entity_type) values ('test.event', 'test') returning tests.remember('audit_row', id);
select throws_ok(
  format($$ update public.audit_logs set action = 'tampered' where id = %L $$, tests.id('audit_row')),
  '55000', 'append_only', 'audit logs are append-only'
);

select * from finish();
rollback;
