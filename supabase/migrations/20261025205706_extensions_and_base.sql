-- =============================================================================================
-- TezDukan: extensions, schemas, secure default privileges and shared helpers.
--
-- Conventions every later migration follows (PLAN.md §6.1):
--   * public     tables + RPCs exposed through the Data API (PostgREST).
--   * private    helper functions, auth hooks, triggers. NOT exposed through the Data API.
--                anon/authenticated get USAGE on the schema because RLS policies call private
--                helpers and policy expressions run with the caller's privileges. Each function
--                is granted deliberately; nothing in private is executable by default.
--   * extensions pg_trgm, unaccent, vector, postgis, pgcrypto, uuid-ossp.
--                pg_cron lives in pg_catalog with its tables in the `cron` schema (Supabase norm).
--   * Every table: id uuid pk, created_at, updated_at, created_by (stamped by
--     private.set_row_metadata), RLS enabled. Financial tables add deleted_at and are never
--     hard-deleted (private.prevent_hard_delete). Money is bigint paisa.
-- =============================================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------------------------
-- Secure-by-default privileges for objects created by `postgres` from here on.
--   * Functions are not executable by PUBLIC/anon/authenticated unless granted explicitly.
--   * anon gets nothing on tables/sequences unless granted (reference data is granted later).
--   * authenticated keeps select/insert/update/delete (RLS decides) but never TRUNCATE,
--     REFERENCES, TRIGGER or MAINTAIN, which RLS does not govern.
-- ---------------------------------------------------------------------------------------------
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger, maintain on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- E.164 phone with a leading plus, e.g. +923001234567 (auth.users stores it without the plus).
create domain public.phone_e164 as text check (value ~ '^\+[1-9][0-9]{7,14}$');

-- ---------------------------------------------------------------------------------------------
-- Row metadata: keeps created_at/created_by honest and maintains updated_at.
-- API callers (auth.uid() present) cannot spoof attribution or timestamps; trusted callers
-- (migrations, seed, service role, cron) may set created_at explicitly, e.g. to backdate seed.
-- ---------------------------------------------------------------------------------------------
create or replace function private.set_row_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
      new.created_at := now();
      new.updated_at := now();
    end if;
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Financial rows are never hard-deleted: corrections are reversals or soft deletes.
-- seed_reset() is the only sanctioned exception and sets tezdukan.allow_hard_delete locally.
create or replace function private.prevent_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('tezdukan.allow_hard_delete', true), '') <> 'on' then
    raise exception 'hard_delete_not_allowed'
      using errcode = '55000',
            detail = format('%s rows are financial records; reverse or soft-delete them instead.', tg_table_name);
  end if;
  return old;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Text helpers
-- ---------------------------------------------------------------------------------------------

-- Search normalisation shared by generated search columns and search RPCs:
-- strips Arabic-script diacritics/tatweel, unifies Arabic/Urdu letter variants (yeh, kaf, heh,
-- teh marbuta), removes Latin accents, lower-cases and collapses punctuation to single spaces.
create or replace function private.search_normalize(p_text text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      lower(
        extensions.unaccent(
          'extensions.unaccent'::regdictionary,
          translate(regexp_replace(p_text, '[ً-ٰٟـ]', '', 'g'), 'يكهةۀ', 'یکہۃہ')
        )
      ),
      '[^[:alnum:]؀-ۿ]+', ' ', 'g'
    )
  )
$$;

create or replace function private.slugify(p_text text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_text)), '[^a-z0-9]+', '-', 'g'), '-'),
      ''
    ),
    'item'
  )
$$;

-- Casts text to uuid, or null when it is not a uuid (used by storage path policies).
create or replace function private.try_uuid(p_value text)
returns uuid
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_value::uuid
  end
$$;

-- Geography point from lat/lng (WGS 84). Used by generated `location` columns.
create or replace function private.make_point(p_lat numeric, p_lng numeric)
returns extensions.geography
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_lat is not null and p_lng is not null then
      extensions.st_setsrid(extensions.st_makepoint(p_lng::float8, p_lat::float8), 4326)::extensions.geography
  end
$$;

-- Business day in Pakistan.
create or replace function private.pkt_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Karachi')::date
$$;

-- Generated columns and defaults evaluate these with the inserting role's privileges.
grant execute on function private.search_normalize(text) to anon, authenticated, service_role;
grant execute on function private.slugify(text) to authenticated, service_role;
grant execute on function private.try_uuid(text) to anon, authenticated, service_role;
grant execute on function private.make_point(numeric, numeric) to anon, authenticated, service_role;
grant execute on function private.pkt_today() to anon, authenticated, service_role;
