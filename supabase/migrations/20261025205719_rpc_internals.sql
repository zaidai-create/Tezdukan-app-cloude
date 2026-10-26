-- =============================================================================================
-- Shared internals for RPCs (private schema, not exposed through the Data API).
-- Phase 1 needs: caller guard, phone normalisation, unique slugs and in-app notification
-- fan-out. Later phases add their own internals (ledger posting, stock, pricing) with their RPCs.
--
-- Error convention for every RPC: the exception MESSAGE is a stable machine-readable key the app
-- maps to translated copy (e.g. 'context_not_allowed'); DETAIL carries human-readable context.
--   42501 not authorised / not signed in      P0002 not found
--   22023 invalid parameter                   55000 wrong state for this action
--   23514 business rule violated              54000 limit reached
-- =============================================================================================

-- Returns the caller's user id or raises not_authenticated.
create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Pakistani phone input to E.164 (+923001234567). Accepts +92..., 0092..., 92..., 03..., 3...
-- with spaces/dashes. Returns null when it cannot be read as a phone number.
create or replace function private.normalize_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  with d as (select regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g') as v)
  select case
    when d.v ~ '^\+92[0-9]{10}$' then d.v
    when d.v ~ '^0092[0-9]{10}$' then '+' || substr(d.v, 3)
    when d.v ~ '^92[0-9]{10}$' then '+' || d.v
    when d.v ~ '^0[0-9]{10}$' then '+92' || substr(d.v, 2)
    when d.v ~ '^3[0-9]{9}$' then '+92' || d.v
    when d.v ~ '^\+[1-9][0-9]{7,14}$' then d.v
  end
  from d
$$;

-- Unique URL slug for a shop or organization name ("Al-Madina Store" -> al-madina-store,
-- al-madina-store-2, ...).
create or replace function private.unique_slug(p_table text, p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_taken boolean;
  v_try integer := 1;
begin
  if p_table not in ('shops', 'organizations') then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  v_base := rtrim(left(private.slugify(coalesce(p_name, '')), 48), '-');
  v_slug := v_base;
  loop
    execute format('select exists (select 1 from public.%I where slug = $1)', p_table) into v_taken using v_slug;
    exit when not v_taken;
    v_try := v_try + 1;
    if v_try <= 20 then
      v_slug := v_base || '-' || v_try;
    else
      v_slug := v_base || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
    end if;
  end loop;
  return v_slug;
end;
$$;

-- In-app notifications (Realtime pushes them to the notification centre). Titles/bodies are an
-- English fallback; data.event lets the app render translated copy.
create or replace function private.notify(
  p_user_id uuid,
  p_kind public.notification_kind,
  p_title text,
  p_body text default null,
  p_data jsonb default '{}'::jsonb,
  p_link text default null,
  p_shop_id uuid default null,
  p_org_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, kind, title, body, data, link, shop_id, org_id)
  values (p_user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_link, p_shop_id, p_org_id);
end;
$$;

create or replace function private.notify_admins(
  p_kind public.notification_kind,
  p_title text,
  p_body text default null,
  p_data jsonb default '{}'::jsonb,
  p_link text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, kind, title, body, data, link)
  select distinct ur.user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_link
    from public.user_roles ur
   where ur.role = 'admin';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Shop owners always, plus active staff holding any of p_perms.
create or replace function private.notify_shop(
  p_shop_id uuid,
  p_perms text[],
  p_kind public.notification_kind,
  p_title text,
  p_body text default null,
  p_data jsonb default '{}'::jsonb,
  p_link text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, kind, title, body, data, link, shop_id)
  select distinct ss.user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_link, p_shop_id
    from public.shop_staff ss
   where ss.shop_id = p_shop_id
     and ss.user_id is not null
     and ss.status = 'active'
     and (ss.role = 'owner' or ss.permissions && coalesce(p_perms, '{}'::text[]));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Organization owners always, plus active members holding any of p_perms (role defaults count).
create or replace function private.notify_org(
  p_org_id uuid,
  p_perms text[],
  p_kind public.notification_kind,
  p_title text,
  p_body text default null,
  p_data jsonb default '{}'::jsonb,
  p_link text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notifications (user_id, kind, title, body, data, link, org_id)
  select distinct m.user_id, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_link, p_org_id
    from public.org_members m
   where m.org_id = p_org_id
     and m.user_id is not null
     and m.status = 'active'
     and (
       m.role = 'owner'
       or m.permissions && coalesce(p_perms, '{}'::text[])
       or private.org_role_permissions(m.role) && coalesce(p_perms, '{}'::text[])
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Drops users back to the customer context when the shop/org they are working in stops being
-- usable (suspended), so the app never routes them into a context they cannot use.
create or replace function private.reset_contexts_for(p_shop_id uuid, p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_shop_id is not null then
    update public.profiles
       set active_role = 'customer', active_shop_id = null
     where active_shop_id = p_shop_id;
  end if;
  if p_org_id is not null then
    update public.profiles
       set active_role = 'customer', active_org_id = null
     where active_org_id = p_org_id;
  end if;
end;
$$;
