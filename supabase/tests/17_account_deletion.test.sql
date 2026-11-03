-- Account deletion requests: only for yourself, one open request at a time, private to you.
begin;
\ir helpers/setup.psql
select plan(5);

select tests.create_user('leaver');
select tests.create_user('other');
grant insert, update on tests.refs to authenticated;

select tests.authenticate_as('leaver');
select tests.remember('req', (public.request_account_deletion('Moving away') ->> 'id')::uuid);
select is(
  (select status::text from public.data_deletion_requests where id = tests.id('req')),
  'requested', 'a person can ask for their account to be deleted'
);
select is(
  (public.request_account_deletion() ->> 'id')::uuid, tests.id('req'),
  'asking again returns the request already in progress'
);
select is((public.my_account_deletion() ->> 'id')::uuid, tests.id('req'), 'and they can see it');

select tests.authenticate_as('other');
select is(public.my_account_deletion(), null, 'someone else does not see it');

select tests.authenticate_anon();
select throws_ok(
  $$ select public.request_account_deletion() $$,
  '42501', null, 'a signed-out visitor cannot file a request'
);

select * from finish();
rollback;
