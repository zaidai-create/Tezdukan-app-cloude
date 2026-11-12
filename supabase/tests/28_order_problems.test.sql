-- Reporting a problem with an order: only the customer, never on a cancelled order, one ticket
-- per order, the report lands in the support chat and the dukan is told.
begin;
\ir helpers/setup.psql
select plan(9);

select tests.create_user('owner');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
select tests.make_address('home', 'shopper');
grant insert, update on tests.refs to authenticated;
insert into public.storefront_settings (shop_id, is_live, min_order_paisa) values (tests.id('kiryana'), true, 0);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 50000, 10, true) returning tests.remember('chai', id);

select tests.authenticate_as('shopper');
select tests.remember('order', (public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 1)), tests.id('home')
) ->> 'id')::uuid);

select throws_ok(
  format($$ select public.report_order_problem(%L, 'cosmic_rays') $$, tests.id('order')),
  '22023', 'invalid_reason', 'an unknown reason is refused'
);
select throws_ok(
  format($$ select public.report_order_problem(%L, 'other') $$, tests.id('order')),
  '22023', 'details_required', '"Something else" needs a few words'
);
select tests.remember('ticket', public.report_order_problem(tests.id('order'), 'late', 'Still waiting after an hour'));
select is(
  (select kind::text || '/' || status::text from public.support_tickets where id = tests.id('ticket')),
  'dispute/open', 'a report opens a dispute ticket'
);
select is(
  public.report_order_problem(tests.id('order'), 'missing_item'), tests.id('ticket'),
  'a second report adds to the same ticket'
);
select is(
  (select count(*)::integer from public.support_messages where ticket_id = tests.id('ticket')), 2,
  'with both messages'
);
select ok(
  exists (
    select 1 from public.chat_messages m
      join public.conversations c on c.id = m.conversation_id
     where c.kind = 'support' and c.user_id = tests.id('shopper') and m.body like 'Problem with order%'
  ),
  'the report is in the customer''s support chat'
);
-- Read as the database, not the shopper: notifications are private to their owner.
select tests.clear_authentication();
select ok(
  exists (
    select 1 from public.notifications n
     where n.user_id = tests.id('owner') and n.data ->> 'event' = 'customer_order.problem'
  ),
  'the dukan is told'
);

select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.report_order_problem(%L, 'late') $$, tests.id('order')),
  'P0002', 'order_not_found', 'someone else cannot report on the order'
);

select tests.authenticate_as('shopper');
select public.update_customer_order_status(tests.id('order'), 'cancelled');
select throws_ok(
  format($$ select public.report_order_problem(%L, 'late') $$, tests.id('order')),
  '55000', 'invalid_transition', 'a cancelled order has nothing to report'
);

select * from finish();
rollback;
