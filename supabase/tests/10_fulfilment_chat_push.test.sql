-- Phase 3: distributor fulfilment (big-order confirmation, status steps, stock reservation,
-- delivery OTP, invoices and cash at the door), dukan <-> distributor chat, support chat, and
-- the Web Push outbox.
begin;
\ir helpers/setup.psql
select plan(75);

-- Fixtures -----------------------------------------------------------------------------------------
create or replace function tests.make_product(p_alias text, p_org text, p_name text, p_trade bigint)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.distributor_products (org_id, name, sku, trade_price_paisa, mrp_paisa, moq_base_qty)
  values (tests.id(p_org), p_name, 'T-' || substr(md5(random()::text), 1, 8), p_trade, p_trade + p_trade / 5, 1)
  returning id into v_id;
  perform tests.remember(p_alias, v_id);
  insert into public.pack_units (distributor_product_id, unit, label, base_qty, is_default)
  values (v_id, 'piece', 'Piece', 1, true)
  returning tests.remember(p_alias || ':piece', id) into v_id;
  return tests.id(p_alias);
end;
$$;

create or replace function tests.first_slot(p_shop text, p_org text)
returns jsonb
language sql
as $$
  select jsonb_build_object(tests.id(p_org)::text, jsonb_build_object('start', s.slot_start, 'end', s.slot_end))
    from public.delivery_slots(tests.id(p_shop), tests.id(p_org), 1) s
   order by s.slot_start
   limit 1
$$;

-- Places a one-line order as the current user and remembers its id.
create or replace function tests.order_one(p_alias text, p_shop text, p_org text, p_product text, p_qty integer)
returns uuid
language plpgsql
as $$
begin
  perform public.set_cart_item(tests.id(p_shop), tests.id(p_product), tests.id(p_product || ':piece'), p_qty);
  return tests.remember(
    p_alias,
    (public.place_order(tests.id(p_shop), gen_random_uuid(), 'cod', tests.first_slot(p_shop, p_org)) -> 'orders' -> 0 ->> 'id')::uuid
  );
end;
$$;

create or replace function tests.my_notifications(p_event text)
returns integer
language sql
as $$
  select count(*)::integer from public.notifications n where n.data ->> 'event' = p_event
$$;

grant execute on all functions in schema tests to anon, authenticated;
-- Ids of orders and chats created while signed in are remembered as that user.
grant insert, update on tests.refs to authenticated;

select tests.create_user('ali');
select tests.create_user('bilal');
select tests.create_user('dist_x');
select tests.create_user('dist_y');
select tests.create_user('rider_x');
select tests.create_user('stranger');
select tests.make_admin('admin');
select tests.make_area('zone_a');
select tests.make_shop('shop_a', 'ali', 'approved', tests.id('zone_a'));
select tests.make_shop('shop_b', 'bilal', 'approved', tests.id('zone_a'));
select tests.make_org('org_x', 'dist_x');
select tests.make_org('org_y', 'dist_y');
select tests.add_org_member('org_x', 'rider_x', 'rider');
update public.organizations
   set min_order_paisa = 0, delivery_fee_paisa = 0, free_delivery_above_paisa = null,
       settings = '{"order_cutoff_time": "23:59", "delivery_days": [1, 2, 3, 4, 5, 6, 7], "enforce_stock": false, "confirm_above_paisa": 50000}'
 where id = tests.id('org_x');

select tests.make_product('tea', 'org_x', 'Tapal Danedar 950 g', 1000);
select tests.make_product('milk', 'org_x', 'Olpers Milk 1 L', 500);
insert into public.warehouses (org_id, name, code, is_default) values (tests.id('org_x'), 'X godown', 'X1', true)
returning tests.remember('wh_x', id);
insert into public.stock_batches (org_id, warehouse_id, distributor_product_id, qty_on_hand, expiry_date)
values (tests.id('org_x'), tests.id('wh_x'), tests.id('tea'), 10, current_date + 90)
returning tests.remember('tea_batch', id);

-- Big orders are flagged for confirmation ----------------------------------------------------------
select tests.authenticate_as('ali');
select tests.order_one('small', 'shop_a', 'org_x', 'milk', 4);
select tests.order_one('big', 'shop_a', 'org_x', 'tea', 60);
select tests.clear_authentication();

select is(
  (select needs_confirmation from public.orders where id = tests.id('small')), false,
  'an order below the threshold ships without a confirmation'
);
select is(
  (select needs_confirmation from public.orders where id = tests.id('big')), true,
  'an order at or above confirm_above_paisa needs a confirmation'
);
select ok(
  (select confirmation_reasons @> array['high_value', 'first_order'] from public.orders where id = tests.id('big')),
  'the reasons say why: a big order, and the first from this dukan'
);
select throws_ok(
  $$ update public.organizations set settings = '{"confirm_above_paisa": "lots"}' where id = tests.id('org_x') $$,
  '23514', null, 'confirm_above_paisa must be a number'
);

-- The distributor's inbox and order view ------------------------------------------------------------
select tests.authenticate_as('dist_x');
select is(
  (public.org_order_inbox(tests.id('org_x'), 'new') -> 'counts' ->> 'needs_confirmation')::integer, 1,
  'the inbox counts orders waiting for a confirmation'
);
select is(
  (public.org_order_inbox(tests.id('org_x'), 'new') -> 'orders' -> 0 ->> 'id')::uuid, tests.id('big'),
  'unconfirmed big orders come first'
);
select is(
  public.org_order_inbox(tests.id('org_x'), 'new') -> 'orders' -> 0 -> 'shop' ->> 'phone',
  (select phone::text from public.shops where id = tests.id('shop_a')),
  'the distributor gets the dukandar''s phone number with the order'
);
select is(
  (public.org_order_detail(tests.id('big')) -> 'account' ->> 'status'), 'active',
  'the order view shows the dukan''s account with this distributor'
);
select is(
  jsonb_array_length(public.org_order_inbox(tests.id('org_x'), 'all', 'Shop A') -> 'orders'), 2,
  'the inbox searches by dukan name'
);

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.org_order_inbox(%L) $$, tests.id('org_x')),
  '42501', 'not_allowed', 'outsiders cannot open a distributor''s inbox'
);
select tests.authenticate_as('dist_y');
select throws_ok(
  format($$ select public.org_order_detail(%L) $$, tests.id('big')),
  'P0002', 'order_not_found', 'another distributor cannot see the order (or that it exists)'
);
select tests.authenticate_as('ali');
select throws_ok(
  format($$ select public.org_order_detail(%L) $$, tests.id('big')),
  'P0002', 'order_not_found', 'the distributor view is not for the dukandar'
);

-- Confirming a big order ------------------------------------------------------------------------
select tests.authenticate_as('dist_x');
select throws_ok(
  format($$ select public.update_order_status(%L, 'confirmed') $$, tests.id('big')),
  '55000', 'confirmation_required', 'a big order cannot be confirmed without talking to the dukandar'
);
select lives_ok(
  format($$ select public.request_shop_confirmation(%L) $$, tests.id('big')),
  'the distributor can ask the dukandar to confirm in the app'
);
select throws_ok(
  format($$ select public.request_shop_confirmation(%L) $$, tests.id('big')),
  '55000', 'too_soon', 'asking again within five minutes is refused'
);

select tests.authenticate_as('ali');
select is(tests.my_notifications('order.confirmation_requested'), 1, 'the dukandar is asked to confirm');
select tests.authenticate_as('bilal');
select throws_ok(
  format($$ select public.confirm_order_as_shop(%L) $$, tests.id('big')),
  'P0002', 'order_not_found', 'another dukan cannot confirm the order'
);
select tests.authenticate_as('ali');
select lives_ok(
  format($$ select public.confirm_order_as_shop(%L) $$, tests.id('big')),
  'the dukandar confirms the order'
);
select tests.authenticate_as('dist_x');
select is(tests.my_notifications('order.shop_confirmed'), 1, 'the distributor hears that the dukandar confirmed');

select tests.authenticate_as('rider_x');
select throws_ok(
  format($$ select public.update_order_status(%L, 'confirmed') $$, tests.id('big')),
  '42501', 'not_allowed', 'riders cannot change an order''s status'
);

select tests.authenticate_as('dist_x');
select is(
  jsonb_array_length(public.update_order_status(tests.id('big'), 'confirmed') -> 'shortages'), 1,
  'confirming reserves stock and reports what is short'
);
select tests.clear_authentication();
select is(
  (select qty_reserved from public.stock_batches where id = tests.id('tea_batch')), 10,
  'all available tea is reserved FEFO for the order'
);
select tests.authenticate_as('dist_x');
select is(
  public.update_order_status(tests.id('small'), 'confirmed') -> 'shortages', '[]'::jsonb,
  'products without stock records never report shortages'
);
select throws_ok(
  format($$ select public.update_order_status(%L, 'new') $$, tests.id('big')),
  '55000', 'invalid_transition', 'orders never move backwards'
);
select throws_ok(
  format($$ select public.update_order_status(%L, 'delivered') $$, tests.id('big')),
  '55000', 'invalid_transition', 'delivery goes through confirm_delivery'
);
select lives_ok(
  format($$ select public.update_order_status(%L, 'dispatched', 'Bike 2') $$, tests.id('big')),
  'a confirmed order can be dispatched straight away'
);
select tests.authenticate_as('ali');
select is(tests.my_notifications('order.dispatched'), 1, 'the dukandar hears the order is on the way');
select is(tests.my_notifications('order.confirmed'), 2, 'and heard when each order was confirmed');

-- Delivery code ------------------------------------------------------------------------------------
select ok(public.order_delivery_code(tests.id('big')) ~ '^[0-9]{4}$', 'the dukandar sees the 4-digit delivery code');
select tests.authenticate_as('dist_x');
select is(public.order_delivery_code(tests.id('big')), null, 'the distributor never sees the code');

select tests.authenticate_as('rider_x');
select is(
  public.confirm_delivery(tests.id('big'), '00000') ->> 'error', 'otp_invalid',
  'a wrong code is refused without raising'
);
select tests.clear_authentication();
select is(
  (select attempts from public.delivery_otps where order_id = tests.id('big')), 1,
  'and the attempt is counted'
);

-- Short delivery with cash at the door --------------------------------------------------------------
select tests.remember('big_item', (select id from public.order_items where order_id = tests.id('big')));
create temporary table otp on commit drop as
  select order_id, code from public.delivery_otps where order_id in (tests.id('big'), tests.id('small'));
grant select on otp to authenticated;

select tests.authenticate_as('rider_x');
select is(
  public.confirm_delivery(
    tests.id('big'), (select code from otp where order_id = tests.id('big')), 5000,
    jsonb_build_array(jsonb_build_object('order_item_id', tests.id('big_item'), 'delivered_base_qty', 10))
  ) ->> 'status',
  'partially_delivered',
  'the rider delivers 10 of 60 with the right code'
);
select tests.clear_authentication();
select is(
  (select row(total_paisa, paid_paisa, payment_status::text, invoice_number like 'INV-%')::text
     from public.orders where id = tests.id('big')),
  '(10000,5000,partially_paid,t)',
  'the order is restated to what was delivered, with the cash collected'
);
select is(
  (select row(short_base_qty, delivered_base_qty)::text from public.order_items where id = tests.id('big_item')),
  '(50,10)', 'the short quantity is recorded'
);
select is(
  (select row(qty_on_hand, qty_reserved)::text from public.stock_batches where id = tests.id('tea_batch')),
  '(0,0)', 'delivered pieces leave the warehouse and the reservation is released'
);
select is(
  private.receivable_balance(tests.id('org_x'), tests.id('shop_a')), 5000::bigint,
  'the khata shows the invoice less the cash collected'
);
select lives_ok('set constraints all immediate', 'every journal posted at delivery balances');
-- Back to deferred: each RPC is its own transaction in the app, checked at commit.
set constraints all deferred;

select tests.authenticate_as('rider_x');
select throws_ok(
  format($$ select public.confirm_delivery(%L, '1234') $$, tests.id('big')),
  '55000', null, 'a delivered order cannot be delivered again'
);
select tests.authenticate_as('dist_x');
select throws_ok(
  format($$ select public.confirm_delivery(%L, %L, 999999) $$, tests.id('small'), (select code from otp where order_id = tests.id('small'))),
  '22023', 'cash_exceeds_due', 'cash above the invoice is refused'
);
select is(
  public.confirm_delivery(tests.id('small'), (select code from otp where order_id = tests.id('small')), 2000) ->> 'status',
  'delivered', 'a full delivery paid in cash'
);
select tests.clear_authentication();
select is(
  (select payment_status::text from public.orders where id = tests.id('small')), 'paid',
  'and the order is marked paid'
);
select tests.authenticate_as('dist_x');
select is(
  (public.org_dashboard(tests.id('org_x')) ->> 'delivered_today_paisa')::bigint, 12000::bigint,
  'the dashboard adds up today''s deliveries'
);
select is(
  (public.org_insights(tests.id('org_x')) -> 'retailers' ->> 'active')::integer, 1,
  'insights count the dukan that ordered this week as active'
);
select ok(
  (public.org_insights(tests.id('org_x')) ->> 'fill_rate')::numeric > 0,
  'insights work out the fill rate from delivered pieces'
);
select is(
  jsonb_array_length(public.org_insights(tests.id('org_x')) -> 'top_products') > 0, true,
  'insights list the best sellers'
);
select tests.authenticate_as('dist_y');
select throws_ok(
  format($$ select public.org_insights(%L) $$, tests.id('org_x')),
  '42501', 'not_allowed', 'another distributor cannot read the insights'
);
select tests.authenticate_as('ali');
select is(tests.my_notifications('order.delivered'), 2, 'the dukandar hears about each delivery');
select tests.order_one('third', 'shop_a', 'org_x', 'milk', 1);
select tests.clear_authentication();
select ok(
  not (select 'first_order' = any (confirmation_reasons) from public.orders where id = tests.id('third')),
  'after a delivery, new orders are no longer first orders'
);

-- Trade chat --------------------------------------------------------------------------------------
select tests.authenticate_as('ali');
select tests.remember('chat', public.open_conversation('trade', tests.id('shop_a'), tests.id('org_x')));
select is(
  public.open_conversation('trade', tests.id('shop_a'), tests.id('org_x')), tests.id('chat'),
  'a dukan and a distributor share one conversation'
);
select throws_ok(
  format($$ select public.send_chat_message(%L, '   ') $$, tests.id('chat')),
  '22023', 'message_empty', 'empty messages are refused'
);
select is(
  public.send_chat_message(tests.id('chat'), 'Kal subah delivery ho sakti hai?') ->> 'sender_side', 'shop',
  'the server decides the sender is the dukan'
);

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.open_conversation('trade', %L, %L) $$, tests.id('shop_a'), tests.id('org_x')),
  '42501', 'not_allowed', 'outsiders cannot open a trade chat'
);
select is(
  tests.row_count('select * from public.chat_messages'), 0, 'outsiders read no messages'
);
select tests.authenticate_as('dist_y');
select is(
  tests.row_count('select * from public.conversations'), 0, 'other distributors see no conversations'
);

select tests.authenticate_as('dist_x');
select is(tests.my_notifications('chat.message'), 1, 'the distributor is notified of the message');
select is(
  (public.my_conversations(p_org_id => tests.id('org_x')) -> 0 ->> 'unread')::integer, 1,
  'and sees one unread message'
);
select lives_ok(format($$ select public.mark_conversation_read(%L) $$, tests.id('chat')), 'reading the chat');
select is(
  (public.my_conversations(p_org_id => tests.id('org_x')) -> 0 ->> 'unread')::integer, 0,
  'clears the unread count'
);
select is(
  (select count(*)::integer from public.notifications where kind = 'chat' and read_at is null), 0,
  'and the chat notification'
);
select public.send_chat_message(tests.id('chat'), 'Ji, 11 baje tak.');
select public.send_chat_message(tests.id('chat'), 'Rider ka number 0300 1234567 hai.');
-- A test runs in one transaction, so every message shares one timestamp: move the dukan's
-- read marker (set when it sent its message) a second earlier so the replies count as newer.
select tests.clear_authentication();
update public.conversation_reads set last_read_at = last_read_at - interval '1 second'
 where user_id = tests.id('ali');
select tests.authenticate_as('ali');
select is(tests.my_notifications('chat.message'), 1, 'quick replies collapse into one notification');
select is(public.chat_unread_count(tests.id('shop_a')), 2, 'the dukan''s chat badge counts both replies');
select is(
  jsonb_array_length(public.conversation_detail(tests.id('chat')) -> 'messages'), 3,
  'the conversation shows every message'
);

-- Support chat ------------------------------------------------------------------------------------
select tests.remember('support', public.open_conversation('support', tests.id('shop_a')));
select public.send_chat_message(tests.id('support'), 'Mera order late hai.');
select is(
  (select count(*)::integer from public.chat_messages where conversation_id = tests.id('support') and sender_side = 'system'), 1,
  'the first support message gets an instant auto-reply'
);
select throws_ok(
  $$ select public.my_conversations(p_support_queue => true) $$,
  '42501', 'not_allowed', 'only TezDukan staff see the support queue'
);
select tests.authenticate_as('admin');
select is(
  (public.my_conversations(p_support_queue => true) -> 0 ->> 'id')::uuid, tests.id('support'),
  'staff see the conversation in the support queue'
);
select is(
  public.send_chat_message(tests.id('support'), 'Hum check kar rahe hain.') ->> 'sender_side', 'staff',
  'staff reply as TezDukan'
);
select tests.authenticate_as('ali');
select is(
  (select count(*)::integer from public.notifications where kind = 'chat' and link = '/dukan/chat/' || tests.id('support')), 1,
  'the dukandar is notified of the reply'
);

-- Web Push outbox --------------------------------------------------------------------------------
select lives_ok(
  $$ select public.register_push_subscription('https://push.example.test/abc', repeat('k', 87), repeat('a', 22), 'Test browser') $$,
  'a browser registers for push'
);
select throws_ok(
  $$ select public.register_push_subscription('http://push.example.test/abc', repeat('k', 87), repeat('a', 22)) $$,
  '22023', 'invalid_subscription', 'only https push endpoints are accepted'
);
select tests.clear_authentication();
select private.notify_shop(tests.id('shop_a'), array['orders'], 'order', 'Test push');
select private.notify_org(tests.id('org_x'), array['orders.view'], 'order', 'No push for dist_x');
select is(
  (select count(*)::integer from public.message_outbox where channel = 'push' and to_user_id = tests.id('ali') and status = 'queued'), 1,
  'a notification for a subscribed person queues a push'
);
select is(
  (select count(*)::integer from public.message_outbox where channel = 'push' and to_user_id = tests.id('dist_x')), 0,
  'people without a subscription get no push'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_push_messages(integer)', 'EXECUTE'),
  'only the server can claim push messages'
);
set local role service_role;
select is(
  (select count(*)::integer from public.claim_push_messages(10)), 1,
  'the server claims the queued push'
);
reset role;
select tests.authenticate_as('bilal');
select public.register_push_subscription('https://push.example.test/abc', repeat('k', 87), repeat('a', 22));
select tests.clear_authentication();
select is(
  (select user_id from public.push_subscriptions where endpoint = 'https://push.example.test/abc'), tests.id('bilal'),
  'a browser that changes hands moves its subscription to the new person'
);

select * from finish();
rollback;
