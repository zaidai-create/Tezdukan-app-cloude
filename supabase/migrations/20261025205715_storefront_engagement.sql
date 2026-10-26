-- =============================================================================================
-- Storefront (customers ordering from a dukan) and engagement (banners, campaigns, in-app
-- notifications, web push subscriptions, TezPoints).
-- Public storefront reads go through security definer RPCs (storefront_*, nearby_shops) that
-- return safe columns only; these base tables are member-only.
-- =============================================================================================

create type public.customer_order_status as enum ('placed', 'accepted', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'rejected');
create type public.customer_payment_method as enum ('cod', 'jazzcash', 'easypaisa', 'raast', 'bank_transfer');
create type public.fulfilment_type as enum ('delivery', 'pickup');
create type public.review_target_type as enum ('shop', 'organization');
create type public.banner_placement as enum ('customer_home', 'dukan_home', 'distributor_dashboard', 'storefront');
create type public.content_owner_type as enum ('platform', 'org', 'shop');
create type public.campaign_channel as enum ('whatsapp', 'sms', 'push', 'in_app');
create type public.campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'cancelled');
create type public.notification_kind as enum ('order', 'payment', 'stock', 'khata', 'brief', 'approval', 'promotion', 'delivery', 'support', 'system');
create type public.reward_reason as enum ('order_delivered', 'on_time_payment', 'streak_bonus', 'adjustment', 'redeemed');

-- Opening hours: {"mon": [{"open": "08:00", "close": "23:00"}], "tue": [...], ...}.
-- A day with [] or no key is closed; {} means no hours set (always open). close < open spans
-- midnight.
create or replace function private.valid_timings(p_timings jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day text;
  v_slots jsonb;
  v_slot jsonb;
begin
  if p_timings is null or jsonb_typeof(p_timings) <> 'object' then
    return false;
  end if;
  for v_day, v_slots in select e.key, e.value from jsonb_each(p_timings) as e loop
    if v_day not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') or jsonb_typeof(v_slots) <> 'array' then
      return false;
    end if;
    for v_slot in select s.value from jsonb_array_elements(v_slots) as s loop
      if jsonb_typeof(v_slot) <> 'object'
         or coalesce(v_slot ->> 'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         or coalesce(v_slot ->> 'close', '') !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then
        return false;
      end if;
    end loop;
  end loop;
  return true;
end;
$$;

create or replace function private.is_open_at(p_timings jsonb, p_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone 'Asia/Karachi';
  v_days text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_today text := v_days[extract(isodow from v_local)::integer];
  v_yesterday text := v_days[((extract(isodow from v_local)::integer + 5) % 7) + 1];
  v_time time := v_local::time;
  v_slot jsonb;
  v_open time;
  v_close time;
begin
  if p_timings is null or p_timings = '{}'::jsonb then
    return true;
  end if;
  for v_slot in select s.value from jsonb_array_elements(coalesce(p_timings -> v_today, '[]'::jsonb)) as s loop
    v_open := (v_slot ->> 'open')::time;
    v_close := case when v_slot ->> 'close' = '24:00' then time '23:59:59.999999' else (v_slot ->> 'close')::time end;
    if (v_open <= v_close and v_time >= v_open and v_time < v_close)
       or (v_close < v_open and v_time >= v_open) then
      return true;
    end if;
  end loop;
  for v_slot in select s.value from jsonb_array_elements(coalesce(p_timings -> v_yesterday, '[]'::jsonb)) as s loop
    v_open := (v_slot ->> 'open')::time;
    v_close := (v_slot ->> 'close')::time;
    if v_close < v_open and v_time < v_close then
      return true;
    end if;
  end loop;
  return false;
end;
$$;
grant execute on function private.is_open_at(jsonb, timestamptz) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Storefront
-- ---------------------------------------------------------------------------------------------
create table public.storefront_settings (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null unique references public.shops (id) on delete cascade,
  is_live boolean not null default false,
  tagline text check (char_length(tagline) <= 120),
  about text,
  timings jsonb not null default '{}'::jsonb check (private.valid_timings(timings)),
  delivery_radius_m integer not null default 3000 check (delivery_radius_m between 100 and 100000),
  serves_all_city boolean not null default false,
  min_order_paisa bigint not null default 0 check (min_order_paisa >= 0),
  delivery_fee_paisa bigint not null default 0 check (delivery_fee_paisa >= 0),
  free_delivery_above_paisa bigint check (free_delivery_above_paisa >= 0),
  eta_minutes integer not null default 45 check (eta_minutes between 5 and 1440),
  payment_options public.customer_payment_method[] not null default '{cod}',
  pickup_enabled boolean not null default true,
  accept_orders_when_closed boolean not null default false,
  announcement text check (char_length(announcement) <= 280),
  gallery_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.storefront_settings.serves_all_city is 'Delivers anywhere in the shop''s city regardless of delivery_radius_m.';
create index storefront_settings_created_by_idx on public.storefront_settings (created_by);

create table public.customer_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  shop_id uuid not null references public.shops (id) on delete restrict,
  customer_id uuid references public.profiles (id) on delete set null,
  shop_name text not null,
  customer_name text,
  customer_phone public.phone_e164,
  status public.customer_order_status not null default 'placed',
  fulfilment public.fulfilment_type not null default 'delivery',
  payment_method public.customer_payment_method not null default 'cod',
  payment_status public.order_payment_status not null default 'unpaid',
  items_count integer not null default 0 check (items_count >= 0),
  subtotal_paisa bigint not null default 0 check (subtotal_paisa >= 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  delivery_fee_paisa bigint not null default 0 check (delivery_fee_paisa >= 0),
  total_paisa bigint not null default 0 check (total_paisa >= 0),
  address_id uuid references public.addresses (id) on delete set null,
  delivery_address jsonb,
  notes text check (char_length(notes) <= 500),
  accepted_at timestamptz,
  packed_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  cancelled_by uuid references public.profiles (id) on delete set null,
  rejected_reason text,
  pos_bill_id uuid references public.pos_bills (id) on delete set null,
  client_request_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (subtotal_paisa - discount_paisa + delivery_fee_paisa = total_paisa)
);
comment on column public.customer_orders.shop_name is 'Snapshot so customers can list orders without reading the shops table.';
comment on column public.customer_orders.pos_bill_id is 'Sale recorded in the shop''s POS books when the order is delivered.';
create unique index customer_orders_idempotency_key on public.customer_orders (customer_id, client_request_id) where client_request_id is not null;
create index customer_orders_shop_id_idx on public.customer_orders (shop_id, status, created_at desc);
create index customer_orders_customer_id_idx on public.customer_orders (customer_id, created_at desc);
create index customer_orders_address_id_idx on public.customer_orders (address_id);
create index customer_orders_cancelled_by_idx on public.customer_orders (cancelled_by);
create index customer_orders_pos_bill_id_idx on public.customer_orders (pos_bill_id);
create index customer_orders_created_by_idx on public.customer_orders (created_by);

create table public.customer_order_items (
  id uuid primary key default gen_random_uuid(),
  customer_order_id uuid not null references public.customer_orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  customer_id uuid references public.profiles (id) on delete set null,
  inventory_id uuid references public.shop_inventory (id) on delete set null,
  name text not null,
  name_ur text,
  image_path text,
  unit public.measure_unit not null default 'pc',
  qty numeric(12, 3) not null check (qty > 0),
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  mrp_paisa bigint check (mrp_paisa >= 0),
  line_total_paisa bigint not null check (line_total_paisa >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (line_total_paisa = round(qty * unit_price_paisa))
);
create index customer_order_items_customer_order_id_idx on public.customer_order_items (customer_order_id);
create index customer_order_items_shop_id_idx on public.customer_order_items (shop_id);
create index customer_order_items_customer_id_idx on public.customer_order_items (customer_id);
create index customer_order_items_inventory_id_idx on public.customer_order_items (inventory_id);
create index customer_order_items_created_by_idx on public.customer_order_items (created_by);

alter table public.pos_bills
  add constraint pos_bills_customer_order_id_fkey foreign key (customer_order_id) references public.customer_orders (id) on delete set null;

-- Ratings: customers rate dukans (per delivered customer order); dukandars rate distributors
-- (per delivered B2B order).
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  target_type public.review_target_type not null,
  shop_id uuid references public.shops (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewer_shop_id uuid references public.shops (id) on delete set null,
  customer_order_id uuid unique references public.customer_orders (id) on delete set null,
  order_id uuid unique references public.orders (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  is_published boolean not null default true,
  response text check (char_length(response) <= 1000),
  responded_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (
    (target_type = 'shop' and shop_id is not null and org_id is null)
    or (target_type = 'organization' and org_id is not null and shop_id is null)
  )
);
create index reviews_shop_id_idx on public.reviews (shop_id, created_at desc);
create index reviews_org_id_idx on public.reviews (org_id, created_at desc);
create index reviews_reviewer_id_idx on public.reviews (reviewer_id);
create index reviews_reviewer_shop_id_idx on public.reviews (reviewer_shop_id);
create index reviews_responded_by_idx on public.reviews (responded_by);
create index reviews_created_by_idx on public.reviews (created_by);

-- ---------------------------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------------------------
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  owner_type public.content_owner_type not null default 'platform',
  org_id uuid references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  title_ur text,
  subtitle text,
  image_path text not null,
  link text,
  placement public.banner_placement not null,
  area_ids uuid[],
  segments public.shop_tier[],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((owner_type = 'platform' and org_id is null) or (owner_type = 'org' and org_id is not null)),
  check (ends_at is null or ends_at > starts_at)
);
comment on table public.banners is 'Platform banners (admin) and distributor promotions shown to that distributor''s retailers.';
create index banners_org_id_idx on public.banners (org_id);
create index banners_placement_idx on public.banners (placement, is_active, starts_at);
create index banners_created_by_idx on public.banners (created_by);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_type public.content_owner_type not null default 'platform',
  org_id uuid references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  channel public.campaign_channel not null,
  title text,
  message text not null check (char_length(message) between 1 and 1000),
  message_ur text,
  audience jsonb not null default '{}'::jsonb check (jsonb_typeof(audience) = 'object'),
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((owner_type = 'platform' and org_id is null) or (owner_type = 'org' and org_id is not null))
);
comment on column public.campaigns.audience is 'e.g. {"segments": ["gold"], "area_ids": [...], "shop_ids": [...], "roles": ["dukandar"]}';
create index campaigns_org_id_idx on public.campaigns (org_id);
create index campaigns_created_by_idx on public.campaigns (created_by);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  link text,
  shop_id uuid references public.shops (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_shop_id_idx on public.notifications (shop_id);
create index notifications_org_id_idx on public.notifications (org_id);
create index notifications_created_by_idx on public.notifications (created_by);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index push_subscriptions_created_by_idx on public.push_subscriptions (created_by);

-- TezPoints ledger per shop. Tier (silver/gold/platinum) is derived from the last 12 months.
create table public.reward_points (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  points integer not null check (points <> 0),
  reason public.reward_reason not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create unique index reward_points_reference_key on public.reward_points (shop_id, reason, reference_type, reference_id) where reference_id is not null;
create index reward_points_shop_id_idx on public.reward_points (shop_id, created_at desc);
create index reward_points_created_by_idx on public.reward_points (created_by);

-- ---------------------------------------------------------------------------------------------
-- Row metadata, soft-delete guard, RLS
-- ---------------------------------------------------------------------------------------------
create trigger set_row_metadata before insert or update on public.storefront_settings for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.customer_orders for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.customer_order_items for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.reviews for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.banners for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.campaigns for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.notifications for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.push_subscriptions for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.reward_points for each row execute function private.set_row_metadata();

create trigger prevent_hard_delete before delete on public.customer_orders for each row execute function private.prevent_hard_delete();

alter table public.storefront_settings enable row level security;
alter table public.customer_orders enable row level security;
alter table public.customer_order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.banners enable row level security;
alter table public.campaigns enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reward_points enable row level security;
