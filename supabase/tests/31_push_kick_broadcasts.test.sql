-- Push leaves at once: a queued push makes the database call the app (spaced 3 seconds apart),
-- only where the app's address is set, with a token the app can check. Broadcasts: admins only,
-- the right people, one notification each, phone alerts where allowed, kept and audited.
begin;
\ir helpers/setup.psql
select plan(17);

select tests.create_user('shopper', '+923331112233');
select tests.create_user('owner');
select tests.create_user('stranger');
select tests.make_admin('admin');
select tests.make_shop('kiryana', 'owner');
grant insert, update on tests.refs to authenticated;

select tests.authenticate_as('shopper');
select public.register_push_subscription('https://push.example.test/s1', repeat('k', 87), repeat('a', 22));
select tests.clear_authentication();

-- No address (local): nothing is called.
update private.push_flush set url = null, last_kick_at = '-infinity';
create temp table queue_mark as select coalesce(max(id), 0) as id from net.http_request_queue;
select private.notify(tests.id('shopper'), 'order', 'Test alert');
select is(
  (select count(*)::integer from net.http_request_queue q where q.id > (select id from queue_mark)), 0,
  'without the app''s address, nothing is called'
);

update private.push_flush set url = 'https://app.example.test/api/push/flush', last_kick_at = '-infinity';
select private.notify(tests.id('shopper'), 'order', 'Second alert');
select is(
  (select count(*)::integer from net.http_request_queue q where q.id > (select id from queue_mark)), 1,
  'a queued push calls the app at once'
);
select is(
  (select q.headers ->> 'Authorization' from net.http_request_queue q where q.id > (select id from queue_mark)),
  'Bearer ' || (select token from private.push_flush),
  'with the database''s own token'
);
select private.notify(tests.id('shopper'), 'order', 'Third alert');
select is(
  (select count(*)::integer from net.http_request_queue q where q.id > (select id from queue_mark)), 1,
  'alerts seconds apart share one call'
);
select private.notify(tests.id('owner'), 'order', 'No phone alerts here');
select is(
  (select count(*)::integer from net.http_request_queue q where q.id > (select id from queue_mark)), 1,
  'a notification without a phone subscription calls nothing'
);

create temp table flush_token as select token from private.push_flush;
grant select on flush_token to service_role;
set local role service_role;
select ok(public.push_flush_token_ok((select token from flush_token)), 'the app accepts the database''s token');
select ok(not public.push_flush_token_ok(repeat('0', 64)), 'and refuses any other');
reset role;
select ok(
  not has_function_privilege('authenticated', 'public.push_flush_token_ok(text)', 'EXECUTE'),
  'only the server can check the token'
);

-- Broadcasts ------------------------------------------------------------------------------------
select tests.authenticate_as('stranger');
select throws_ok(
  $$ select public.admin_broadcast('customers', 'Hello', 'Free delivery today') $$,
  '42501', 'not_allowed', 'only admins can broadcast'
);

select tests.authenticate_as('admin');
select ok(
  (public.admin_broadcast_reach('dukandars') ->> 'people')::integer >= 1,
  'the reach of an audience is counted before sending'
);
select tests.remember('cast', (public.admin_broadcast('customers', 'Eid offer', 'Free delivery on all orders today', '/') ->> 'id')::uuid);
select tests.clear_authentication();
select ok(
  exists (select 1 from public.notifications where user_id = tests.id('shopper') and data ->> 'broadcast_id' = tests.id('cast')::text)
  and not exists (select 1 from public.notifications where user_id = tests.id('owner') and data ->> 'broadcast_id' = tests.id('cast')::text),
  'customers get it; a dukandar does not'
);
select is(
  (select sent_count from public.broadcasts where id = tests.id('cast')),
  (select count(*)::integer from private.broadcast_recipients('customers')),
  'one notification per person in the audience'
);
select ok(
  (select push_count from public.broadcasts where id = tests.id('cast')) >= 1,
  'and a phone alert for those who allowed them'
);
select ok(
  exists (select 1 from public.audit_logs where action = 'broadcast.sent' and entity_id = tests.id('cast')),
  'every broadcast is in the audit log'
);

select tests.authenticate_as('admin');
select is(
  (public.admin_broadcast('one', 'Your dukan is approved', 'Welcome to TezDukan', null, '+923331112233') ->> 'sent')::integer, 1,
  'one person, by phone number'
);
select throws_ok(
  $$ select public.admin_broadcast('one', 'Hi', 'Hello', null, '+923009999999') $$,
  'P0002', 'person_not_found', 'an unknown number is refused'
);
select throws_ok(
  $$ select public.admin_broadcast('everyone', 'Hi', 'Hello', 'https://evil.example') $$,
  '22023', 'invalid_input', 'links stay inside the app'
);

select * from finish();
rollback;
