-- =============================================================================================
-- AI and audit (Munshi conversations/actions, embeddings, audit log, feature flags) and the
-- platform layer (message outbox + Send SMS hook, API keys, webhooks, integrations, support,
-- policy content, data deletion requests, product analytics, counters, rate limits, seed
-- registry).
-- =============================================================================================

create type public.ai_message_role as enum ('system', 'user', 'assistant', 'tool');
create type public.ai_action_status as enum ('proposed', 'confirmed', 'executed', 'cancelled', 'failed', 'undone');
create type public.message_channel as enum ('sms', 'whatsapp', 'push');
create type public.message_kind as enum ('otp', 'reminder', 'order_update', 'brief', 'campaign', 'receipt', 'other');
create type public.message_status as enum ('queued', 'sending', 'sent', 'failed', 'sandbox', 'cancelled');
create type public.webhook_delivery_status as enum ('pending', 'succeeded', 'failed');
create type public.integration_kind as enum (
  'sms', 'whatsapp', 'jazzcash', 'easypaisa', 'bank_transfer', 'web_push', 'maps', 'printing', 'fbr_pos', 'ai', 'analytics', 'erp'
);
create type public.integration_status as enum ('connected', 'sandbox', 'error', 'disabled');
create type public.ticket_kind as enum ('dispute', 'refund', 'support', 'feedback');
create type public.ticket_status as enum ('open', 'pending', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'normal', 'high', 'urgent');
create type public.deletion_request_status as enum ('requested', 'in_review', 'completed', 'rejected');

-- ---------------------------------------------------------------------------------------------
-- Munshi
-- ---------------------------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  role public.app_role not null,
  title text,
  locale public.app_locale not null default 'en',
  channel text not null default 'text' check (channel in ('text', 'voice')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index ai_conversations_user_id_idx on public.ai_conversations (user_id, created_at desc);
create index ai_conversations_shop_id_idx on public.ai_conversations (shop_id);
create index ai_conversations_org_id_idx on public.ai_conversations (org_id);
create index ai_conversations_created_by_idx on public.ai_conversations (created_by);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role public.ai_message_role not null,
  content text,
  content_json jsonb,
  model text,
  tokens_in integer check (tokens_in >= 0),
  tokens_out integer check (tokens_out >= 0),
  latency_ms integer check (latency_ms >= 0),
  cost_micro_usd bigint check (cost_micro_usd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index ai_messages_conversation_id_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_user_id_idx on public.ai_messages (user_id, created_at desc);
create index ai_messages_created_by_idx on public.ai_messages (created_by);

create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  message_id uuid references public.ai_messages (id) on delete set null,
  shop_id uuid references public.shops (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  role public.app_role not null,
  transcript text,
  tool text not null check (char_length(tool) between 1 and 80),
  args jsonb not null default '{}'::jsonb,
  result jsonb,
  status public.ai_action_status not null default 'proposed',
  error text,
  model text,
  latency_ms integer check (latency_ms >= 0),
  cost_micro_usd bigint check (cost_micro_usd >= 0),
  confirmed_at timestamptz,
  executed_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index ai_actions_user_id_idx on public.ai_actions (user_id, created_at desc);
create index ai_actions_conversation_id_idx on public.ai_actions (conversation_id);
create index ai_actions_message_id_idx on public.ai_actions (message_id);
create index ai_actions_shop_id_idx on public.ai_actions (shop_id);
create index ai_actions_org_id_idx on public.ai_actions (org_id);
create index ai_actions_tool_idx on public.ai_actions (tool, created_at desc);
create index ai_actions_created_by_idx on public.ai_actions (created_by);

-- 1024 dimensions fits voyage-3.x (default) and Gemini embeddings with outputDimensionality=1024.
create table public.product_embeddings (
  id uuid primary key default gen_random_uuid(),
  master_product_id uuid references public.master_products (id) on delete cascade,
  distributor_product_id uuid references public.distributor_products (id) on delete cascade,
  model text not null,
  content text not null,
  embedding extensions.vector(1024) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (num_nonnulls(master_product_id, distributor_product_id) = 1)
);
create unique index product_embeddings_master_model_key on public.product_embeddings (master_product_id, model) where master_product_id is not null;
create unique index product_embeddings_distributor_model_key on public.product_embeddings (distributor_product_id, model) where distributor_product_id is not null;
create index product_embeddings_master_product_id_idx on public.product_embeddings (master_product_id);
create index product_embeddings_distributor_product_id_idx on public.product_embeddings (distributor_product_id);
create index product_embeddings_created_by_idx on public.product_embeddings (created_by);
create index product_embeddings_hnsw_idx on public.product_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------------------------
-- Audit log. actor/org/shop ids are deliberately not foreign keys: the trail must outlive the
-- rows it describes and must never block a delete.
-- ---------------------------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null check (char_length(action) between 3 and 120),
  entity_type text not null,
  entity_id uuid,
  org_id uuid,
  shop_id uuid,
  before jsonb,
  after jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_org_id_idx on public.audit_logs (org_id, created_at desc);
create index audit_logs_shop_id_idx on public.audit_logs (shop_id, created_at desc);
create index audit_logs_created_by_idx on public.audit_logs (created_by);

create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  description text,
  enabled boolean not null default false,
  rules jsonb not null default '{}'::jsonb check (jsonb_typeof(rules) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.feature_flags.rules is 'Optional rollout rules, e.g. {"roles": ["admin"], "percentage": 10}. Never put personal data here (readable by everyone).';
create index feature_flags_created_by_idx on public.feature_flags (created_by);

-- ---------------------------------------------------------------------------------------------
-- Messaging outbox (SMS / WhatsApp / push). Adapters pick up `queued` rows; Sandbox marks them
-- `sandbox`. to_user_id is not a foreign key: the Send SMS hook may run before the new user's
-- profile is visible to other transactions.
-- ---------------------------------------------------------------------------------------------
create table public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  channel public.message_channel not null,
  kind public.message_kind not null,
  to_phone public.phone_e164,
  to_user_id uuid,
  template text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  status public.message_status not null default 'queued',
  provider text,
  provider_message_id text,
  error text,
  attempts integer not null default 0 check (attempts >= 0),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  dedupe_key text,
  org_id uuid references public.organizations (id) on delete set null,
  shop_id uuid references public.shops (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (to_phone is not null or to_user_id is not null)
);
comment on column public.message_outbox.dedupe_key is 'Makes scheduled messages idempotent, e.g. reminder:2026-10-25:<account id>.';
create unique index message_outbox_dedupe_key on public.message_outbox (dedupe_key) where dedupe_key is not null;
create index message_outbox_queue_idx on public.message_outbox (status, scheduled_at) where status in ('queued', 'sending');
create index message_outbox_to_user_id_idx on public.message_outbox (to_user_id, created_at desc);
create index message_outbox_to_phone_idx on public.message_outbox (to_phone, created_at desc);
create index message_outbox_org_id_idx on public.message_outbox (org_id);
create index message_outbox_shop_id_idx on public.message_outbox (shop_id);
create index message_outbox_created_by_idx on public.message_outbox (created_by);

-- ---------------------------------------------------------------------------------------------
-- Public API keys and webhooks (per distributor)
-- ---------------------------------------------------------------------------------------------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null check (char_length(prefix) between 4 and 16),
  key_hash text not null unique,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.api_keys.key_hash is 'Hash of the full key (peppered, computed server-side). The key itself is shown once.';
create index api_keys_org_id_idx on public.api_keys (org_id);
create index api_keys_created_by_idx on public.api_keys (created_by);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null check (url ~ '^https://'),
  description text,
  secret text not null check (char_length(secret) >= 16),
  events text[] not null check (
    cardinality(events) > 0
    and events <@ array['order.created', 'order.status_changed', 'payment.received', 'stock.updated']::text[]
  ),
  is_active boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_delivery_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index webhook_endpoints_org_id_idx on public.webhook_endpoints (org_id);
create index webhook_endpoints_created_by_idx on public.webhook_endpoints (created_by);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints (id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status public.webhook_delivery_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  response_status integer,
  response_body text,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index webhook_deliveries_org_id_idx on public.webhook_deliveries (org_id, created_at desc);
create index webhook_deliveries_endpoint_id_idx on public.webhook_deliveries (endpoint_id);
create index webhook_deliveries_pending_idx on public.webhook_deliveries (next_attempt_at) where status = 'pending';
create index webhook_deliveries_created_by_idx on public.webhook_deliveries (created_by);

create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  owner_type public.content_owner_type not null,
  org_id uuid references public.organizations (id) on delete cascade,
  shop_id uuid references public.shops (id) on delete cascade,
  kind public.integration_kind not null,
  status public.integration_status not null default 'sandbox',
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  last_tested_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique nulls not distinct (owner_type, org_id, shop_id, kind),
  check (
    (owner_type = 'platform' and org_id is null and shop_id is null)
    or (owner_type = 'org' and org_id is not null and shop_id is null)
    or (owner_type = 'shop' and shop_id is not null and org_id is null)
  )
);
comment on column public.integration_settings.config is 'Non-secret settings only. Secrets live in env vars / Vault.';
create index integration_settings_org_id_idx on public.integration_settings (org_id);
create index integration_settings_shop_id_idx on public.integration_settings (shop_id);
create index integration_settings_created_by_idx on public.integration_settings (created_by);

-- ---------------------------------------------------------------------------------------------
-- Support, disputes and refunds
-- ---------------------------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  kind public.ticket_kind not null default 'support',
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'normal',
  subject text not null check (char_length(subject) between 3 and 160),
  opened_by uuid default auth.uid() references public.profiles (id) on delete set null,
  shop_id uuid references public.shops (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  customer_order_id uuid references public.customer_orders (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index support_tickets_status_idx on public.support_tickets (status, created_at desc);
create index support_tickets_opened_by_idx on public.support_tickets (opened_by);
create index support_tickets_shop_id_idx on public.support_tickets (shop_id);
create index support_tickets_org_id_idx on public.support_tickets (org_id);
create index support_tickets_order_id_idx on public.support_tickets (order_id);
create index support_tickets_customer_order_id_idx on public.support_tickets (customer_order_id);
create index support_tickets_assigned_to_idx on public.support_tickets (assigned_to);
create index support_tickets_created_by_idx on public.support_tickets (created_by);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  attachments text[] not null default '{}',
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index support_messages_ticket_id_idx on public.support_messages (ticket_id, created_at);
create index support_messages_author_id_idx on public.support_messages (author_id);
create index support_messages_created_by_idx on public.support_messages (created_by);

-- Policy pages per locale (privacy, terms, refund-policy, delivery-policy, data-deletion).
create table public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug in ('privacy', 'terms', 'refund-policy', 'delivery-policy', 'data-deletion')),
  locale public.app_locale not null,
  title text not null,
  body_md text not null default '',
  version integer not null default 1 check (version > 0),
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (slug, locale)
);
create index content_pages_created_by_idx on public.content_pages (created_by);

create table public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  phone public.phone_e164,
  full_name text,
  reason text check (char_length(reason) <= 1000),
  status public.deletion_request_status not null default 'requested',
  handled_by uuid references public.profiles (id) on delete set null,
  handled_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (user_id is not null or phone is not null)
);
create index data_deletion_requests_status_idx on public.data_deletion_requests (status, created_at);
create index data_deletion_requests_user_id_idx on public.data_deletion_requests (user_id);
create index data_deletion_requests_handled_by_idx on public.data_deletion_requests (handled_by);
create index data_deletion_requests_created_by_idx on public.data_deletion_requests (created_by);

-- Product analytics events (PostHog optional).
create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references public.profiles (id) on delete set null,
  anonymous_id text,
  session_id text,
  name text not null check (name ~ '^[a-z][a-z0-9_.]{1,79}$'),
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  path text,
  shop_id uuid references public.shops (id) on delete set null,
  org_id uuid references public.organizations (id) on delete set null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index events_name_idx on public.events (name, occurred_at desc);
create index events_user_id_idx on public.events (user_id, occurred_at desc);
create index events_shop_id_idx on public.events (shop_id);
create index events_org_id_idx on public.events (org_id);
create index events_created_by_idx on public.events (created_by);

-- ---------------------------------------------------------------------------------------------
-- Utilities: counters (human-readable numbers), rate limits, seed registry
-- ---------------------------------------------------------------------------------------------
create table public.counters (
  id uuid primary key default gen_random_uuid(),
  scope text not null unique check (char_length(scope) between 1 and 200),
  value bigint not null default 0 check (value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index counters_created_by_idx on public.counters (created_by);

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null check (char_length(key) between 1 and 300),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (key, window_start)
);
create index rate_limits_window_start_idx on public.rate_limits (window_start);
create index rate_limits_created_by_idx on public.rate_limits (created_by);

create table public.seed_registry (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  table_name text not null check (table_name ~ '^[a-z_]+\.[a-z_]+$'),
  row_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (table_name, row_id)
);
comment on table public.seed_registry is 'Every row inserted by the seed files. seed_reset() deletes exactly these rows.';
create index seed_registry_created_by_idx on public.seed_registry (created_by);

-- ---------------------------------------------------------------------------------------------
-- Row metadata + RLS
-- ---------------------------------------------------------------------------------------------
create trigger set_row_metadata before insert or update on public.ai_conversations for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.ai_messages for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.ai_actions for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.product_embeddings for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.audit_logs for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.feature_flags for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.message_outbox for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.api_keys for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.webhook_endpoints for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.webhook_deliveries for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.integration_settings for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.support_tickets for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.support_messages for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.content_pages for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.data_deletion_requests for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.events for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.counters for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.rate_limits for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.seed_registry for each row execute function private.set_row_metadata();

create trigger append_only before update on public.audit_logs for each row execute function private.prevent_update();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_actions enable row level security;
alter table public.product_embeddings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.feature_flags enable row level security;
alter table public.message_outbox enable row level security;
alter table public.api_keys enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.integration_settings enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.content_pages enable row level security;
alter table public.data_deletion_requests enable row level security;
alter table public.events enable row level security;
alter table public.counters enable row level security;
alter table public.rate_limits enable row level security;
alter table public.seed_registry enable row level security;

-- =============================================================================================
-- Functions
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- Supabase Auth "Send SMS" hook (config.toml [auth.hook.send_sms]). Queues the OTP in
-- message_outbox for the SMS adapter (Sandbox shows it on screen until a provider is set up).
-- GoTrue sends {"user": {...}, "sms": {"otp": "123456", "phone": "923001234567"}, "metadata":
-- {...}}; sms.phone is the destination (it is the new number for a phone change).
-- Returns {} on success or the documented error shape.
-- ---------------------------------------------------------------------------------------------
create or replace function private.hook_send_sms(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user jsonb := event -> 'user';
  v_sms jsonb := event -> 'sms';
  v_otp text := v_sms ->> 'otp';
  v_phone text;
begin
  v_phone := private.e164_from_auth_phone(coalesce(nullif(v_sms ->> 'phone', ''), v_user ->> 'phone'));
  if coalesce(v_otp, '') = '' or v_phone is null then
    return jsonb_build_object(
      'error', jsonb_build_object('http_code', 500, 'message', 'Could not queue the SMS: missing code or phone number.')
    );
  end if;

  insert into public.message_outbox (channel, kind, to_phone, to_user_id, template, body, payload, status)
  values (
    'sms',
    'otp',
    v_phone,
    private.try_uuid(v_user ->> 'id'),
    'auth_otp',
    format('TezDukan code: %s. Do not share this code with anyone.', v_otp),
    jsonb_build_object('otp', v_otp),
    'queued'
  );
  return '{}'::jsonb;
exception
  when others then
    return jsonb_build_object('error', jsonb_build_object('http_code', 500, 'message', 'Could not queue the SMS: ' || sqlerrm));
end;
$$;

grant usage on schema private to supabase_auth_admin;
revoke execute on function private.hook_send_sms(jsonb) from public, anon, authenticated;
grant execute on function private.hook_send_sms(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------------------------
-- Counters
-- ---------------------------------------------------------------------------------------------
create or replace function private.next_counter(p_scope text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.counters as c (scope, value)
  values (p_scope, 1)
  on conflict (scope) do update set value = c.value + 1
  returning c.value
$$;

-- next_counter(scope): atomically increments and returns the counter for `scope`.
-- Service role only; RPCs number their documents internally.
create or replace function public.next_counter(p_scope text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_scope is null or char_length(p_scope) not between 1 and 200 then
    raise exception 'invalid_scope' using errcode = '22023';
  end if;
  return private.next_counter(p_scope);
end;
$$;
revoke execute on function public.next_counter(text) from public, anon, authenticated;
grant execute on function public.next_counter(text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- check_rate_limit(key, max, window_s) -> true when the call is allowed.
-- Fixed window. Signed-in callers are confined to their own key namespace ("u:<uid>:<key>") so
-- they cannot exhaust anyone else's limit; the service role uses keys as given (e.g. per IP).
-- ---------------------------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_s integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_window timestamptz;
  v_count integer;
begin
  if p_key is null or char_length(p_key) not between 1 and 200 then
    raise exception 'invalid_key' using errcode = '22023';
  end if;
  if p_max is null or p_max < 1 or p_window_s is null or p_window_s < 1 or p_window_s > 604800 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    v_key := 'u:' || auth.uid()::text || ':' || p_key;
  else
    v_key := p_key;
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  insert into public.rate_limits as r (key, window_start, count)
  values (v_key, v_window, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_max;
end;
$$;
revoke execute on function public.check_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------------------------
create or replace function private.audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_org_id uuid default null,
  p_shop_id uuid default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, org_id, shop_id, before, after, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_org_id, p_shop_id, p_before, p_after, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Row-change audit for sensitive configuration tables (roles, memberships, credit terms,
-- prices, flags, integrations, policy content). Secrets are stripped.
create or replace function private.tg_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_row jsonb;
begin
  if tg_op <> 'INSERT' then
    v_before := to_jsonb(old) - 'secret' - 'key_hash' - 'updated_at' - 'search_text';
  end if;
  if tg_op <> 'DELETE' then
    v_after := to_jsonb(new) - 'secret' - 'key_hash' - 'updated_at' - 'search_text';
  end if;
  if tg_op = 'UPDATE' and v_before = v_after then
    return null;
  end if;
  v_row := coalesce(v_after, v_before);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, org_id, shop_id, before, after)
  values (
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    private.try_uuid(v_row ->> 'id'),
    private.try_uuid(v_row ->> 'org_id'),
    private.try_uuid(v_row ->> 'shop_id'),
    v_before,
    v_after
  );
  return null;
end;
$$;

create trigger audit_change after insert or update or delete on public.user_roles
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.org_members
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.shop_staff
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.retailer_accounts
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.price_tiers
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.price_tier_items
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.schemes
  for each row execute function private.tg_audit_change();
create trigger audit_change after update on public.distributor_products
  for each row when (old.trade_price_paisa is distinct from new.trade_price_paisa or old.mrp_paisa is distinct from new.mrp_paisa)
  execute function private.tg_audit_change();
create trigger audit_change after update on public.shop_inventory
  for each row when (old.selling_price_paisa is distinct from new.selling_price_paisa or old.cost_price_paisa is distinct from new.cost_price_paisa)
  execute function private.tg_audit_change();
create trigger audit_change after update on public.shop_customers
  for each row when (old.credit_limit_paisa is distinct from new.credit_limit_paisa or old.deleted_at is distinct from new.deleted_at)
  execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.feature_flags
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.plans
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.integration_settings
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.api_keys
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.webhook_endpoints
  for each row execute function private.tg_audit_change();
create trigger audit_change after insert or update or delete on public.content_pages
  for each row execute function private.tg_audit_change();

-- ---------------------------------------------------------------------------------------------
-- Outbound messages and webhooks
-- ---------------------------------------------------------------------------------------------
create or replace function private.enqueue_message(
  p_channel public.message_channel,
  p_kind public.message_kind,
  p_to_phone text,
  p_to_user_id uuid,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_template text default null,
  p_dedupe_key text default null,
  p_scheduled_at timestamptz default null,
  p_org_id uuid default null,
  p_shop_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_to_phone is null and p_to_user_id is null then
    return null;
  end if;
  insert into public.message_outbox (channel, kind, to_phone, to_user_id, template, body, payload, dedupe_key, scheduled_at, org_id, shop_id)
  values (p_channel, p_kind, p_to_phone, p_to_user_id, p_template, p_body, coalesce(p_payload, '{}'::jsonb), p_dedupe_key,
          coalesce(p_scheduled_at, now()), p_org_id, p_shop_id)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.enqueue_webhook(p_org_id uuid, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.webhook_deliveries (org_id, endpoint_id, event, payload, status, next_attempt_at)
  select p_org_id, e.id, p_event,
         jsonb_build_object('id', gen_random_uuid(), 'event', p_event, 'created_at', now(), 'data', p_payload),
         'pending', now()
    from public.webhook_endpoints e
   where e.org_id = p_org_id
     and e.is_active
     and p_event = any (e.events);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- seed_reset(): deletes exactly the rows listed in seed_registry, newest first. Consecutive
-- rows of the same table are deleted in one statement. Fails (and changes nothing) if real data
-- still references a seeded row. Service role / postgres only.
-- ---------------------------------------------------------------------------------------------
create or replace function private.seed_reset()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_count integer;
  v_result jsonb := '{}'::jsonb;
begin
  perform set_config('tezdukan.allow_hard_delete', 'on', true);
  for r in
    with numbered as (
      select sr.table_name, sr.row_id, sr.seq, row_number() over (order by sr.seq) as overall_rank
        from public.seed_registry sr
    ),
    runs as (
      select n.table_name, n.row_id, n.seq,
             n.overall_rank - row_number() over (partition by n.table_name order by n.seq) as run_id
        from numbered n
    )
    select runs.table_name, array_agg(runs.row_id) as ids
      from runs
     group by runs.table_name, runs.run_id
     order by max(runs.seq) desc
  loop
    execute format('delete from %s where id = any ($1)', r.table_name::regclass) using r.ids;
    get diagnostics v_count = row_count;
    v_result := jsonb_set(v_result, array[r.table_name], to_jsonb(coalesce((v_result ->> r.table_name)::integer, 0) + v_count));
  end loop;
  delete from public.seed_registry;
  perform set_config('tezdukan.allow_hard_delete', 'off', true);
  return v_result;
end;
$$;

create or replace function public.seed_reset()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.seed_reset()
$$;
revoke execute on function public.seed_reset() from public, anon, authenticated;
grant execute on function public.seed_reset() to service_role;
