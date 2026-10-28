-- =============================================================================================
-- Chat: a dukan and each of its distributors share one "trade" conversation; every dukan,
-- distributor or customer has one "support" conversation with the TezDukan team.
--
-- Reads go through RLS (and Realtime, which applies the same policies). Every write is an RPC:
-- the sender's side is decided by the server, never by the client, and each message notifies
-- the other side (at most one notification a minute per conversation and person).
-- =============================================================================================

create type public.conversation_kind as enum ('trade', 'support');
create type public.chat_side as enum ('shop', 'org', 'user', 'staff', 'system');

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null,
  shop_id uuid references public.shops (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz,
  last_message_preview text check (char_length(last_message_preview) <= 140),
  last_sender_side public.chat_side,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (
    (kind = 'trade' and shop_id is not null and org_id is not null and user_id is null)
    or (kind = 'support' and num_nonnulls(shop_id, org_id, user_id) = 1)
  )
);
comment on column public.conversations.user_id is 'Support conversations opened by a person (customer) rather than a dukan or distributor.';
create unique index conversations_trade_key on public.conversations (shop_id, org_id) where kind = 'trade';
create unique index conversations_support_shop_key on public.conversations (shop_id) where kind = 'support' and shop_id is not null;
create unique index conversations_support_org_key on public.conversations (org_id) where kind = 'support' and org_id is not null;
create unique index conversations_support_user_key on public.conversations (user_id) where kind = 'support' and user_id is not null;
create index conversations_shop_id_idx on public.conversations (shop_id, last_message_at desc);
create index conversations_org_id_idx on public.conversations (org_id, last_message_at desc);
create index conversations_user_id_idx on public.conversations (user_id);
create index conversations_support_queue_idx on public.conversations (last_message_at desc) where kind = 'support';
create index conversations_created_by_idx on public.conversations (created_by);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_side public.chat_side not null,
  sender_name text,
  body text not null check (char_length(body) between 1 and 2000),
  order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.chat_messages.body is 'Text as written. System messages carry a code (e.g. support_auto_reply) the app translates.';
create index chat_messages_conversation_id_idx on public.chat_messages (conversation_id, created_at desc);
create index chat_messages_sender_id_idx on public.chat_messages (sender_id);
create index chat_messages_order_id_idx on public.chat_messages (order_id);
create index chat_messages_created_by_idx on public.chat_messages (created_by);

create table public.conversation_reads (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (conversation_id, user_id)
);
create index conversation_reads_user_id_idx on public.conversation_reads (user_id);
create index conversation_reads_created_by_idx on public.conversation_reads (created_by);

create trigger set_row_metadata before insert or update on public.conversations for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.chat_messages for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.conversation_reads for each row execute function private.set_row_metadata();

alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.conversation_reads enable row level security;
revoke insert, update, delete on public.conversations, public.chat_messages, public.conversation_reads from authenticated;

-- ---------------------------------------------------------------------------------------------
-- Who is in a conversation
-- ---------------------------------------------------------------------------------------------
create or replace function private.org_chat_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
     where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.status = 'active'
       and (
         m.permissions && array['orders.view', 'orders.manage', 'retailers.manage']
         or private.org_role_permissions(m.role) && array['orders.view', 'orders.manage', 'retailers.manage']
       )
  )
$$;

create or replace function private.my_conversation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
    from public.conversations c
   where (
       c.kind = 'trade'
       and (
         c.shop_id in (select private.shop_ids_with_permission('orders'))
         or c.org_id in (select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'retailers.manage']))
       )
     )
     or (
       c.kind = 'support'
       and (
         c.user_id = (select auth.uid())
         or c.shop_id in (select private.my_shop_ids())
         or c.org_id in (select private.my_org_ids())
         or (select private.is_platform_staff())
       )
     )
$$;
grant execute on function private.my_conversation_ids() to authenticated, service_role;

create policy conversations_select on public.conversations for select to authenticated
  using (id in (select private.my_conversation_ids()));
create policy chat_messages_select on public.chat_messages for select to authenticated
  using (conversation_id in (select private.my_conversation_ids()));
create policy conversation_reads_select on public.conversation_reads for select to authenticated
  using (user_id = (select auth.uid()));

-- The side the current user speaks for in a conversation, or null if they are not in it.
-- A person on both sides of a trade conversation (rare) speaks for the dukan unless p_prefer
-- says otherwise.
create or replace function private.conversation_side(p_conversation public.conversations, p_prefer public.chat_side default null)
returns public.chat_side
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shop boolean;
  v_org boolean;
begin
  if p_conversation.kind = 'trade' then
    v_shop := private.has_shop_permission(p_conversation.shop_id, 'orders');
    v_org := private.org_chat_member(p_conversation.org_id);
    if v_shop and v_org then
      return case when p_prefer = 'org' then 'org'::public.chat_side else 'shop'::public.chat_side end;
    end if;
    return case when v_shop then 'shop'::public.chat_side when v_org then 'org'::public.chat_side end;
  end if;

  if p_conversation.user_id = auth.uid()
     or p_conversation.shop_id in (select private.my_shop_ids())
     or p_conversation.org_id in (select private.my_org_ids()) then
    if p_prefer = 'staff' and private.is_platform_staff() then
      return 'staff'::public.chat_side;
    end if;
    return case
      when p_conversation.shop_id is not null then 'shop'::public.chat_side
      when p_conversation.org_id is not null then 'org'::public.chat_side
      else 'user'::public.chat_side
    end;
  end if;
  if private.is_platform_staff() then
    return 'staff'::public.chat_side;
  end if;
  return null;
end;
$$;

-- Notifies people with a chat message, skipping anyone who already has an unread
-- notification for this conversation from the last minute.
create or replace function private.notify_chat(
  p_user_ids uuid[],
  p_conversation_id uuid,
  p_title text,
  p_body text,
  p_link text,
  p_shop_id uuid,
  p_org_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, data, link, shop_id, org_id)
  select distinct u.id, 'chat'::public.notification_kind, p_title, p_body,
         jsonb_build_object('event', 'chat.message', 'conversation_id', p_conversation_id),
         p_link, p_shop_id, p_org_id
    from unnest(p_user_ids) as u(id)
   where u.id is not null
     and u.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and not exists (
       select 1 from public.notifications n
        where n.user_id = u.id and n.kind = 'chat' and n.read_at is null
          and n.data ->> 'conversation_id' = p_conversation_id::text
          and n.created_at > now() - interval '1 minute'
     );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- open_conversation: get or create. Trade chats need an existing relationship (an account,
-- an order, or the distributor serving the dukan's area).
-- ---------------------------------------------------------------------------------------------
create or replace function public.open_conversation(
  p_kind public.conversation_kind,
  p_shop_id uuid default null,
  p_org_id uuid default null
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
  if p_kind = 'trade' then
    if p_shop_id is null or p_org_id is null then
      raise exception 'invalid_conversation' using errcode = '22023';
    end if;
    if not (private.has_shop_permission(p_shop_id, 'orders') or private.org_chat_member(p_org_id)) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if not (
      exists (select 1 from public.retailer_accounts ra where ra.org_id = p_org_id and ra.shop_id = p_shop_id)
      or exists (select 1 from public.orders o where o.org_id = p_org_id and o.shop_id = p_shop_id)
      or (private.has_shop_permission(p_shop_id, 'orders') and p_org_id in (select private.orderable_org_ids(p_shop_id, null)))
    ) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    select c.id into v_id from public.conversations c
     where c.kind = 'trade' and c.shop_id = p_shop_id and c.org_id = p_org_id;
    if v_id is null then
      insert into public.conversations (kind, shop_id, org_id)
      values ('trade', p_shop_id, p_org_id)
      on conflict do nothing
      returning id into v_id;
      if v_id is null then
        select c.id into v_id from public.conversations c
         where c.kind = 'trade' and c.shop_id = p_shop_id and c.org_id = p_org_id;
      end if;
    end if;
    return v_id;
  end if;

  if p_shop_id is not null and p_org_id is not null then
    raise exception 'invalid_conversation' using errcode = '22023';
  end if;
  if p_shop_id is not null and p_shop_id not in (select private.my_shop_ids()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_org_id is not null and p_org_id not in (select private.my_org_ids()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select c.id into v_id from public.conversations c
   where c.kind = 'support'
     and c.shop_id is not distinct from p_shop_id
     and c.org_id is not distinct from p_org_id
     and (p_shop_id is not null or p_org_id is not null or c.user_id = v_uid);
  if v_id is null then
    insert into public.conversations (kind, shop_id, org_id, user_id)
    values ('support', p_shop_id, p_org_id, case when p_shop_id is null and p_org_id is null then v_uid end)
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select c.id into v_id from public.conversations c
       where c.kind = 'support'
         and c.shop_id is not distinct from p_shop_id
         and c.org_id is not distinct from p_org_id
         and (p_shop_id is not null or p_org_id is not null or c.user_id = v_uid);
    end if;
  end if;
  return v_id;
end;
$$;

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
  update public.conversations
     set last_message_at = v_msg.created_at, last_message_preview = v_preview,
         last_sender_side = v_side, status = 'open'
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
  else
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
    'order_id', v_msg.order_id, 'created_at', v_msg.created_at
  );
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if p_conversation_id not in (select private.my_conversation_ids()) then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  values (p_conversation_id, v_uid, now())
  on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
  update public.notifications n
     set read_at = now()
   where n.user_id = v_uid and n.kind = 'chat' and n.read_at is null
     and n.data ->> 'conversation_id' = p_conversation_id::text;
end;
$$;

-- One row of a conversation list, from the point of view of p_side.
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

-- Conversations for the active context: a dukan (p_shop_id), a distributor (p_org_id), the
-- person (neither), or the support queue (p_support_queue, platform staff only).
create or replace function public.my_conversations(
  p_shop_id uuid default null,
  p_org_id uuid default null,
  p_support_queue boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
begin
  if p_support_queue then
    if not private.is_platform_staff() then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    return coalesce((
      select jsonb_agg(private.conversation_card(c, 'staff') order by c.last_message_at desc nulls last)
        from public.conversations c
       where c.kind = 'support' and c.last_message_at is not null
    ), '[]'::jsonb);
  end if;

  if p_shop_id is not null then
    if not private.has_shop_permission(p_shop_id, 'orders') and p_shop_id not in (select private.my_shop_ids()) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    return coalesce((
      select jsonb_agg(private.conversation_card(c, 'shop') order by c.kind, c.last_message_at desc nulls last)
        from public.conversations c
       where c.shop_id = p_shop_id
         and (c.kind = 'support' or private.has_shop_permission(p_shop_id, 'orders'))
    ), '[]'::jsonb);
  end if;

  if p_org_id is not null then
    if p_org_id not in (select private.my_org_ids()) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    return coalesce((
      select jsonb_agg(private.conversation_card(c, 'org') order by c.kind, c.last_message_at desc nulls last)
        from public.conversations c
       where c.org_id = p_org_id
         and (c.kind = 'support' or private.org_chat_member(p_org_id))
    ), '[]'::jsonb);
  end if;

  return coalesce((
    select jsonb_agg(private.conversation_card(c, 'user'))
      from public.conversations c
     where c.kind = 'support' and c.user_id = v_uid
  ), '[]'::jsonb);
end;
$$;

-- One conversation with its latest messages (oldest first), or the page before p_before.
create or replace function public.conversation_detail(
  p_conversation_id uuid,
  p_before timestamptz default null,
  p_limit integer default 50,
  p_as public.chat_side default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations%rowtype;
  v_side public.chat_side;
  v_messages jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  perform private.require_user();
  select * into v_conv from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  v_side := private.conversation_side(v_conv, p_as);
  if v_side is null then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(m.row order by m.created_at), '[]'::jsonb)
    into v_messages
    from (
      select cm.created_at, jsonb_build_object(
               'id', cm.id, 'conversation_id', cm.conversation_id, 'sender_id', cm.sender_id,
               'sender_side', cm.sender_side, 'sender_name', cm.sender_name, 'body', cm.body,
               'order_id', cm.order_id,
               'order_number', (select o.order_number from public.orders o where o.id = cm.order_id),
               'created_at', cm.created_at
             ) as row
        from public.chat_messages cm
       where cm.conversation_id = v_conv.id
         and (p_before is null or cm.created_at < p_before)
       order by cm.created_at desc
       limit v_limit
    ) m;

  return jsonb_build_object(
    'conversation', private.conversation_card(v_conv, v_side),
    'messages', v_messages,
    'has_more', jsonb_array_length(v_messages) = v_limit
  );
end;
$$;

-- Unread chat messages for the badge in the active context.
create or replace function public.chat_unread_count(p_shop_id uuid default null, p_org_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((card ->> 'unread')::integer), 0)::integer
    from jsonb_array_elements(public.my_conversations(p_shop_id, p_org_id, false)) as card
$$;

revoke all on function public.open_conversation(public.conversation_kind, uuid, uuid) from public, anon;
revoke all on function public.send_chat_message(uuid, text, uuid, public.chat_side) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
revoke all on function public.my_conversations(uuid, uuid, boolean) from public, anon;
revoke all on function public.conversation_detail(uuid, timestamptz, integer, public.chat_side) from public, anon;
revoke all on function public.chat_unread_count(uuid, uuid) from public, anon;
grant execute on function public.open_conversation(public.conversation_kind, uuid, uuid) to authenticated, service_role;
grant execute on function public.send_chat_message(uuid, text, uuid, public.chat_side) to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated, service_role;
grant execute on function public.my_conversations(uuid, uuid, boolean) to authenticated, service_role;
grant execute on function public.conversation_detail(uuid, timestamptz, integer, public.chat_side) to authenticated, service_role;
grant execute on function public.chat_unread_count(uuid, uuid) to authenticated, service_role;

alter publication supabase_realtime add table public.chat_messages, public.conversations;
