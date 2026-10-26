-- Storage buckets and path-scoped policies (exercised by writing storage.objects rows the way
-- the Storage API does, under each caller's role).
begin;
\ir helpers/setup.psql
select plan(21);

select tests.create_user('ali');
select tests.create_user('bilal');
select tests.create_user('dist_x');
select tests.make_admin('adm');
select tests.make_shop('shop_a', 'ali');
select tests.make_shop('shop_b', 'bilal');
select tests.make_org('org_x', 'dist_x');
select tests.make_org('org_y', null);
insert into public.orders (order_number, shop_id, org_id, payment_method, subtotal_paisa, total_paisa)
values ('S-1', tests.id('shop_a'), tests.id('org_x'), 'cod', 1000, 1000) returning tests.remember('order_1', id);

select results_eq(
  $$ select id, public from storage.buckets
      where id in ('shop-media', 'product-images', 'pod-photos', 'invoices', 'parchi-uploads', 'payment-receipts', 'kyc-documents')
      order by id $$,
  $$ values ('invoices'::text, false), ('kyc-documents', false), ('parchi-uploads', false), ('payment-receipts', false),
            ('pod-photos', false), ('product-images', true), ('shop-media', true) $$,
  'seven buckets: shop-media and product-images public, the rest private'
);

-- Uploaded as postgres: a delivery photo for order_1.
insert into storage.objects (bucket_id, name)
values ('pod-photos', 'org/' || tests.id('org_x') || '/' || tests.id('order_1') || '/pod.jpg');

select tests.authenticate_as('ali');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('shop-media', '%s/avatar.webp') $$, tests.id('ali')),
  'a user uploads their avatar under <uid>/'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('shop-media', '%s/avatar.webp') $$, tests.id('bilal')),
  '42501', null, 'a user cannot write into another user''s folder'
);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('shop-media', 'shop/%s/cover.jpg') $$, tests.id('shop_a')),
  'a shop owner uploads shop media'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('shop-media', 'shop/%s/cover.jpg') $$, tests.id('shop_b')),
  '42501', null, 'a dukandar cannot upload media for another shop'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('shop-media', 'platform/categories/tea.jpg') $$,
  '42501', null, 'only admins write platform media'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('product-images', 'master/x/front.jpg') $$,
  '42501', null, 'only admins write master product images'
);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('kyc-documents', '%s/cnic-front.jpg') $$, tests.id('ali')),
  'a user uploads their own KYC document'
);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('parchi-uploads', '%s/parchi-1.jpg') $$, tests.id('ali')),
  'a user uploads a parchi photo'
);
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('payment-receipts', 'shop/%s/%s/raast-receipt.jpg') $$, tests.id('shop_a'), tests.id('org_x')),
  'a shop uploads a payment receipt for its distributor'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'pod-photos'),
  1::bigint,
  'the ordering shop can see the delivery photo of its order'
);
select tests.clear_authentication();

select tests.authenticate_as('bilal');
select is((select count(*) from storage.objects where bucket_id = 'pod-photos'), 0::bigint, 'other shops cannot see that delivery photo');
select is((select count(*) from storage.objects where bucket_id = 'kyc-documents'), 0::bigint, 'KYC documents are private to their owner');
select is((select count(*) from storage.objects where bucket_id = 'parchi-uploads'), 0::bigint, 'parchi photos are private to their owner');
select is((select count(*) from storage.objects where bucket_id = 'payment-receipts'), 0::bigint, 'other shops cannot see payment receipts');
select tests.clear_authentication();

select tests.authenticate_as('dist_x');
select is((select count(*) from storage.objects where bucket_id = 'payment-receipts'), 1::bigint, 'the receiving distributor can see the receipt');
select lives_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('pod-photos', 'org/%s/%s/pod-2.jpg') $$, tests.id('org_x'), tests.id('order_1')),
  'a distributor team member uploads proof of delivery'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('pod-photos', 'org/%s/%s/pod.jpg') $$, tests.id('org_y'), gen_random_uuid()),
  '42501', null, 'a distributor cannot upload into another distributor''s folder'
);
select is((select count(*) from storage.objects where bucket_id = 'kyc-documents'), 0::bigint, 'distributors cannot read shop KYC documents');
select tests.clear_authentication();

select tests.authenticate_as('adm');
select is((select count(*) from storage.objects where bucket_id = 'kyc-documents'), 1::bigint, 'platform staff can review KYC documents');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('product-images', 'master/x/front.jpg') $$,
  'admins write master product images'
);
select tests.clear_authentication();

select * from finish();
rollback;
