-- =============================================================================================
-- Identity: profiles, platform roles, service areas, organizations (distributors), shops
-- (dukans), memberships and customer addresses. RLS policies: see the rls_policies migration.
-- =============================================================================================

create type public.app_role as enum ('customer', 'dukandar', 'distributor', 'booker', 'rider', 'admin');
create type public.platform_role as enum ('admin', 'support');
create type public.app_locale as enum ('en', 'ur', 'ur-Latn', 'sd');
create type public.theme_pref as enum ('system', 'light', 'dark');
create type public.approval_status as enum ('draft', 'pending', 'approved', 'rejected', 'suspended');
create type public.shop_member_role as enum ('owner', 'manager', 'cashier', 'staff');
create type public.org_member_role as enum ('owner', 'manager', 'accountant', 'warehouse', 'booker', 'rider');
create type public.member_status as enum ('invited', 'active', 'suspended');
create type public.shop_tier as enum ('silver', 'gold', 'platinum');
create type public.shop_kind as enum ('kirana', 'general_store', 'mini_mart', 'wholesale', 'medical', 'bakery', 'other');
create type public.area_kind as enum ('city', 'zone');

-- ---------------------------------------------------------------------------------------------
-- profiles: one per auth user, created by trigger. active_* only change via
-- switch_active_context() (column privileges in the rls_policies migration).
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone public.phone_e164 unique,
  avatar_path text,
  locale public.app_locale not null default 'en',
  theme public.theme_pref not null default 'system',
  data_saver boolean not null default false,
  tts_enabled boolean not null default false,
  active_role public.app_role not null default 'customer',
  active_shop_id uuid,
  active_org_id uuid,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  deleted_at timestamptz
);
comment on table public.profiles is 'One row per auth user. phone is E.164 with plus (auth.users.phone has no plus).';
create index profiles_created_by_idx on public.profiles (created_by);
create index profiles_full_name_trgm_idx on public.profiles using gin (full_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------------------------
-- user_roles: platform roles (admin, support).
-- ---------------------------------------------------------------------------------------------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.platform_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (user_id, role)
);
create index user_roles_granted_by_idx on public.user_roles (granted_by);
create index user_roles_created_by_idx on public.user_roles (created_by);

-- ---------------------------------------------------------------------------------------------
-- service_areas: Hyderabad (city) and its zones.
-- ---------------------------------------------------------------------------------------------
create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.service_areas (id) on delete restrict,
  kind public.area_kind not null default 'zone',
  name text not null check (char_length(name) between 2 and 80),
  name_ur text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  city text not null default 'Hyderabad',
  center_lat numeric(9, 6) check (center_lat between -90 and 90),
  center_lng numeric(9, 6) check (center_lng between -180 and 180),
  center extensions.geography(point, 4326) generated always as (private.make_point(center_lat, center_lng)) stored,
  radius_m integer check (radius_m > 0),
  boundary extensions.geography(multipolygon, 4326),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((kind = 'city') = (parent_id is null))
);
create index service_areas_parent_id_idx on public.service_areas (parent_id);
create index service_areas_created_by_idx on public.service_areas (created_by);
create index service_areas_center_gist_idx on public.service_areas using gist (center);
create index service_areas_boundary_gist_idx on public.service_areas using gist (boundary);
create index service_areas_name_trgm_idx on public.service_areas using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------------------------
-- organizations (distributors)
-- settings keys (validated): order_cutoff_time 'HH:MM', delivery_days [1..7] (ISO weekdays),
-- default_credit_limit_paisa, default_payment_terms_days, overdue_hold_days, enforce_stock,
-- daily_brief_whatsapp, invoice_footer.
-- ---------------------------------------------------------------------------------------------
create or replace function private.valid_org_settings(p_settings jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_val jsonb;
begin
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' then
    return false;
  end if;
  for v_key, v_val in select e.key, e.value from jsonb_each(p_settings) as e loop
    case v_key
      when 'order_cutoff_time' then
        if jsonb_typeof(v_val) <> 'string' or (v_val #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
          return false;
        end if;
      when 'delivery_days' then
        if jsonb_typeof(v_val) <> 'array' or exists (
          select 1 from jsonb_array_elements(v_val) as d
          where jsonb_typeof(d) <> 'number' or (d #>> '{}') not in ('1', '2', '3', '4', '5', '6', '7')
        ) then
          return false;
        end if;
      when 'default_credit_limit_paisa' then
        if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}') !~ '^[0-9]{1,15}$' then
          return false;
        end if;
      when 'default_payment_terms_days', 'overdue_hold_days' then
        if jsonb_typeof(v_val) <> 'number' or (v_val #>> '{}') !~ '^[0-9]{1,3}$' or (v_val #>> '{}')::integer > 365 then
          return false;
        end if;
      when 'enforce_stock', 'daily_brief_whatsapp' then
        if jsonb_typeof(v_val) <> 'boolean' then
          return false;
        end if;
      when 'invoice_footer' then
        if jsonb_typeof(v_val) <> 'string' then
          return false;
        end if;
      else
        return false;
    end case;
  end loop;
  return true;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  legal_name text,
  description text,
  phone public.phone_e164,
  email text check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  ntn text,
  strn text,
  address_line text,
  area_id uuid references public.service_areas (id) on delete set null,
  lat numeric(9, 6) check (lat between -90 and 90),
  lng numeric(9, 6) check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (private.make_point(lat, lng)) stored,
  served_area_ids uuid[],
  logo_path text,
  cover_path text,
  status public.approval_status not null default 'pending',
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  min_order_paisa bigint not null default 0 check (min_order_paisa >= 0),
  delivery_fee_paisa bigint not null default 0 check (delivery_fee_paisa >= 0),
  free_delivery_above_paisa bigint check (free_delivery_above_paisa >= 0),
  settings jsonb not null default '{}'::jsonb check (private.valid_org_settings(settings)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.organizations.served_area_ids is 'Service areas the distributor delivers to; null = the whole city.';
create index organizations_area_id_idx on public.organizations (area_id);
create index organizations_approved_by_idx on public.organizations (approved_by);
create index organizations_created_by_idx on public.organizations (created_by);
create index organizations_status_idx on public.organizations (status);
create index organizations_name_trgm_idx on public.organizations using gin (name extensions.gin_trgm_ops);
create index organizations_location_gist_idx on public.organizations using gist (location);
create index organizations_served_area_ids_idx on public.organizations using gin (served_area_ids);

-- ---------------------------------------------------------------------------------------------
-- org_members: distributor team. user_id is null for an invite until the invitee verifies the
-- invited phone number (see private.link_pending_memberships).
-- ---------------------------------------------------------------------------------------------
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  role public.org_member_role not null,
  permissions text[] not null default '{}' check (
    permissions <@ array[
      'orders.view', 'orders.manage', 'catalog.manage', 'pricing.manage', 'warehouse.manage',
      'retailers.manage', 'credit.manage', 'collections.manage', 'delivery.manage', 'field.manage',
      'promotions.manage', 'analytics.view', 'team.manage', 'billing.manage', 'integrations.manage',
      'settings.manage'
    ]::text[]
  ),
  status public.member_status not null default 'active',
  display_name text check (char_length(display_name) <= 120),
  phone public.phone_e164,
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, user_id),
  check (user_id is not null or phone is not null),
  check (status = 'invited' or user_id is not null)
);
create unique index org_members_org_phone_key on public.org_members (org_id, phone) where phone is not null;
create index org_members_user_id_idx on public.org_members (user_id);
create index org_members_invited_by_idx on public.org_members (invited_by);
create index org_members_created_by_idx on public.org_members (created_by);
create index org_members_phone_idx on public.org_members (phone) where user_id is null;

-- ---------------------------------------------------------------------------------------------
-- shops (dukans). owner_id stays null for shops onboarded by a distributor's booker until the
-- shopkeeper verifies the shop phone.
-- ---------------------------------------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  phone public.phone_e164,
  whatsapp public.phone_e164,
  kind public.shop_kind not null default 'kirana',
  description text,
  address_line text,
  area_id uuid references public.service_areas (id) on delete set null,
  lat numeric(9, 6) check (lat between -90 and 90),
  lng numeric(9, 6) check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (private.make_point(lat, lng)) stored,
  photo_path text,
  cover_path text,
  status public.approval_status not null default 'pending',
  tier public.shop_tier not null default 'silver',
  ntn text,
  strn text,
  onboarded_by_org_id uuid references public.organizations (id) on delete set null,
  onboarded_by_member_id uuid references public.org_members (id) on delete set null,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index shops_owner_id_idx on public.shops (owner_id);
create index shops_area_id_idx on public.shops (area_id);
create index shops_onboarded_by_org_id_idx on public.shops (onboarded_by_org_id);
create index shops_onboarded_by_member_id_idx on public.shops (onboarded_by_member_id);
create index shops_approved_by_idx on public.shops (approved_by);
create index shops_created_by_idx on public.shops (created_by);
create index shops_status_idx on public.shops (status);
create index shops_phone_idx on public.shops (phone);
create index shops_name_trgm_idx on public.shops using gin (name extensions.gin_trgm_ops);
create index shops_location_gist_idx on public.shops using gist (location);

-- ---------------------------------------------------------------------------------------------
-- shop_staff: dukan team (owner, manager, cashier, staff).
-- ---------------------------------------------------------------------------------------------
create table public.shop_staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  role public.shop_member_role not null,
  permissions text[] not null default '{}' check (
    permissions <@ array[
      'billing', 'inventory', 'khata', 'orders', 'customer_orders', 'reports', 'expenses',
      'storefront', 'staff', 'settings'
    ]::text[]
  ),
  status public.member_status not null default 'active',
  display_name text check (char_length(display_name) <= 120),
  phone public.phone_e164,
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (shop_id, user_id),
  check (user_id is not null or phone is not null),
  check (status = 'invited' or user_id is not null)
);
create unique index shop_staff_shop_phone_key on public.shop_staff (shop_id, phone) where phone is not null;
create index shop_staff_user_id_idx on public.shop_staff (user_id);
create index shop_staff_invited_by_idx on public.shop_staff (invited_by);
create index shop_staff_created_by_idx on public.shop_staff (created_by);
create index shop_staff_phone_idx on public.shop_staff (phone) where user_id is null;

-- ---------------------------------------------------------------------------------------------
-- addresses: customer delivery addresses.
-- ---------------------------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  label text not null default 'Home' check (char_length(label) between 1 and 40),
  recipient_name text,
  line1 text not null check (char_length(line1) between 3 and 200),
  line2 text,
  landmark text,
  area_id uuid references public.service_areas (id) on delete set null,
  city text not null default 'Hyderabad',
  lat numeric(9, 6) check (lat between -90 and 90),
  lng numeric(9, 6) check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (private.make_point(lat, lng)) stored,
  phone public.phone_e164,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create unique index addresses_one_default_per_user on public.addresses (user_id) where is_default;
create index addresses_user_id_idx on public.addresses (user_id);
create index addresses_area_id_idx on public.addresses (area_id);
create index addresses_created_by_idx on public.addresses (created_by);

-- profiles.active_* reference shops/organizations, which exist now.
alter table public.profiles
  add constraint profiles_active_shop_id_fkey foreign key (active_shop_id) references public.shops (id) on delete set null,
  add constraint profiles_active_org_id_fkey foreign key (active_org_id) references public.organizations (id) on delete set null;
create index profiles_active_shop_id_idx on public.profiles (active_shop_id);
create index profiles_active_org_id_idx on public.profiles (active_org_id);

-- ---------------------------------------------------------------------------------------------
-- Row metadata + RLS on every identity table (policies in the rls_policies migration).
-- ---------------------------------------------------------------------------------------------
create trigger set_row_metadata before insert or update on public.profiles for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.user_roles for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.service_areas for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.organizations for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.org_members for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.shops for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.shop_staff for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.addresses for each row execute function private.set_row_metadata();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.service_areas enable row level security;
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.shops enable row level security;
alter table public.shop_staff enable row level security;
alter table public.addresses enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Only one default address per user: setting a new default clears the previous one.
-- ---------------------------------------------------------------------------------------------
create or replace function private.addresses_single_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.addresses
     set is_default = false
   where user_id = new.user_id
     and id <> new.id
     and is_default;
  return new;
end;
$$;
create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row when (new.is_default)
  execute function private.addresses_single_default();

-- ---------------------------------------------------------------------------------------------
-- Auth integration
-- ---------------------------------------------------------------------------------------------

-- E.164 with plus from GoTrue's plus-less phone, or null if it is not a valid E.164 number.
create or replace function private.e164_from_auth_phone(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_phone, '') <> '' and ('+' || ltrim(p_phone, '+')) ~ '^\+[1-9][0-9]{7,14}$'
      then '+' || ltrim(p_phone, '+')
  end
$$;

-- Once a phone number is verified: activate invites sent to it and let the shopkeeper claim
-- shops a booker onboarded with that phone.
create or replace function private.link_pending_memberships(p_user_id uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_phone is null then
    return;
  end if;

  update public.org_members m
     set user_id = p_user_id, status = 'active', joined_at = coalesce(m.joined_at, now())
   where m.user_id is null
     and m.phone = p_phone
     and m.status = 'invited'
     and not exists (select 1 from public.org_members x where x.org_id = m.org_id and x.user_id = p_user_id);

  update public.shop_staff s
     set user_id = p_user_id, status = 'active', joined_at = coalesce(s.joined_at, now())
   where s.user_id is null
     and s.phone = p_phone
     and s.status = 'invited'
     and not exists (select 1 from public.shop_staff x where x.shop_id = s.shop_id and x.user_id = p_user_id);

  insert into public.shop_staff (shop_id, user_id, role, status, phone, joined_at)
  select sh.id, p_user_id, 'owner', 'active', p_phone, now()
    from public.shops sh
   where sh.owner_id is null
     and sh.phone = p_phone
     and sh.status <> 'rejected'
     and not exists (select 1 from public.shop_staff x where x.shop_id = sh.id and x.user_id = p_user_id);

  update public.shops
     set owner_id = p_user_id
   where owner_id is null
     and phone = p_phone
     and status <> 'rejected';
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := new.raw_user_meta_data ->> 'locale';
  v_phone text := private.e164_from_auth_phone(new.phone);
begin
  insert into public.profiles (id, full_name, phone, locale)
  values (
    new.id,
    left(coalesce(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 120),
    v_phone,
    case when v_locale in ('en', 'ur', 'ur-Latn', 'sd') then v_locale::public.app_locale else 'en'::public.app_locale end
  )
  on conflict (id) do nothing;

  if new.phone_confirmed_at is not null then
    perform private.link_pending_memberships(new.id, v_phone);
  end if;
  return new;
end;
$$;

create or replace function private.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := private.e164_from_auth_phone(new.phone);
begin
  if new.phone is distinct from old.phone then
    update public.profiles set phone = v_phone where id = new.id;
  end if;

  if new.phone_confirmed_at is not null
     and (old.phone_confirmed_at is null or new.phone is distinct from old.phone) then
    perform private.link_pending_memberships(new.id, v_phone);
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create trigger on_auth_user_updated
  after update of phone, phone_confirmed_at on auth.users
  for each row execute function private.handle_user_updated();

-- If a membership stops being usable, drop the user back to the customer context so the
-- app never routes them into a shop/org they can no longer access.
create or replace function private.reset_context_on_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'shop_staff' then
    if tg_op = 'DELETE' or new.status <> 'active' or new.user_id is distinct from old.user_id then
      update public.profiles
         set active_role = 'customer', active_shop_id = null
       where id = old.user_id
         and active_shop_id = old.shop_id;
    end if;
  else
    if tg_op = 'DELETE' or new.status <> 'active' or new.user_id is distinct from old.user_id or new.role <> old.role then
      update public.profiles
         set active_role = 'customer', active_org_id = null
       where id = old.user_id
         and active_org_id = old.org_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger reset_context_on_membership_change
  after update or delete on public.shop_staff
  for each row execute function private.reset_context_on_membership_change();
create trigger reset_context_on_membership_change
  after update or delete on public.org_members
  for each row execute function private.reset_context_on_membership_change();
