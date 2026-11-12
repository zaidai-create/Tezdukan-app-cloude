-- Cancelling a customer order, fair to both sides: free while only placed; for 2 minutes after
-- the dukan accepts (not packed) with a reason the dukan sees; never once packed or on the way.
-- The dukan can still cancel what it has accepted.
begin;
\ir helpers/setup.psql
select plan(10);

select tests.create_user('owner');
select tests.create_user('shopper');
select tests.make_shop('kiryana', 'owner');
select tests.make_address('home', 'shopper');
grant insert, update on tests.refs to authenticated;
insert into public.storefront_settings (shop_id, is_live, min_order_paisa) values (tests.id('kiryana'), true, 0);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 95 g', 50000, 50, true) returning tests.remember('chai', id);

select tests.authenticate_as('shopper');
select tests.remember(name, (public.place_customer_order(
  tests.id('kiryana'), jsonb_build_array(jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 1)), tests.id('home')
) ->> 'id')::uuid)
  from unnest(array['new', 'fresh', 'stale', 'packed']) name;

-- Placed: free, no reason needed.
select public.update_customer_order_status(tests.id('new'), 'cancelled');
select is(
  (select status::text from public.customer_orders where id = tests.id('new')), 'cancelled',
  'a placed order is cancelled with one tap'
);
select throws_ok(
  format($$ select public.update_customer_order_status(%L, 'accepted') $$, tests.id('fresh')),
  '55000', 'invalid_transition', 'the customer cannot accept their own order'
);

select tests.authenticate_as('owner');
select public.update_customer_order_status(tests.id(name), 'accepted')
  from unnest(array['fresh', 'stale', 'packed']) name;
select public.update_customer_order_status(tests.id('packed'), 'packed');
-- The dukan accepted "stale" three minutes ago: past the grace window.
select tests.clear_authentication();
update public.customer_orders set accepted_at = now() - interval '3 minutes' where id = tests.id('stale');

select tests.authenticate_as('shopper');
select throws_ok(
  format($$ select public.update_customer_order_status(%L, 'cancelled') $$, tests.id('fresh')),
  '22023', 'reason_required', 'after the dukan accepts, a reason is needed'
);
select throws_ok(
  format($$ select public.update_customer_order_status(%L, 'cancelled', '   ') $$, tests.id('fresh')),
  '22023', 'reason_required', 'and blank is not a reason'
);
select public.update_customer_order_status(tests.id('fresh'), 'cancelled', 'Ordered by mistake');
select is(
  (select status::text || ' · ' || cancel_reason from public.customer_orders where id = tests.id('fresh')),
  'cancelled · Ordered by mistake',
  'within 2 minutes of accepting, it is cancelled and the reason kept'
);
select throws_ok(
  format($$ select public.update_customer_order_status(%L, 'cancelled', 'Changed my mind') $$, tests.id('stale')),
  '55000', 'too_late_to_cancel', 'after the grace window the customer calls the dukan instead'
);
select throws_ok(
  format($$ select public.update_customer_order_status(%L, 'cancelled', 'Changed my mind') $$, tests.id('packed')),
  '55000', 'too_late_to_cancel', 'a packed order cannot be cancelled by the customer'
);

-- Read as the database: notifications are private to their owner.
select tests.clear_authentication();
select ok(
  exists (
    select 1 from public.notifications n
     where n.user_id = tests.id('owner')
       and n.data ->> 'event' = 'customer_order.cancelled_by_customer'
       and n.data ->> 'reason' = 'Ordered by mistake'
       and n.body like '% · Ordered by mistake'
  ),
  'the dukan is told, with the reason'
);

select tests.authenticate_as('owner');
select public.update_customer_order_status(tests.id('packed'), 'cancelled', 'Customer not answering');
select is(
  (select status::text from public.customer_orders where id = tests.id('packed')), 'cancelled',
  'the dukan can still cancel what it packed'
);
select tests.clear_authentication();
select ok(
  exists (
    select 1 from public.notifications n
     where n.user_id = tests.id('shopper') and n.data ->> 'event' = 'customer_order.cancelled'
       and n.data ->> 'reason' = 'Customer not answering'
  ),
  'and the customer is told why'
);

select * from finish();
rollback;
