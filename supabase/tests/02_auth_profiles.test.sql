-- Auth integration: profile creation and phone sync from auth.users, profile privileges
-- (active_* only through switch_active_context), the Send SMS hook and outbox access.
begin;
\ir helpers/setup.psql
select plan(26);

select tests.create_user('ali', '+923110000001', 'Ali Raza', true, 'ur');
select tests.create_user('bob', '+923110000002', 'Bob Khan', true, 'xx');
select tests.make_admin('ops');

-- New-user trigger -----------------------------------------------------------------------------
select is((select phone::text from public.profiles where id = tests.id('ali')), '+923110000001', 'profile phone is E.164 with plus');
select is((select full_name from public.profiles where id = tests.id('ali')), 'Ali Raza', 'profile full_name comes from user metadata');
select is((select locale from public.profiles where id = tests.id('ali')), 'ur'::public.app_locale, 'profile locale comes from user metadata');
select is((select locale from public.profiles where id = tests.id('bob')), 'en'::public.app_locale, 'unknown locale falls back to en');
select is((select active_role from public.profiles where id = tests.id('ali')), 'customer'::public.app_role, 'new users start in the customer context');

update auth.users set phone = '923110000099' where id = tests.id('bob');
select is((select phone::text from public.profiles where id = tests.id('bob')), '+923110000099', 'phone changes on auth.users sync to the profile');

-- Profile access as a signed-in user ----------------------------------------------------------
select tests.authenticate_as('ali');

select is((select count(*) from public.profiles where id = tests.id('ali')), 1::bigint, 'a user reads their own profile');
select is((select count(*) from public.profiles where id = tests.id('bob')), 0::bigint, 'a user cannot read an unrelated profile');

select is(
  tests.row_count($$ update public.profiles set full_name = 'Ali Raza Memon', locale = 'ur-Latn', theme = 'dark', data_saver = true where id = auth.uid() $$),
  1,
  'a user updates their own name, locale, theme and data saver'
);
select is((select theme from public.profiles where id = tests.id('ali')), 'dark'::public.theme_pref, 'theme was updated');

select throws_ok(
  $$ update public.profiles set active_role = 'admin' where id = auth.uid() $$,
  '42501', null, 'active_role cannot be changed directly'
);
select throws_ok(
  format($$ update public.profiles set active_shop_id = %L where id = auth.uid() $$, gen_random_uuid()),
  '42501', null, 'active_shop_id cannot be changed directly'
);
select throws_ok(
  format($$ update public.profiles set active_org_id = %L where id = auth.uid() $$, gen_random_uuid()),
  '42501', null, 'active_org_id cannot be changed directly'
);
select throws_ok(
  $$ update public.profiles set phone = '+923119999999' where id = auth.uid() $$,
  '42501', null, 'phone cannot be changed directly (it follows auth.users)'
);
select throws_ok(
  format($$ insert into public.profiles (id, full_name) values (%L, 'Fake') $$, gen_random_uuid()),
  '42501', null, 'profiles cannot be inserted through the API'
);
select is(
  tests.row_count(format($$ update public.profiles set full_name = 'Hacked' where id = %L $$, tests.id('bob'))),
  0,
  'a user cannot update someone else''s profile'
);
select is((select count(*) from public.message_outbox), 0::bigint, 'message_outbox is hidden from ordinary users');
select throws_ok(
  $$ select private.hook_send_sms('{}'::jsonb) $$,
  '42501', null, 'API roles cannot call the Send SMS hook'
);
select tests.clear_authentication();

-- Send SMS hook ----------------------------------------------------------------------------------
select is(
  private.hook_send_sms(jsonb_build_object(
    'user', jsonb_build_object('id', tests.id('ali'), 'phone', '923110000001'),
    'sms', jsonb_build_object('otp', '123456', 'phone', '923110000001'),
    'metadata', jsonb_build_object('name', 'send-sms')
  )),
  '{}'::jsonb,
  'the hook returns {} on success'
);
select is(
  (select count(*) from public.message_outbox where to_phone = '+923110000001'),
  1::bigint,
  'the hook queues exactly one outbox row'
);
select ok(
  exists (
    select 1 from public.message_outbox
     where to_phone = '+923110000001'
       and channel = 'sms' and kind = 'otp' and status = 'queued'
       and to_user_id = tests.id('ali')
       and payload = '{"otp": "123456"}'::jsonb
       and body = 'TezDukan code: 123456. Do not share this code with anyone.'
  ),
  'the outbox row carries channel sms, kind otp, E.164 phone, payload {"otp"} and the SMS text'
);
select is(
  private.hook_send_sms(jsonb_build_object(
    'user', jsonb_build_object('id', tests.id('bob'), 'phone', '923110000099', 'phone_change', '923110000123'),
    'sms', jsonb_build_object('otp', '654321', 'phone', '923110000123')
  )),
  '{}'::jsonb,
  'the hook accepts a phone-change event'
);
select is(
  (select payload ->> 'otp' from public.message_outbox where to_phone = '+923110000123'),
  '654321',
  'phone-change codes go to sms.phone (the new number)'
);
select is(
  private.hook_send_sms('{"user": {"phone": "923110000001"}, "sms": {}}'::jsonb) -> 'error' ->> 'http_code',
  '500',
  'a missing code returns the documented error shape'
);

-- Admins can read the outbox (the Sandbox panel itself reads it with the service role).
select tests.authenticate_as('ops');
select ok((select count(*) from public.message_outbox) >= 2, 'admins can read message_outbox');
select tests.clear_authentication();

select ok(
  not exists (select 1 from public.message_outbox where payload ? 'sms_type'),
  'payload carries only the code'
);

select * from finish();
rollback;
