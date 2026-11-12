-- Phone alerts that arrive while the app is closed, and messages from the TezDukan team.
--
-- 1. Push now leaves the moment it is queued. Until now a queued push went out only when an app
--    action flushed the queue afterwards, so alerts written any other way (a call straight from
--    the browser, a database job, the support assistant) waited until someone next used the app:
--    phones lit up only when TezDukan was opened. Now any new push in message_outbox makes the
--    database call the app's /api/push/flush at once (pg_net, at most every 3 seconds), and a
--    pg_cron job every minute sends anything still waiting. The call carries a token the
--    database makes for itself, so no secret is copied by hand; the app checks it with
--    push_flush_token_ok(). `url` stays empty locally and is set on the hosted project.
--
-- 2. Broadcasts: an admin sends a notification (in the app and on the phone) to all customers,
--    all dukandars, all distributors, everyone, or one person by phone number. Each send is
--    kept in `broadcasts` and written to the audit log.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------------------------
-- 1. Send push at once.
-- ---------------------------------------------------------------------------------------------
create table private.push_flush (
  id boolean primary key default true check (id),
  url text check (url is null or url ~ '^https?://'),
  -- Two random UUIDs (gen_random_uuid uses the strong random source): 64 hex characters.
  token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  last_kick_at timestamptz not null default '-infinity',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table private.push_flush is
  'Where and how the database asks the app to send queued push (one row). url is null where the app is not reachable (local).';
insert into private.push_flush default values;

-- Ask the app to send queued push now. p_force skips the 3-second spacing (the minute job).
create or replace function private.kick_push_flush(p_force boolean default false)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_token text;
begin
  -- Skip, rather than wait, when another transaction is kicking right now.
  with ready as (
    select f.id from private.push_flush f
     where f.id and f.url is not null
       and (p_force or f.last_kick_at < now() - interval '3 seconds')
     for update skip locked
  )
  update private.push_flush f
     set last_kick_at = now()
    from ready
   where f.id = ready.id
  returning f.url, f.token into v_url, v_token;
  if v_url is null then
    return false;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token, 'Content-Type', 'application/json'),
    timeout_milliseconds := 10000
  );
  return true;
end;
$$;
revoke all on function private.kick_push_flush(boolean) from public, anon, authenticated;

create or replace function private.tg_message_outbox_kick_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from inserted i where i.channel = 'push') then
    perform private.kick_push_flush(false);
  end if;
  return null;
end;
$$;

-- Once per statement: a broadcast to thousands makes one call, not thousands.
create trigger kick_push_flush
  after insert on public.message_outbox
  referencing new table as inserted
  for each statement execute function private.tg_message_outbox_kick_push();

-- The safety net: every minute, if anything has waited more than 20 seconds, ask again.
create or replace function private.push_flush_sweep()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.message_outbox m
     where m.channel = 'push' and m.status = 'queued' and m.attempts < 5
       and m.scheduled_at <= now() - interval '20 seconds'
  ) then
    perform private.kick_push_flush(true);
  end if;
end;
$$;
revoke all on function private.push_flush_sweep() from public, anon, authenticated;

select cron.schedule('tezdukan-push-flush', '* * * * *', 'select private.push_flush_sweep()');

-- The app checks the token on /api/push/flush (service role only).
create or replace function public.push_flush_token_ok(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(char_length(p_token) = 64, false)
     and exists (select 1 from private.push_flush f where f.token = p_token)
$$;
revoke all on function public.push_flush_token_ok(text) from public, anon, authenticated;
grant execute on function public.push_flush_token_ok(text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Broadcasts from the TezDukan team.
-- ---------------------------------------------------------------------------------------------
create type public.broadcast_audience as enum ('customers', 'dukandars', 'distributors', 'everyone', 'one');

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  audience public.broadcast_audience not null,
  to_user_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 300),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  sent_count integer not null default 0 check (sent_count >= 0),
  push_count integer not null default 0 check (push_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on table public.broadcasts is 'Notifications the TezDukan team sent to a group (or one person). Written only by admin_broadcast.';
create index broadcasts_created_at_idx on public.broadcasts (created_at desc);
create index broadcasts_to_user_id_idx on public.broadcasts (to_user_id);
create index broadcasts_created_by_idx on public.broadcasts (created_by);

create trigger set_row_metadata before insert or update on public.broadcasts
  for each row execute function private.set_row_metadata();

alter table public.broadcasts enable row level security;
create policy broadcasts_select on public.broadcasts for select to authenticated
  using ((select private.is_platform_staff()));
grant select on public.broadcasts to authenticated;
grant all on public.broadcasts to service_role;

-- Who is in an audience. Customers: people without a dukan or distributor account; dukandars:
-- active members of a dukan; distributors: active members of a distributor.
create or replace function private.broadcast_recipients(p_audience public.broadcast_audience)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
    from public.profiles p
   where p.deleted_at is null
     and case p_audience
       when 'everyone' then true
       when 'dukandars' then exists (
         select 1 from public.shop_staff ss where ss.user_id = p.id and ss.status = 'active')
       when 'distributors' then exists (
         select 1 from public.org_members m where m.user_id = p.id and m.status = 'active')
       when 'customers' then not exists (
         select 1 from public.shop_staff ss where ss.user_id = p.id and ss.status = 'active')
         and not exists (
         select 1 from public.org_members m where m.user_id = p.id and m.status = 'active')
       else false
     end
$$;
revoke all on function private.broadcast_recipients(public.broadcast_audience) from public, anon, authenticated;

-- How many people an audience reaches, and how many of them get phone alerts.
create or replace function public.admin_broadcast_reach(p_audience public.broadcast_audience)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return (
    select jsonb_build_object(
      'people', count(*),
      'with_push', count(*) filter (where exists (
        select 1 from public.push_subscriptions ps where ps.user_id = r.user_id and ps.is_active))
    )
    from private.broadcast_recipients(p_audience) r
  );
end;
$$;
revoke all on function public.admin_broadcast_reach(public.broadcast_audience) from public, anon;
grant execute on function public.admin_broadcast_reach(public.broadcast_audience) to authenticated;

-- Send it. One notification per person (and a push where they allowed alerts).
create or replace function public.admin_broadcast(
  p_audience public.broadcast_audience,
  p_title text,
  p_body text,
  p_link text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_to uuid;
  v_broadcast public.broadcasts%rowtype;
  v_sent integer;
  v_push integer;
begin
  perform private.require_admin();
  if char_length(v_title) not between 1 and 80 or char_length(v_body) not between 1 and 300 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if v_link is not null and v_link !~ '^/[A-Za-z0-9/_?=&.-]*$' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_audience = 'one' then
    select p.id into v_to from public.profiles p
     where p.phone::text = btrim(coalesce(p_phone, '')) and p.deleted_at is null;
    if v_to is null then
      raise exception 'person_not_found' using errcode = 'P0002';
    end if;
  elsif not public.check_rate_limit('broadcast:' || v_uid::text, 5, 3600) then
    -- A group message reaches many phones: at most five an hour per admin.
    raise exception 'rate_limited' using errcode = '54000';
  end if;

  insert into public.broadcasts (audience, to_user_id, title, body, link)
  values (p_audience, v_to, v_title, v_body, v_link)
  returning * into v_broadcast;

  insert into public.notifications (user_id, kind, title, body, data, link)
  select r.user_id, 'promotion'::public.notification_kind, v_title, v_body,
         jsonb_build_object('event', 'broadcast', 'broadcast_id', v_broadcast.id),
         v_link
    from (
      select v_to as user_id where p_audience = 'one'
      union all
      select b.user_id from private.broadcast_recipients(p_audience) b where p_audience <> 'one'
    ) r;
  get diagnostics v_sent = row_count;

  select count(*) into v_push
    from public.message_outbox m
   where m.channel = 'push'
     and m.payload ->> 'data' is not null
     and m.payload -> 'data' ->> 'broadcast_id' = v_broadcast.id::text;

  update public.broadcasts set sent_count = v_sent, push_count = v_push where id = v_broadcast.id;
  perform private.audit(
    'broadcast.sent', 'broadcast', v_broadcast.id, null, null, null,
    jsonb_build_object('audience', p_audience, 'title', v_title, 'sent', v_sent, 'push', v_push)
  );
  return jsonb_build_object('id', v_broadcast.id, 'sent', v_sent, 'push', v_push);
end;
$$;
revoke all on function public.admin_broadcast(public.broadcast_audience, text, text, text, text) from public, anon;
grant execute on function public.admin_broadcast(public.broadcast_audience, text, text, text, text) to authenticated;
