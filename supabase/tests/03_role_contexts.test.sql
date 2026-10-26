-- Role switcher: my_role_contexts() lists exactly the usable/pending contexts and
-- switch_active_context() allows or denies each one.
begin;
\ir helpers/setup.psql
select plan(33);

select tests.create_user('plain');
select tests.create_user('multi');
select tests.create_user('other_owner');
select tests.make_admin('adm');

select tests.make_shop('shop_a', 'multi', 'approved');
select tests.make_shop('shop_p', 'multi', 'pending');
select tests.make_shop('shop_s', 'other_owner', 'approved');
select tests.make_shop('shop_b', 'other_owner', 'approved');
select tests.add_shop_staff('shop_s', 'multi', 'cashier', array['billing'], 'suspended');
update public.shops set photo_path = 'shop/' || tests.id('shop_a') || '/photo.jpg' where id = tests.id('shop_a');

select tests.make_org('org_x', null, 'approved');
select tests.make_org('org_y', null, 'approved');
select tests.make_org('org_z', null, 'pending');
select tests.add_org_member('org_x', 'multi', 'manager');
select tests.add_org_member('org_y', 'multi', 'booker');
select tests.add_org_member('org_z', 'multi', 'rider');
update public.organizations set logo_path = 'org/' || tests.id('org_x') || '/logo.png' where id = tests.id('org_x');

-- my_role_contexts -------------------------------------------------------------------------------
select tests.authenticate_as('plain');
select results_eq(
  $$ select role::text, context_id from public.my_role_contexts() $$,
  $$ values ('customer'::text, null::uuid) $$,
  'a plain user has exactly one customer context'
);
select tests.clear_authentication();

select tests.authenticate_as('multi');
select is((select count(*) from public.my_role_contexts()), 6::bigint, 'multi-role user sees six contexts');
select is((select role::text from public.my_role_contexts() limit 1), 'customer', 'customer comes first');
select set_eq(
  $$ select context_id from public.my_role_contexts() where role = 'dukandar' $$,
  array[tests.id('shop_a'), tests.id('shop_p')],
  'one dukandar context per active shop membership'
);
select is(
  (select status from public.my_role_contexts() where context_id = tests.id('shop_p')),
  'pending',
  'pending shops are listed with their status'
);
select is(
  (select image_path from public.my_role_contexts() where context_id = tests.id('shop_a')),
  'shop/' || tests.id('shop_a') || '/photo.jpg',
  'dukandar image is the shop photo path'
);
select is(
  (select count(*) from public.my_role_contexts() where context_id = tests.id('shop_s')),
  0::bigint,
  'suspended memberships are not listed'
);
select results_eq(
  $$ select role::text, member_role, status, image_path from public.my_role_contexts() where context_id = tests.id('org_x') $$,
  $$ values ('distributor'::text, 'manager'::text, 'approved'::text, 'org/' || tests.id('org_x') || '/logo.png') $$,
  'managers get a distributor context with the org logo'
);
select is(
  (select role::text from public.my_role_contexts() where context_id = tests.id('org_y')),
  'booker',
  'booker members get a booker context'
);
select results_eq(
  $$ select role::text, status from public.my_role_contexts() where context_id = tests.id('org_z') $$,
  $$ values ('rider'::text, 'pending'::text) $$,
  'rider members get a rider context (pending org shown as pending)'
);
select is((select count(*) from public.my_role_contexts() where role = 'admin'), 0::bigint, 'no admin context without the admin role');
select tests.clear_authentication();

select tests.authenticate_as('adm');
select results_eq(
  $$ select role::text from public.my_role_contexts() $$,
  $$ values ('customer'::text), ('admin'::text) $$,
  'admins get customer and admin contexts'
);
select tests.clear_authentication();

-- switch_active_context -----------------------------------------------------------------------------
select tests.authenticate_as('multi');

select lives_ok(
  format($$ select public.switch_active_context('dukandar', %L) $$, tests.id('shop_a')),
  'switch to an approved shop'
);
select results_eq(
  $$ select active_role::text, active_shop_id, active_org_id from public.profiles where id = auth.uid() $$,
  format($$ values ('dukandar'::text, %L::uuid, null::uuid) $$, tests.id('shop_a')),
  'dukandar context sets the shop and clears the org'
);
select throws_ok(
  format($$ select public.switch_active_context('dukandar', %L) $$, tests.id('shop_p')),
  '42501', 'context_not_allowed', 'cannot switch into a pending shop'
);
select throws_ok(
  format($$ select public.switch_active_context('dukandar', %L) $$, tests.id('shop_s')),
  '42501', 'context_not_allowed', 'cannot switch into a shop where the membership is suspended'
);
select throws_ok(
  format($$ select public.switch_active_context('dukandar', %L) $$, tests.id('shop_b')),
  '42501', 'context_not_allowed', 'cannot switch into another owner''s shop'
);
select throws_ok(
  $$ select public.switch_active_context('dukandar') $$,
  '42501', 'context_not_allowed', 'dukandar context needs a shop id'
);
select lives_ok(
  format($$ select public.switch_active_context('distributor', %L) $$, tests.id('org_x')),
  'manager switches into the distributor context'
);
select results_eq(
  $$ select active_role::text, active_shop_id, active_org_id from public.profiles where id = auth.uid() $$,
  format($$ values ('distributor'::text, null::uuid, %L::uuid) $$, tests.id('org_x')),
  'distributor context sets the org and clears the shop'
);
select throws_ok(
  format($$ select public.switch_active_context('booker', %L) $$, tests.id('org_x')),
  '42501', 'context_not_allowed', 'a manager cannot switch into the booker context'
);
select throws_ok(
  format($$ select public.switch_active_context('distributor', %L) $$, tests.id('org_y')),
  '42501', 'context_not_allowed', 'a booker cannot switch into the distributor context'
);
select lives_ok(
  format($$ select public.switch_active_context('booker', %L) $$, tests.id('org_y')),
  'booker switches into the booker context'
);
select throws_ok(
  format($$ select public.switch_active_context('rider', %L) $$, tests.id('org_z')),
  '42501', 'context_not_allowed', 'cannot switch into a pending distributor'
);
select throws_ok(
  $$ select public.switch_active_context('admin') $$,
  '42501', 'context_not_allowed', 'non-admins cannot switch into admin'
);
select results_eq(
  $$ select active_role::text, active_org_id from public.profiles where id = auth.uid() $$,
  format($$ values ('booker'::text, %L::uuid) $$, tests.id('org_y')),
  'a denied switch leaves the active context unchanged'
);
select lives_ok($$ select public.switch_active_context('customer') $$, 'anyone can switch back to customer');
select results_eq(
  $$ select active_role::text, active_shop_id, active_org_id from public.profiles where id = auth.uid() $$,
  $$ values ('customer'::text, null::uuid, null::uuid) $$,
  'customer context clears shop and org'
);
select tests.clear_authentication();

select tests.authenticate_as('adm');
select lives_ok($$ select public.switch_active_context('admin') $$, 'admins switch into the admin context');
select is((select active_role::text from public.profiles where id = auth.uid()), 'admin', 'admin context is active');
select tests.clear_authentication();

-- Losing a membership drops the user back to the customer context.
select tests.authenticate_as('multi');
select public.switch_active_context('dukandar', tests.id('shop_a'));
select tests.clear_authentication();
update public.shop_staff set status = 'suspended' where shop_id = tests.id('shop_a') and user_id = tests.id('multi');
select results_eq(
  $$ select active_role::text, active_shop_id from public.profiles where id = tests.id('multi') $$,
  $$ values ('customer'::text, null::uuid) $$,
  'suspending the membership resets the active context'
);

-- Signed-out callers cannot use the switcher.
select tests.authenticate_anon();
select throws_ok($$ select * from public.my_role_contexts() $$, '42501', null, 'anon cannot list contexts');
select throws_ok($$ select public.switch_active_context('customer') $$, '42501', null, 'anon cannot switch context');
select tests.clear_authentication();

select * from finish();
rollback;
