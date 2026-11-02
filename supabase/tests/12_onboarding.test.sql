-- Self-registration: pending by default, approved at once when the testing flag is on, and
-- the approved dukans a customer can find.
begin;
\ir helpers/setup.psql
select plan(6);

select tests.create_user('newbie');
select tests.create_user('shopper');
grant insert, update on tests.refs to authenticated;

select tests.authenticate_as('newbie');
select tests.remember('pending_shop', (public.register_shop(
  'Pending Kiryana', '+923001112233', 'Shop 1, Saddar', null, 25.39, 68.37
)).id);
select tests.clear_authentication();

select is(
  (select status::text from public.shops where id = tests.id('pending_shop')), 'pending',
  'a new dukan waits for approval by default'
);

update public.feature_flags set enabled = true where key = 'auto_approve_registrations';

select tests.authenticate_as('newbie');
select tests.remember('live_shop', (public.register_shop(
  'Live Kiryana', '+923001112234', 'Shop 2, Saddar', null, 25.39, 68.37
)).id);
select tests.remember('live_org', (public.register_organization(
  'Live Traders', '+923001112235', 'Godown 4, Site Area', null, 25.40, 68.35
)).id);
select tests.clear_authentication();

select is(
  (select status::text from public.shops where id = tests.id('live_shop')), 'approved',
  'with the testing flag on, a new dukan is approved at once'
);
select ok(
  (select approved_at is not null from public.shops where id = tests.id('live_shop')),
  'and gets an approval time'
);
select is(
  (select status::text from public.organizations where id = tests.id('live_org')), 'approved',
  'a new distributor is approved at once too'
);

select tests.authenticate_as('shopper');
select ok(
  public.nearby_dukans(25.39, 68.37, 50) @> jsonb_build_array(jsonb_build_object('id', tests.id('live_shop'))),
  'a customer finds an approved dukan nearby'
);
select ok(
  not (public.nearby_dukans(25.39, 68.37, 50) @> jsonb_build_array(jsonb_build_object('id', tests.id('pending_shop')))),
  'but not one still waiting for approval'
);

select * from finish();
rollback;
