-- The admin panel: staff can read the marketplace, only admins can pause a dukan or flip a
-- switch, and every change is recorded.
begin;
\ir helpers/setup.psql
select plan(14);

select tests.make_admin('boss');
select tests.create_user('owner');
select tests.create_user('stranger');
select tests.make_shop('zaitoon_mart', 'owner');
select tests.make_shop('waiting', 'owner', 'pending');
select tests.make_org('traders', 'owner');
grant insert, update on tests.refs to authenticated;
insert into public.storefront_settings (shop_id, is_live) values (tests.id('zaitoon_mart'), true);
select phone as owner_phone from public.profiles where id = tests.id('owner') \gset

select tests.authenticate_as('stranger');
select throws_ok(
  $$ select public.admin_overview('today') $$,
  '42501', 'not_allowed', 'a normal user cannot open the admin overview'
);
select throws_ok(
  format($$ select public.admin_set_shop_status(%L, 'suspended', 'Testing') $$, tests.id('zaitoon_mart')),
  '42501', 'not_allowed', 'or pause a dukan'
);

select tests.authenticate_as('boss');
select ok(
  (public.admin_overview('today') -> 'totals' ->> 'shops')::integer >= 1,
  'the overview counts approved dukans'
);
select ok(
  (public.admin_overview('week') -> 'attention' ->> 'pending_shops')::integer >= 1,
  'and dukans waiting for approval'
);
select is(
  jsonb_array_length(public.admin_overview('month') -> 'series'), 14,
  'the sales chart covers 14 days'
);
select ok(
  exists (select 1 from jsonb_array_elements(public.admin_approvals() -> 'shops') e
           where e ->> 'id' = tests.id('waiting')::text),
  'the approval queue lists the waiting dukan'
);
select is(
  jsonb_array_length(public.admin_shops(null, 'Zaitoon Mart')), 1,
  'dukans can be searched by name'
);
select ok(
  jsonb_array_length(public.admin_users(:'owner_phone')) >= 1,
  'people can be found by phone number'
);
select is(
  jsonb_typeof(public.admin_orders('all')), 'array',
  'orders from both sides come back as one list'
);
select throws_ok(
  format($$ select public.admin_set_shop_status(%L, 'suspended') $$, tests.id('zaitoon_mart')),
  '22023', 'reason_required', 'pausing a dukan needs a reason'
);
select is(
  public.admin_set_shop_status(tests.id('zaitoon_mart'), 'suspended', 'Complaints about prices') ->> 'status',
  'suspended', 'an admin can pause a dukan'
);
select is(
  (select is_live from public.storefront_settings where shop_id = tests.id('zaitoon_mart')), false,
  'a paused dukan stops taking online orders'
);
select is(
  public.admin_set_shop_status(tests.id('zaitoon_mart'), 'approved') ->> 'status',
  'approved', 'and start it again'
);
select ok(
  exists (select 1 from jsonb_array_elements(public.admin_audit(20)) e where e ->> 'action' = 'shop.suspended'),
  'the pause is in the audit log'
);

select * from finish();
rollback;
