-- =============================================================================================
-- Web Push. Every in-app notification for a person with an active push subscription also
-- queues a push message in message_outbox. The app server (service role) claims queued
-- messages and delivers them through the push adapter: the real Web Push sender when VAPID
-- keys are set, otherwise Sandbox, which marks them `sandbox` so nothing pretends to be sent.
-- =============================================================================================

create or replace function private.tg_notifications_queue_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.push_subscriptions ps where ps.user_id = new.user_id and ps.is_active) then
    insert into public.message_outbox (channel, kind, to_user_id, body, payload, dedupe_key, org_id, shop_id)
    values (
      'push',
      case new.kind
        when 'order' then 'order_update'::public.message_kind
        when 'delivery' then 'order_update'::public.message_kind
        when 'brief' then 'brief'::public.message_kind
        when 'promotion' then 'campaign'::public.message_kind
        when 'khata' then 'reminder'::public.message_kind
        else 'other'::public.message_kind
      end,
      new.user_id,
      new.title,
      jsonb_build_object(
        'notification_id', new.id, 'kind', new.kind, 'title', new.title, 'body', new.body,
        'link', new.link, 'data', new.data
      ),
      'push:' || new.id::text,
      new.org_id,
      new.shop_id
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return null;
end;
$$;

create trigger queue_push after insert on public.notifications
  for each row execute function private.tg_notifications_queue_push();

-- Saves this browser's push subscription for the signed-in person. An endpoint belongs to one
-- browser, so a device that changes hands (sign out, someone else signs in) moves with it.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_id uuid;
begin
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000 then
    raise exception 'invalid_subscription' using errcode = '22023';
  end if;
  if coalesce(char_length(p_p256dh), 0) not between 20 and 200 or coalesce(char_length(p_auth), 0) not between 8 and 100 then
    raise exception 'invalid_subscription' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, is_active, last_used_at)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), true, now())
  on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         user_agent = excluded.user_agent, is_active = true, last_used_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
   where endpoint = p_endpoint and user_id = (select auth.uid())
$$;

-- Service role: take up to p_limit queued push messages (and any stuck in `sending` for ten
-- minutes) so two senders never deliver the same message.
create or replace function public.claim_push_messages(p_limit integer default 50)
returns setof public.message_outbox
language sql
volatile
security definer
set search_path = ''
as $$
  update public.message_outbox m
     set status = 'sending', attempts = m.attempts + 1
   where m.id in (
     select q.id from public.message_outbox q
      where q.channel = 'push'
        and q.scheduled_at <= now()
        and (q.status = 'queued' or (q.status = 'sending' and q.updated_at < now() - interval '10 minutes'))
        and q.attempts < 5
      order by q.scheduled_at
      limit least(greatest(coalesce(p_limit, 50), 1), 500)
      for update skip locked
   )
  returning m.*
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
revoke all on function public.claim_push_messages(integer) from public, anon, authenticated;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated, service_role;
grant execute on function public.unregister_push_subscription(text) to authenticated, service_role;
grant execute on function public.claim_push_messages(integer) to service_role;
