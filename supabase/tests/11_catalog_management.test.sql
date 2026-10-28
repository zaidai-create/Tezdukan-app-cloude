-- Distributor catalog management: saving products with packs and stock in one call, the
-- catalog list with stock, permissions, and the master catalog search used to pre-fill.
begin;
\ir helpers/setup.psql
select plan(16);

select tests.create_user('dist_x');
select tests.create_user('dist_y');
select tests.create_user('store_x');
select tests.make_org('org_x', 'dist_x');
select tests.make_org('org_y', 'dist_y');
select tests.add_org_member('org_x', 'store_x', 'accountant');
grant insert, update on tests.refs to authenticated;

insert into public.master_products (name, name_ur, category_id, pack_size_label, barcode)
select 'Testo Danedar Tea 950 g', 'ٹیسٹو چائے', c.id, '950 g', '8960000000017'
  from public.categories c order by c.sort_order limit 1
returning tests.remember('mp', id);
insert into public.product_aliases (target_type, master_product_id, alias, language, kind)
values ('product', tests.id('mp'), 'testo chai patti', 'ur-Latn', 'generic');

select tests.authenticate_as('dist_x');
select tests.remember('p', public.save_distributor_product(tests.id('org_x'), jsonb_build_object(
  'master_product_id', tests.id('mp'), 'name', 'Testo Danedar Tea 950 g', 'pack_size_label', '950 g',
  'trade_price_paisa', 150000, 'mrp_paisa', 175000, 'carton_qty', 12, 'stock_in_qty', 24,
  'stock_expiry_date', (current_date + 180)::text
)));
select tests.clear_authentication();

select is(
  (select count(*)::integer from public.pack_units where distributor_product_id = tests.id('p')), 2,
  'a product is saved with a piece and a carton pack'
);
select is(
  (select unit::text from public.pack_units where distributor_product_id = tests.id('p') and is_default), 'carton',
  'the carton is what dukans see first'
);
select is(
  (select sum(qty_on_hand)::integer from public.stock_batches where distributor_product_id = tests.id('p')), 24,
  'stock received with the product lands in a batch'
);
select is(
  (select count(*)::integer from public.stock_movements where distributor_product_id = tests.id('p') and movement_type = 'stock_in'), 1,
  'and is recorded as a stock-in movement'
);
select ok(
  (select is_default from public.warehouses where org_id = tests.id('org_x')),
  'a distributor without a warehouse gets a default godown'
);

select tests.authenticate_as('dist_x');
select throws_ok(
  format($$ select public.save_distributor_product(%L, '{"name": "Cheap Tea", "trade_price_paisa": 2000, "mrp_paisa": 1000}') $$, tests.id('org_x')),
  '22023', 'price_above_mrp', 'the trade price cannot be above MRP'
);
select throws_ok(
  format($$ select public.save_distributor_product(%L, '{"name": "Tea", "trade_price_paisa": 1000, "image_path": "org/%s/x.webp"}') $$, tests.id('org_x'), tests.id('org_y')),
  '22023', 'invalid_image', 'a photo from another distributor''s folder is refused'
);
select throws_ok(
  format($$ select public.save_distributor_product(%L, '{"name": "T", "trade_price_paisa": 1000}') $$, tests.id('org_x')),
  '22023', 'name_required', 'a product needs a real name'
);
select lives_ok(
  format($$ select public.save_distributor_product(%L, jsonb_build_object('id', %L, 'name', 'Testo Danedar Tea 950 g', 'trade_price_paisa', 152000, 'mrp_paisa', 175000)) $$,
         tests.id('org_x'), tests.id('p')),
  'saving again without a carton updates the product'
);
select is(
  (select array_agg(unit::text) from public.pack_units where distributor_product_id = tests.id('p')), array['piece'],
  'and removes the carton pack'
);
select is(
  (public.org_catalog(tests.id('org_x')) -> 'counts' ->> 'all')::integer, 1,
  'the catalog lists the distributor''s products'
);
select is(
  (public.org_catalog(tests.id('org_x')) -> 'items' -> 0 ->> 'available_base_qty')::integer, 24,
  'with the stock available'
);
select is(
  public.search_master_products('testo chai') -> 0 ->> 'id', tests.id('mp')::text,
  'the master catalog is found by its Roman Urdu alias'
);
select is(
  public.search_master_products('8960000000017') -> 0 ->> 'name', 'Testo Danedar Tea 950 g',
  'and by barcode'
);

select tests.authenticate_as('store_x');
select throws_ok(
  format($$ select public.save_distributor_product(%L, '{"name": "Tea", "trade_price_paisa": 1000}') $$, tests.id('org_x')),
  '42501', 'not_allowed', 'members without catalog.manage cannot change the catalog'
);
select tests.authenticate_as('dist_y');
select throws_ok(
  format($$ select public.org_catalog(%L) $$, tests.id('org_x')),
  '42501', 'not_allowed', 'another distributor cannot read the catalog with stock'
);

select * from finish();
rollback;
