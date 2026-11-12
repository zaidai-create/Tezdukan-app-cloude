-- Support chat with the TezDukan assistant: the assistant answers first and the team is not
-- called for every message; only the server (service role) writes the assistant's answers;
-- "Yes, connect me" hands the chat to the team once and notifies every admin; from then on the
-- team is told of each message and the assistant stays quiet.
begin;
\ir helpers/setup.psql
select plan(16);

select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_admin('admin');
grant insert, update on tests.refs to authenticated;
-- The server's role reads the remembered ids in this test only.
grant usage on schema tests to service_role;
grant select on tests.refs to service_role;
grant execute on function tests.id(text) to service_role;

select tests.authenticate_as('shopper');
select tests.remember('conv', public.open_conversation('support'));
select is(
  (select support_mode from public.conversations where id = tests.id('conv')), 'assistant',
  'a new support chat starts with the assistant'
);
select is(
  public.send_chat_message(tests.id('conv'), 'Mera order kahan hai?') ->> 'support_mode', 'assistant',
  'sending tells the app the assistant will answer'
);
select tests.clear_authentication();
select is(
  (select count(*)::integer from public.notifications where user_id = tests.id('admin')), 0,
  'the team is not called for each message while the assistant answers'
);
select is(
  (select count(*)::integer from public.chat_messages where conversation_id = tests.id('conv') and sender_side = 'system'), 0,
  'and no canned auto-reply is added'
);

select tests.authenticate_as('shopper');
select throws_ok(
  format($$ select public.post_support_assistant_reply(%L, 'Fake answer') $$, tests.id('conv')),
  '42501', null, 'a person cannot write as the assistant'
);
select tests.clear_authentication();

set local role service_role;
select ok(
  public.post_support_assistant_reply(tests.id('conv'), 'Account > Orders mein dekhein.', true) is not null,
  'the server writes the assistant''s answer'
);
reset role;
select is(
  (select string_agg(sender_side::text || ':' || body, ' | ' order by created_at)
     from public.chat_messages where conversation_id = tests.id('conv') and sender_side <> 'user'),
  'assistant:Account > Orders mein dekhein. | system:support_offer_team',
  'the answer comes from the assistant, followed by the offer to connect the team'
);

set local role service_role;
select ok(
  public.post_support_assistant_note(tests.id('conv'), 'support_assistant_retry'),
  'when the AI is busy, the server adds "please ask again"'
);
reset role;
select tests.authenticate_as('shopper');
select throws_ok(
  format($$ select public.post_support_assistant_note(%L, 'support_assistant_retry') $$, tests.id('conv')),
  '42501', null, 'a person cannot add the assistant''s notes'
);

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.request_support_team(%L) $$, tests.id('conv')),
  'P0002', 'conversation_not_found', 'someone else cannot hand over this chat'
);

select tests.authenticate_as('shopper');
select ok(public.request_support_team(tests.id('conv')), '"Yes, connect me" hands the chat to the team');
select ok(not public.request_support_team(tests.id('conv')), 'asking again changes nothing');
select tests.clear_authentication();
select is(
  (select count(*)::integer from public.notifications
    where user_id = tests.id('admin') and data ->> 'event' = 'support.team_requested'
      and link = '/admin/support/' || tests.id('conv')),
  1, 'every admin is notified once, with a link to the chat'
);

select tests.authenticate_as('shopper');
select public.send_chat_message(tests.id('conv'), 'Jaldi batayein please');
select tests.clear_authentication();
select is(
  (select count(*)::integer from public.notifications where user_id = tests.id('admin') and kind = 'chat'),
  1, 'with the team on it, new messages reach the team'
);

set local role service_role;
select is(
  public.post_support_assistant_reply(tests.id('conv'), 'Late answer'), null,
  'the assistant stays quiet once the team has the chat'
);
reset role;

-- A chat a staff member answers goes to the team too.
select tests.authenticate_as('stranger');
select tests.remember('conv2', public.open_conversation('support'));
select public.send_chat_message(tests.id('conv2'), 'Salam');
select tests.authenticate_as('admin');
select public.send_chat_message(tests.id('conv2'), 'Wa alaikum salam, batayein?', null, 'staff');
select tests.clear_authentication();
select is(
  (select support_mode from public.conversations where id = tests.id('conv2')), 'team',
  'once a staff member answers, the team keeps the chat'
);

select * from finish();
rollback;
