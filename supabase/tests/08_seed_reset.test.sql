-- seed_reset() removes exactly the rows listed in seed_registry (newest first), including auth
-- users and soft-delete-only financial rows, and refuses to run if real data depends on seed rows.
begin;
\ir helpers/setup.psql
select plan(9);

-- Seed rows, registered in insertion order (parents first), like scripts/seed.ts does.
select tests.create_user('seed_owner', '+923110005555', 'Seed Owner');
insert into public.seed_registry (table_name, row_id) values ('auth.users', tests.id('seed_owner'));
select tests.make_area('seed_zone');
insert into public.seed_registry (table_name, row_id)
select 'public.service_areas', id from public.service_areas where slug in ('test-city', 'test-seed-zone') order by kind;
select tests.make_shop('seed_shop', 'seed_owner', 'approved', tests.id('seed_zone'));
insert into public.seed_registry (table_name, row_id) values ('public.shops', tests.id('seed_shop'));
insert into public.seed_registry (table_name, row_id)
select 'public.shop_staff', id from public.shop_staff where shop_id = tests.id('seed_shop');
insert into public.brands (name, slug) values ('Seed Brand', 'seed-brand') returning tests.remember('seed_brand', id);
insert into public.seed_registry (table_name, row_id) values ('public.brands', tests.id('seed_brand'));
insert into public.categories (name, slug) values ('Seed Category', 'seed-category') returning tests.remember('seed_cat', id);
insert into public.seed_registry (table_name, row_id) values ('public.categories', tests.id('seed_cat'));
insert into public.master_products (name, category_id, brand_id) values ('Seed Product', tests.id('seed_cat'), tests.id('seed_brand'))
returning tests.remember('seed_product', id);
insert into public.seed_registry (table_name, row_id) values ('public.master_products', tests.id('seed_product'));
insert into public.pos_bills (shop_id, client_id, bill_number, subtotal_paisa, total_paisa, paid_cash_paisa)
values (tests.id('seed_shop'), gen_random_uuid(), 1, 1000, 1000, 1000) returning tests.remember('seed_bill', id);
insert into public.seed_registry (table_name, row_id) values ('public.pos_bills', tests.id('seed_bill'));

-- Real data that is not part of the seed.
insert into public.brands (name, slug) values ('Real Brand', 'real-brand') returning tests.remember('real_brand', id);

-- Real data that depends on a seed row blocks the reset (and nothing is deleted).
insert into public.master_products (name, category_id) values ('Real Product', tests.id('seed_cat')) returning tests.remember('real_product', id);
select throws_ok($$ select public.seed_reset() $$, '23503', null, 'seed_reset refuses to break real data that references seed rows');
select is((select count(*) from public.seed_registry), 9::bigint, 'a refused reset leaves the registry untouched');
delete from public.master_products where id = tests.id('real_product');

select lives_ok($$ select public.seed_reset() $$, 'seed_reset runs');
select is((select count(*) from public.seed_registry), 0::bigint, 'the registry is emptied');
select is((select count(*) from auth.users where id = tests.id('seed_owner')), 0::bigint, 'seeded auth users are deleted');
select is((select count(*) from public.profiles where id = tests.id('seed_owner')), 0::bigint, 'their profiles go with them');
select is(
  (select count(*) from public.shops where id = tests.id('seed_shop'))
  + (select count(*) from public.pos_bills where id = tests.id('seed_bill'))
  + (select count(*) from public.master_products where id = tests.id('seed_product'))
  + (select count(*) from public.categories where id = tests.id('seed_cat'))
  + (select count(*) from public.service_areas where slug like 'test-%'),
  0::bigint,
  'every registered row is deleted, financial rows included'
);
select is((select count(*) from public.brands where id = tests.id('real_brand')), 1::bigint, 'rows that were not seeded survive');
select tests.make_shop('real_shop');
insert into public.pos_bills (shop_id, client_id, bill_number, subtotal_paisa, total_paisa, paid_cash_paisa)
values (tests.id('real_shop'), gen_random_uuid(), 1, 1000, 1000, 1000);
select throws_ok(
  format($$ delete from public.pos_bills where shop_id = %L $$, tests.id('real_shop')),
  '55000', 'hard_delete_not_allowed', 'the hard-delete exception is only active inside seed_reset'
);

select * from finish();
rollback;
