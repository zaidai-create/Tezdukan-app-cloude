-- Structural guarantees for the whole public schema: RLS everywhere, indexed foreign keys,
-- standard columns, soft delete on financial records, no client writes to financial/stock
-- tables, nothing exposed to anon beyond reference data, safe SECURITY DEFINER functions.
begin;
\ir helpers/setup.psql
select plan(22);

-- Financial records (soft delete, never hard-deleted).
create temporary table financial_tables (name text primary key) on commit drop;
insert into financial_tables values
  ('orders'), ('order_items'), ('credit_notes'), ('ledger_journals'), ('ledger_entries'), ('payments'),
  ('payment_allocations'), ('cash_settlements'), ('subscriptions'), ('subscription_invoices'), ('pos_bills'),
  ('pos_bill_items'), ('expenses'), ('cash_book'), ('customer_orders'), ('stock_receipts'), ('shop_customers');

-- Written only by RPCs: financial transactions, stock ledgers and delivery proof.
create temporary table rpc_only_tables (name text primary key) on commit drop;
insert into rpc_only_tables values
  ('orders'), ('order_items'), ('order_status_history'), ('delivery_otps'), ('returns'), ('return_items'),
  ('credit_notes'), ('proof_of_delivery'), ('ledger_accounts'), ('ledger_journals'), ('ledger_entries'),
  ('payments'), ('payment_allocations'), ('cash_settlements'), ('subscriptions'), ('subscription_invoices'),
  ('pos_bills'), ('pos_bill_items'), ('expenses'), ('cash_book'), ('customer_orders'), ('customer_order_items'),
  ('stock_receipts'), ('stock_batches'), ('stock_movements'), ('stock_transfers'), ('shop_stock_batches'),
  ('shop_stock_movements'), ('reward_points');

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has row level security enabled'
);

select is_empty(
  $$ select c.conrelid::regclass::text || ' (' || c.conname || ')'
       from pg_constraint c
       join pg_namespace n on n.oid = c.connamespace
      where c.contype = 'f' and n.nspname = 'public'
        and not exists (
          select 1 from pg_index i
           where i.indrelid = c.conrelid
             and (select array_agg(k order by k) from unnest((string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)]) as k)
               = (select array_agg(k order by k) from unnest(c.conkey) as k)
        ) $$,
  'every foreign key is covered by an index'
);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (
          not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'id' and not a.attisdropped)
          or not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'created_at' and not a.attisdropped)
          or not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped)
          or not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'created_by' and not a.attisdropped)
        ) $$,
  'every public table has id, created_at, updated_at and created_by'
);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'set_row_metadata' and not t.tgisinternal) $$,
  'every public table maintains updated_at/created_by with the set_row_metadata trigger'
);

select is_empty(
  $$ select f.name from financial_tables f
      where not exists (
        select 1 from information_schema.columns col
         where col.table_schema = 'public' and col.table_name = f.name and col.column_name = 'deleted_at'
      ) $$,
  'every financial table has deleted_at (soft delete)'
);

select is_empty(
  $$ select f.name from financial_tables f
      where f.name <> 'shop_customers'
        and not exists (
          select 1 from pg_trigger t
           where t.tgrelid = ('public.' || f.name)::regclass and t.tgname = 'prevent_hard_delete'
        ) $$,
  'financial records cannot be hard-deleted (prevent_hard_delete trigger)'
);

select is_empty(
  $$ select p.tablename || ': ' || p.policyname || ' (' || p.cmd || ')'
       from pg_policies p
      where p.schemaname = 'public' and p.tablename in (select name from rpc_only_tables) and p.cmd <> 'SELECT' $$,
  'financial and stock tables have no insert/update/delete policies'
);

select is_empty(
  $$ select r.name || ': ' || priv
       from rpc_only_tables r
       cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as v(priv)
      where case
              when priv = 'DELETE' then has_table_privilege('authenticated', ('public.' || r.name)::regclass, priv)
              else has_any_column_privilege('authenticated', ('public.' || r.name)::regclass, priv)
            end $$,
  'authenticated holds no write privilege on financial and stock tables'
);

select is_empty(
  $$ select p.tablename || ': ' || p.policyname from pg_policies p
      where p.schemaname = 'public' and p.cmd = 'ALL' $$,
  'no FOR ALL policies (one policy per command)'
);

select is_empty(
  $$ select c.relname || ': ' || v.priv
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as v(priv)
      where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
        and has_table_privilege('anon', c.oid, v.priv)
        and not (
          v.priv = 'SELECT'
          and c.relname in ('service_areas', 'brands', 'categories', 'master_products', 'product_aliases',
                            'product_images', 'plans', 'content_pages', 'feature_flags')
        ) $$,
  'anon can only read reference data tables'
);

select is_empty(
  $$ select c.relname || ': ' || v.priv
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       cross join (values ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as v(priv)
      where n.nspname = 'public' and c.relkind in ('r', 'p')
        and has_table_privilege('authenticated', c.oid, v.priv) $$,
  'authenticated never gets TRUNCATE/REFERENCES/TRIGGER (not governed by RLS)'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg where cfg like 'search_path=%') $$,
  'every SECURITY DEFINER function pins its search_path'
);

select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege('anon', p.oid, 'EXECUTE') $$,
  'anon cannot execute any public function'
);

select ok(
  has_function_privilege('supabase_auth_admin', 'private.hook_send_sms(jsonb)', 'EXECUTE'),
  'supabase_auth_admin can execute the Send SMS hook'
);
select ok(
  not has_function_privilege('authenticated', 'private.hook_send_sms(jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'private.hook_send_sms(jsonb)', 'EXECUTE'),
  'API roles cannot execute the Send SMS hook'
);
select ok(
  not has_function_privilege('authenticated', 'public.seed_reset()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.next_counter(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.seed_reset()', 'EXECUTE'),
  'seed_reset and next_counter are service-role only'
);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'
        and not coalesce(c.reloptions @> array['security_invoker=true'], false) $$,
  'views run with the caller''s privileges (security_invoker)'
);

select set_eq(
  $$ select tablename::text from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['orders', 'order_status_history', 'notifications', 'conversations', 'chat_messages', 'customer_orders'],
  'realtime publishes orders, order events, notifications, chat and customer orders'
);

select ok(
  (select count(*) from pg_policies where schemaname = 'public') > 200,
  'policies are defined across the schema'
);

-- CHECK constraints, defaults, generated columns and policies run with the caller's privileges,
-- so every private function they use must be executable by the API roles that write/read.
select is_empty(
  $$ select distinct p.oid::regprocedure::text || ' for ' || r.rolname
       from pg_depend d
       join pg_proc p on d.refclassid = 'pg_proc'::regclass and d.refobjid = p.oid
       join pg_namespace pn on pn.oid = p.pronamespace and pn.nspname = 'private'
       cross join (values ('authenticated'), ('service_role')) as r(rolname)
      where d.classid in ('pg_constraint'::regclass, 'pg_attrdef'::regclass, 'pg_policy'::regclass)
        and not has_function_privilege(r.rolname, p.oid, 'EXECUTE') $$,
  'functions used by constraints, defaults, generated columns and policies are executable by API roles'
);

-- Data API sessions load pg-safeupdate, which rejects DELETE without WHERE even inside RPCs.
select is_empty(
  $$ select p.oid::regprocedure::text
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private')
        and p.prosrc ~* 'delete\s+from\s+[a-z0-9_."]+(\s+(as\s+)?[a-z0-9_]+)?\s*;' $$,
  'no function issues a DELETE without a WHERE clause (pg-safeupdate)'
);

set local role service_role;
select lives_ok(
  $$
    with org as (
      insert into public.organizations (name, slug, phone, status, settings)
      values ('Structure Check Traders', 'structure-check-traders', '+923110000000', 'approved',
              '{"order_cutoff_time": "18:00", "delivery_days": [1, 2, 3], "enforce_stock": false}')
      returning id
    )
    insert into public.schemes (org_id, name, kind, rules)
    select id, '12 + 1', 'buy_x_get_y', '{"buy_base_qty": 12, "free_base_qty": 1}' from org
  $$,
  'the service role can write rows guarded by validation functions'
);
reset role;

select * from finish();
rollback;
