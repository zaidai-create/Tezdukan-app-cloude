-- Support chat: the TezDukan assistant (AI) answers first, from a list of common questions and
-- the person's own recent orders. When it cannot help, or the person asks, it offers "Should I
-- connect you with my team?"; on Yes the conversation goes to the team and every admin and
-- support member is notified. While the assistant is answering, the team is not notified of
-- each message; once the team has the conversation (or a staff member answers), it stays with
-- the team.
--
-- The assistant's replies are written by the server with the service role
-- (post_support_assistant_reply), never by the person's own session.

alter table public.conversations
  add column support_mode text not null default 'assistant'
    check (support_mode in ('assistant', 'team')),
  add column team_requested_at timestamptz;
comment on column public.conversations.support_mode is
  'Support only: assistant = the AI answers first; team = the TezDukan team has it (asked for, or a staff member answered).';
comment on column public.conversations.team_requested_at is
  'When the person (or the assistant, unable to answer) asked for the team.';
create index conversations_team_queue_idx on public.conversations (team_requested_at desc)
  where kind = 'support' and support_mode = 'team';

-- Conversations the team already answered stay with the team.
update public.conversations c
   set support_mode = 'team'
 where c.kind = 'support'
   and exists (select 1 from public.chat_messages m where m.conversation_id = c.id and m.sender_side = 'staff');

-- Reads now carry the support mode.
create or replace function private.conversation_card(p_conversation public.conversations, p_side public.chat_side)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_conversation.id,
    'kind', p_conversation.kind,
    'shop_id', p_conversation.shop_id,
    'org_id', p_conversation.org_id,
    'status', p_conversation.status,
    'support_mode', case when p_conversation.kind = 'support' then p_conversation.support_mode end,
    'team_requested_at', p_conversation.team_requested_at,
    'my_side', p_side,
    'last_message_at', p_conversation.last_message_at,
    'last_message_preview', p_conversation.last_message_preview,
    'last_sender_side', p_conversation.last_sender_side,
    'unread', (
      select count(*)::integer from public.chat_messages m
       where m.conversation_id = p_conversation.id
         and m.sender_id is distinct from (select auth.uid())
         and m.sender_side <> p_side
         and m.created_at > coalesce(
           (select r.last_read_at from public.conversation_reads r
             where r.conversation_id = p_conversation.id and r.user_id = (select auth.uid())),
           '-infinity'::timestamptz
         )
    ),
    'counterpart', case
      when p_conversation.kind = 'support' and p_side <> 'staff' then
        jsonb_build_object('name', 'TezDukan', 'image_path', null, 'phone', null, 'whatsapp', null, 'bucket', null)
      when p_side = 'shop' then (
        select jsonb_build_object('name', o.name, 'image_path', o.logo_path, 'phone', o.phone::text,
                                  'whatsapp', o.phone::text, 'bucket', 'shop-media')
          from public.organizations o where o.id = p_conversation.org_id
      )
      when p_conversation.shop_id is not null then (
        select jsonb_build_object('name', s.name, 'image_path', s.photo_path,
                                  'phone', coalesce(s.phone::text, owner.phone::text),
                                  'whatsapp', coalesce(s.whatsapp::text, s.phone::text, owner.phone::text),
                                  'bucket', 'shop-media')
          from public.shops s left join public.profiles owner on owner.id = s.owner_id
         where s.id = p_conversation.shop_id
      )
      when p_conversation.org_id is not null then (
        select jsonb_build_object('name', o.name, 'image_path', o.logo_path, 'phone', o.phone::text,
                                  'whatsapp', o.phone::text, 'bucket', 'shop-media')
          from public.organizations o where o.id = p_conversation.org_id
      )
      else (
        select jsonb_build_object('name', coalesce(nullif(p.full_name, ''), p.phone::text), 'image_path', p.avatar_path,
                                  'phone', p.phone::text, 'whatsapp', p.phone::text, 'bucket', 'shop-media')
          from public.profiles p where p.id = p_conversation.user_id
      )
    end
  )
$$;

-- Same signature: the team is notified only once it has the conversation.
create or replace function public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_order_id uuid default null,
  p_as public.chat_side default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_conv public.conversations%rowtype;
  v_side public.chat_side;
  v_body text := btrim(coalesce(p_body, ''));
  v_name text;
  v_msg public.chat_messages%rowtype;
  v_shop_name text;
  v_org_name text;
  v_preview text;
  v_recipients uuid[];
begin
  if char_length(v_body) = 0 then
    raise exception 'message_empty' using errcode = '22023';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'message_too_long' using errcode = '22023';
  end if;
  select * into v_conv from public.conversations where id = p_conversation_id for update;
  if not found then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  v_side := private.conversation_side(v_conv, p_as);
  if v_side is null then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  if not public.check_rate_limit('chat:' || v_uid::text, 30, 60) then
    raise exception 'rate_limited' using errcode = '54000';
  end if;
  if p_order_id is not null and not exists (
    select 1 from public.orders o
     where o.id = p_order_id
       and (v_conv.shop_id is null or o.shop_id = v_conv.shop_id)
       and (v_conv.org_id is null or o.org_id = v_conv.org_id)
  ) then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select s.name into v_shop_name from public.shops s where s.id = v_conv.shop_id;
  select o.name into v_org_name from public.organizations o where o.id = v_conv.org_id;
  v_name := case v_side
    when 'shop' then coalesce(v_shop_name, private.actor_name(v_uid))
    when 'org' then coalesce(v_org_name, private.actor_name(v_uid))
    when 'staff' then 'TezDukan'
    else private.actor_name(v_uid)
  end;

  insert into public.chat_messages (conversation_id, sender_id, sender_side, sender_name, body, order_id)
  values (v_conv.id, v_uid, v_side, v_name, v_body, p_order_id)
  returning * into v_msg;

  v_preview := left(regexp_replace(v_body, '\s+', ' ', 'g'), 140);
  -- A staff answer means the team has the conversation from here on.
  update public.conversations
     set last_message_at = v_msg.created_at, last_message_preview = v_preview,
         last_sender_side = v_side, status = 'open',
         support_mode = case when v_conv.kind = 'support' and v_side = 'staff' then 'team' else support_mode end
   where id = v_conv.id;

  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (v_conv.id, v_uid, v_msg.created_at)
  on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;

  -- Tell the other side.
  if v_conv.kind = 'trade' then
    if v_side = 'shop' then
      select array_agg(distinct m.user_id) into v_recipients
        from public.org_members m
       where m.org_id = v_conv.org_id and m.status = 'active' and m.user_id is not null
         and (m.permissions && array['orders.view', 'orders.manage', 'retailers.manage']
              or private.org_role_permissions(m.role) && array['orders.view', 'orders.manage', 'retailers.manage']);
      perform private.notify_chat(v_recipients, v_conv.id, v_shop_name, v_preview,
                                  '/distributor/chat/' || v_conv.id, null, v_conv.org_id);
    else
      select array_agg(distinct ss.user_id) into v_recipients
        from public.shop_staff ss
       where ss.shop_id = v_conv.shop_id and ss.status = 'active' and ss.user_id is not null
         and (ss.role = 'owner' or 'orders' = any (ss.permissions));
      perform private.notify_chat(v_recipients, v_conv.id, v_org_name, v_preview,
                                  '/dukan/chat/' || v_conv.id, v_conv.shop_id, null);
    end if;
  elsif v_side = 'staff' then
    if v_conv.shop_id is not null then
      select array_agg(distinct ss.user_id) into v_recipients
        from public.shop_staff ss
       where ss.shop_id = v_conv.shop_id and ss.status = 'active' and ss.user_id is not null;
      perform private.notify_chat(v_recipients, v_conv.id, 'TezDukan', v_preview, '/dukan/chat/' || v_conv.id, v_conv.shop_id, null);
    elsif v_conv.org_id is not null then
      select array_agg(distinct m.user_id) into v_recipients
        from public.org_members m
       where m.org_id = v_conv.org_id and m.status = 'active' and m.user_id is not null
         and m.role in ('owner', 'manager');
      perform private.notify_chat(v_recipients, v_conv.id, 'TezDukan', v_preview, '/distributor/chat/' || v_conv.id, null, v_conv.org_id);
    else
      perform private.notify_chat(array[v_conv.user_id], v_conv.id, 'TezDukan', v_preview, '/account/support', null, null);
    end if;
  elsif v_conv.support_mode = 'team' then
    -- While the assistant is answering, the team is not called for every message: only when
    -- the person asks for the team (request_support_team) or the assistant cannot answer.
    select array_agg(distinct ur.user_id) into v_recipients
      from public.user_roles ur where ur.role in ('admin', 'support');
    perform private.notify_chat(v_recipients, v_conv.id,
                                coalesce(v_shop_name, v_org_name, v_name), v_preview,
                                '/admin/support/' || v_conv.id, null, null);
    -- First words from someone new to support get an instant, honest auto-reply.
    if not exists (
      select 1 from public.chat_messages m
       where m.conversation_id = v_conv.id and m.sender_side in ('staff', 'system')
    ) then
      insert into public.chat_messages (conversation_id, sender_id, sender_side, sender_name, body)
      values (v_conv.id, null, 'system', 'TezDukan', 'support_auto_reply');
    end if;
  end if;

  return jsonb_build_object(
    'id', v_msg.id, 'conversation_id', v_msg.conversation_id, 'sender_id', v_msg.sender_id,
    'sender_side', v_msg.sender_side, 'sender_name', v_msg.sender_name, 'body', v_msg.body,
    'order_id', v_msg.order_id, 'created_at', v_msg.created_at,
    'support_mode', case when v_conv.kind = 'support' then v_conv.support_mode end
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Handing a support conversation to the team: a note in the chat (a code the app translates)
-- and a notification to every admin and support member, once.
-- ---------------------------------------------------------------------------------------------
create or replace function private.hand_support_to_team(p_conversation_id uuid, p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations%rowtype;
  v_name text;
  v_last text;
  v_recipients uuid[];
begin
  select * into v_conv from public.conversations
   where id = p_conversation_id and kind = 'support' for update;
  if v_conv.id is null then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  if v_conv.support_mode = 'team' then
    return false;
  end if;
  update public.conversations
     set support_mode = 'team', team_requested_at = now(), status = 'open',
         last_message_at = now(), last_sender_side = 'system'
   where id = v_conv.id;
  insert into public.chat_messages (conversation_id, sender_id, sender_side, sender_name, body)
  values (v_conv.id, null, 'system', 'TezDukan', p_code);

  v_name := coalesce(
    (select s.name from public.shops s where s.id = v_conv.shop_id),
    (select o.name from public.organizations o where o.id = v_conv.org_id),
    (select coalesce(nullif(p.full_name, ''), p.phone::text) from public.profiles p where p.id = v_conv.user_id),
    'Customer'
  );
  select left(regexp_replace(m.body, '\s+', ' ', 'g'), 140) into v_last
    from public.chat_messages m
   where m.conversation_id = v_conv.id and m.sender_side in ('user', 'shop', 'org')
   order by m.created_at desc
   limit 1;
  select array_agg(distinct ur.user_id) into v_recipients
    from public.user_roles ur where ur.role in ('admin', 'support');
  insert into public.notifications (user_id, kind, title, body, data, link)
  select distinct u.id, 'support'::public.notification_kind,
         format('%s wants to talk to the team', v_name),
         coalesce(v_last, 'Support chat'),
         jsonb_build_object('event', 'support.team_requested', 'conversation_id', v_conv.id,
                            'reason', p_code),
         '/admin/support/' || v_conv.id
    from unnest(coalesce(v_recipients, '{}')) as u(id)
   where u.id is not null;
  return true;
end;
$$;
revoke all on function private.hand_support_to_team(uuid, text) from public, anon, authenticated;

-- "Yes, connect me": the person in the conversation asks for the team.
create or replace function public.request_support_team(p_conversation_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations%rowtype;
  v_side public.chat_side;
begin
  perform private.require_user();
  select * into v_conv from public.conversations where id = p_conversation_id;
  if v_conv.id is null or v_conv.kind <> 'support' then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  v_side := private.conversation_side(v_conv, null);
  if v_side is null or v_side = 'staff' then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  return private.hand_support_to_team(v_conv.id, 'support_team_requested');
end;
$$;
revoke all on function public.request_support_team(uuid) from public, anon;
grant execute on function public.request_support_team(uuid) to authenticated;

-- The assistant's answer, written by the server (service role only). With p_offer_team it adds
-- the "Should I connect you with my team?" card. Skipped when the team already has the chat.
create or replace function public.post_support_assistant_reply(
  p_conversation_id uuid,
  p_body text,
  p_offer_team boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations%rowtype;
  v_body text := left(btrim(coalesce(p_body, '')), 2000);
  v_msg public.chat_messages%rowtype;
  v_preview text;
  v_link text;
  v_recipients uuid[];
begin
  if char_length(v_body) = 0 then
    raise exception 'message_empty' using errcode = '22023';
  end if;
  select * into v_conv from public.conversations
   where id = p_conversation_id and kind = 'support' for update;
  if v_conv.id is null then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  if v_conv.support_mode <> 'assistant' then
    return null;
  end if;
  insert into public.chat_messages (conversation_id, sender_id, sender_side, sender_name, body)
  values (v_conv.id, null, 'assistant', 'TezDukan Assistant', v_body)
  returning * into v_msg;
  if p_offer_team then
    insert into public.chat_messages (conversation_id, sender_id, sender_side, sender_name, body, created_at)
    values (v_conv.id, null, 'system', 'TezDukan', 'support_offer_team', v_msg.created_at + interval '1 millisecond');
  end if;
  v_preview := left(regexp_replace(v_body, '\s+', ' ', 'g'), 140);
  update public.conversations
     set last_message_at = v_msg.created_at, last_message_preview = v_preview,
         last_sender_side = 'assistant'
   where id = v_conv.id;

  -- The person may have left the chat: tell them an answer is waiting.
  if v_conv.shop_id is not null then
    select array_agg(distinct ss.user_id) into v_recipients
      from public.shop_staff ss
     where ss.shop_id = v_conv.shop_id and ss.status = 'active' and ss.user_id is not null;
    v_link := '/dukan/chat/' || v_conv.id;
  elsif v_conv.org_id is not null then
    select array_agg(distinct m.user_id) into v_recipients
      from public.org_members m
     where m.org_id = v_conv.org_id and m.status = 'active' and m.user_id is not null
       and m.role in ('owner', 'manager');
    v_link := '/distributor/chat/' || v_conv.id;
  else
    v_recipients := array[v_conv.user_id];
    v_link := '/account/support';
  end if;
  perform private.notify_chat(v_recipients, v_conv.id, 'TezDukan', v_preview, v_link,
                              v_conv.shop_id, v_conv.org_id);

  return jsonb_build_object('id', v_msg.id, 'created_at', v_msg.created_at);
end;
$$;
revoke all on function public.post_support_assistant_reply(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.post_support_assistant_reply(uuid, text, boolean) to service_role;

-- The assistant could not answer (not configured, or the AI service failed): the team takes
-- over so the person is never left without a reply. Service role only.
create or replace function public.support_assistant_unavailable(p_conversation_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return private.hand_support_to_team(p_conversation_id, 'support_assistant_unavailable');
end;
$$;
revoke all on function public.support_assistant_unavailable(uuid) from public, anon, authenticated;
grant execute on function public.support_assistant_unavailable(uuid) to service_role;

-- A short note from the assistant when it could not answer this time (the AI service was busy
-- or slow): "ask again, or tap Talk to the team". A second failure in a row hands the chat to
-- the team instead (support_assistant_unavailable). Service role only.
create or replace function public.post_support_assistant_note(p_conversation_id uuid, p_code text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations%rowtype;
begin
  if p_code is distinct from 'support_assistant_retry' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  select * into v_conv from public.conversations
   where id = p_conversation_id and kind = 'support' for update;
  if v_conv.id is null then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  if v_conv.support_mode <> 'assistant' then
    return false;
  end if;
  insert into public.chat_messages (conversation_id, sender_id, sender_side, sender_name, body)
  values (v_conv.id, null, 'system', 'TezDukan', p_code);
  return true;
end;
$$;
revoke all on function public.post_support_assistant_note(uuid, text) from public, anon, authenticated;
grant execute on function public.post_support_assistant_note(uuid, text) to service_role;
