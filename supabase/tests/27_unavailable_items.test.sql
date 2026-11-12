-- When something in an order is not on the shelf: the customer's choice is kept with the order,
-- only the dukan can remove or replace a line (same price or less), the total follows, the old
-- line is kept as a change the customer can see, and delivery takes stock of what was sent.
begin;
\ir helpers/setup.psql
select plan(18);

select tests.create_user('owner');
select tests.create_user('shopper');
select tests.create_user('stranger');
select tests.make_shop('kiryana', 'owner');
select tests.make_address('home', 'shopper');
grant insert, update on tests.refs to authenticated;

insert into public.storefront_settings (shop_id, is_live, min_order_paisa, delivery_fee_paisa)
values (tests.id('kiryana'), true, 0, 5000);
insert into public.categories (name, slug) values ('Testo Tea', 'testo-tea') returning tests.remember('tea', id);
insert into public.shop_inventory (shop_id, name, category_id, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Chai 190 g', tests.id('tea'), 50000, 10, true) returning tests.remember('chai', id);
insert into public.shop_inventory (shop_id, name, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Testo Dahi 400 g', 30000, 10, true) returning tests.remember('dahi', id);
insert into public.shop_inventory (shop_id, name, category_id, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Other Chai 190 g', tests.id('tea'), 45000, 10, true) returning tests.remember('other_chai', id);
insert into public.shop_inventory (shop_id, name, category_id, selling_price_paisa, qty_on_hand, is_visible_online)
values (tests.id('kiryana'), 'Premium Chai 190 g', tests.id('tea'), 90000, 10, true) returning tests.remember('premium', id);

select tests.authenticate_as('shopper');
select tests.remember('order', (public.place_customer_order(
  tests.id('kiryana'),
  jsonb_build_array(
    jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 2),
    jsonb_build_object('inventory_id', tests.id('dahi'), 'qty', 1)
  ),
  tests.id('home'), null, null, 'replace'::public.unavailable_choice
) ->> 'id')::uuid);
select is(
  (select if_unavailable::text from public.customer_orders where id = tests.id('order')), 'replace',
  'the customer''s choice is kept with the order'
);
select is(
  (select total_paisa from public.customer_orders where id = tests.id('order')), 135000::bigint,
  'the order starts at Rs 1,350 (1,000 + 300 + 50 delivery)'
);
select tests.remember('chai_line', (select id from public.customer_order_items where customer_order_id = tests.id('order') and name = 'Testo Chai 190 g'));
select tests.remember('dahi_line', (select id from public.customer_order_items where customer_order_id = tests.id('order') and name = 'Testo Dahi 400 g'));

select throws_ok(
  format($$ select public.remove_order_item(%L) $$, tests.id('dahi_line')),
  '42501', 'not_allowed', 'the customer cannot change lines'
);
select tests.authenticate_as('stranger');
select throws_ok(
  format($$ select public.remove_order_item(%L) $$, tests.id('dahi_line')),
  '42501', 'not_allowed', 'nor can someone else'
);

select tests.authenticate_as('owner');
select is(
  (select jsonb_agg(r ->> 'name' order by r ->> 'name') from jsonb_array_elements(public.order_item_replacements(tests.id('chai_line'))) r
    where r ->> 'name' like '%Chai%'),
  '["Other Chai 190 g"]'::jsonb,
  'replacements are the same price or less (the dearer chai is not offered)'
);
select is(
  public.order_item_replacements(tests.id('chai_line')) -> 0 ->> 'name', 'Other Chai 190 g',
  'and the same category comes first'
);
select throws_ok(
  format($$ select public.replace_order_item(%L, %L) $$, tests.id('chai_line'), tests.id('premium')),
  '55000', 'replacement_costs_more', 'a dearer replacement is refused'
);
select public.replace_order_item(tests.id('chai_line'), tests.id('other_chai'));
select is(
  (select name || ' ' || line_total_paisa from public.customer_order_items where id = tests.id('chai_line')),
  'Other Chai 190 g 90000', 'the line now carries the replacement at its own price'
);
select is(
  (select total_paisa from public.customer_orders where id = tests.id('order')), 125000::bigint,
  'and the total follows (900 + 300 + 50)'
);

select public.remove_order_item(tests.id('dahi_line'));
select is(
  (select subtotal_paisa::text || '/' || total_paisa::text || '/' || items_count::text
     from public.customer_orders where id = tests.id('order')),
  '90000/95000/2', 'removing a line lowers subtotal, total and item count; delivery stays'
);
select throws_ok(
  format($$ select public.remove_order_item(%L) $$, tests.id('chai_line')),
  '55000', 'last_item', 'the last line cannot be removed (the order is rejected instead)'
);

select tests.authenticate_as('shopper');
select is(
  (select string_agg(kind::text || ':' || item_name || coalesce('>' || new_name, ''), ', ' order by item_name)
     from public.customer_order_changes where customer_order_id = tests.id('order')),
  'replaced:Testo Chai 190 g>Other Chai 190 g, removed:Testo Dahi 400 g',
  'the customer sees what changed'
);
select tests.authenticate_as('stranger');
select is((select count(*)::integer from public.customer_order_changes), 0, 'nobody else does');

-- Removal-only customers get no replacements.
select tests.authenticate_as('shopper');
select tests.remember('order2', (public.place_customer_order(
  tests.id('kiryana'),
  jsonb_build_array(
    jsonb_build_object('inventory_id', tests.id('chai'), 'qty', 1),
    jsonb_build_object('inventory_id', tests.id('dahi'), 'qty', 1)
  ),
  tests.id('home'), null, null, 'remove'::public.unavailable_choice
) ->> 'id')::uuid);
select tests.authenticate_as('owner');
select throws_ok(
  format($$ select public.replace_order_item(%L, %L) $$,
         (select id from public.customer_order_items where customer_order_id = tests.id('order2') and name = 'Testo Chai 190 g'),
         tests.id('other_chai')),
  '55000', 'customer_wants_removal', 'a customer who asked for removal gets no replacement'
);

-- Delivery takes stock of what was actually sent.
select public.update_customer_order_status(tests.id('order'), 'accepted');
select public.update_customer_order_status(tests.id('order'), 'delivered');
select is((select qty_on_hand::integer from public.shop_inventory where id = tests.id('other_chai')), 8, 'the replacement leaves the shelf');
select is((select qty_on_hand::integer from public.shop_inventory where id = tests.id('chai')), 10, 'the original does not');
select is((select qty_on_hand::integer from public.shop_inventory where id = tests.id('dahi')), 10, 'nor does the removed line');
select throws_ok(
  format($$ select public.remove_order_item(%L) $$, tests.id('chai_line')),
  '55000', 'invalid_transition', 'a delivered order cannot be changed'
);

select * from finish();
rollback;
