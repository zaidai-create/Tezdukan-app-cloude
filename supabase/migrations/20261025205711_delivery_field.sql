-- =============================================================================================
-- Delivery and field force: vehicles, riders, trips and stops, proof of delivery, live rider
-- positions, booker beats, visits and targets.
-- =============================================================================================

create type public.vehicle_kind as enum ('bike', 'rickshaw', 'loader', 'van');
create type public.trip_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
create type public.trip_stop_status as enum ('pending', 'arrived', 'delivered', 'partially_delivered', 'failed', 'skipped');
create type public.visit_outcome as enum ('ordered', 'no_order', 'shop_closed', 'payment_collected', 'follow_up', 'onboarded');
create type public.target_metric as enum ('sales_paisa', 'orders', 'new_shops', 'collections_paisa', 'visits', 'lines');

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind public.vehicle_kind not null,
  registration_no text not null check (char_length(registration_no) between 2 and 20),
  capacity_kg numeric(8, 2) check (capacity_kg > 0),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, registration_no)
);
create index vehicles_created_by_idx on public.vehicles (created_by);

create table public.riders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null unique references public.org_members (id) on delete cascade,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  cnic_last4 text check (cnic_last4 ~ '^[0-9]{4}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index riders_org_id_idx on public.riders (org_id);
create index riders_vehicle_id_idx on public.riders (vehicle_id);
create index riders_created_by_idx on public.riders (created_by);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  trip_number text not null,
  rider_id uuid not null references public.riders (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  warehouse_id uuid,
  trip_date date not null default private.pkt_today(),
  status public.trip_status not null default 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  cash_collected_paisa bigint not null default 0 check (cash_collected_paisa >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, trip_number)
);
create index trips_rider_id_idx on public.trips (rider_id, trip_date);
create index trips_vehicle_id_idx on public.trips (vehicle_id);
create index trips_warehouse_id_idx on public.trips (warehouse_id);
create index trips_org_date_idx on public.trips (org_id, trip_date);
create index trips_created_by_idx on public.trips (created_by);

create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  sequence integer not null check (sequence > 0),
  status public.trip_stop_status not null default 'pending',
  eta timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  cash_collected_paisa bigint not null default 0 check (cash_collected_paisa >= 0),
  failure_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (trip_id, order_id)
);
create unique index trip_stops_one_open_stop_per_order on public.trip_stops (order_id) where status in ('pending', 'arrived');
create index trip_stops_org_id_idx on public.trip_stops (org_id);
create index trip_stops_shop_id_idx on public.trip_stops (shop_id);
create index trip_stops_order_id_idx on public.trip_stops (order_id);
create index trip_stops_created_by_idx on public.trip_stops (created_by);

create table public.proof_of_delivery (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  trip_stop_id uuid references public.trip_stops (id) on delete set null,
  order_id uuid not null unique references public.orders (id) on delete restrict,
  photo_path text,
  otp_verified boolean not null default false,
  received_by_name text,
  lat numeric(9, 6) check (lat between -90 and 90),
  lng numeric(9, 6) check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (private.make_point(lat, lng)) stored,
  captured_by uuid references public.profiles (id) on delete set null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index proof_of_delivery_org_id_idx on public.proof_of_delivery (org_id);
create index proof_of_delivery_shop_id_idx on public.proof_of_delivery (shop_id);
create index proof_of_delivery_trip_stop_id_idx on public.proof_of_delivery (trip_stop_id);
create index proof_of_delivery_captured_by_idx on public.proof_of_delivery (captured_by);
create index proof_of_delivery_created_by_idx on public.proof_of_delivery (created_by);

-- Latest known position per rider (history is not kept; live movement goes over Realtime
-- broadcast on the private channel `trip:<trip_id>`).
create table public.rider_locations (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null unique references public.riders (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  lat numeric(9, 6) not null check (lat between -90 and 90),
  lng numeric(9, 6) not null check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (private.make_point(lat, lng)) stored,
  heading numeric(5, 2) check (heading >= 0 and heading < 360),
  speed_mps numeric(6, 2) check (speed_mps >= 0),
  accuracy_m numeric(8, 2) check (accuracy_m >= 0),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index rider_locations_org_id_idx on public.rider_locations (org_id);
create index rider_locations_trip_id_idx on public.rider_locations (trip_id);
create index rider_locations_created_by_idx on public.rider_locations (created_by);

-- Beat plans: a booker's shop round for one ISO weekday (1 = Monday).
create table public.beats (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  booker_id uuid references public.org_members (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  weekday smallint not null check (weekday between 1 and 7),
  area_id uuid references public.service_areas (id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index beats_org_id_idx on public.beats (org_id);
create index beats_booker_id_idx on public.beats (booker_id, weekday);
create index beats_area_id_idx on public.beats (area_id);
create index beats_created_by_idx on public.beats (created_by);

create table public.beat_shops (
  id uuid primary key default gen_random_uuid(),
  beat_id uuid not null references public.beats (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  sequence integer not null default 1 check (sequence > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (beat_id, shop_id)
);
create index beat_shops_org_id_idx on public.beat_shops (org_id);
create index beat_shops_shop_id_idx on public.beat_shops (shop_id);
create index beat_shops_created_by_idx on public.beat_shops (created_by);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  booker_id uuid not null references public.org_members (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  beat_id uuid references public.beats (id) on delete set null,
  client_id uuid,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  check_in_lat numeric(9, 6) check (check_in_lat between -90 and 90),
  check_in_lng numeric(9, 6) check (check_in_lng between -180 and 180),
  check_in_location extensions.geography(point, 4326) generated always as (private.make_point(check_in_lat, check_in_lng)) stored,
  distance_m integer check (distance_m >= 0),
  outcome public.visit_outcome,
  order_id uuid references public.orders (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (booker_id, client_id),
  check (checked_out_at is null or checked_out_at >= checked_in_at)
);
comment on column public.visits.distance_m is 'Metres between the check-in GPS fix and the shop pin (set by trigger).';
create index visits_org_id_idx on public.visits (org_id, checked_in_at desc);
create index visits_shop_id_idx on public.visits (shop_id);
create index visits_beat_id_idx on public.visits (beat_id);
create index visits_order_id_idx on public.visits (order_id);
create index visits_created_by_idx on public.visits (created_by);

create table public.field_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.org_members (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  metric public.target_metric not null,
  target_value bigint not null check (target_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (member_id, period_start, metric),
  check (period_end >= period_start)
);
create index field_targets_org_id_idx on public.field_targets (org_id);
create index field_targets_created_by_idx on public.field_targets (created_by);

alter table public.orders
  add constraint orders_trip_id_fkey foreign key (trip_id) references public.trips (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Consistency triggers
-- ---------------------------------------------------------------------------------------------

-- Riders, beats, visits and targets must reference members of the same distributor.
create or replace function private.tg_member_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid;
  v_member_org uuid;
begin
  -- Separate assignments: plpgsql prepares each expression, and NEW lacks the other column.
  if tg_table_name in ('riders', 'field_targets') then
    v_member := new.member_id;
  else
    v_member := new.booker_id;
  end if;
  if v_member is null then
    return new;
  end if;
  select m.org_id into v_member_org from public.org_members m where m.id = v_member;
  if v_member_org is distinct from new.org_id then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Member belongs to another distributor.';
  end if;
  return new;
end;
$$;
create trigger member_same_org before insert or update on public.riders for each row execute function private.tg_member_same_org();
create trigger member_same_org before insert or update on public.beats for each row execute function private.tg_member_same_org();
create trigger member_same_org before insert or update on public.visits for each row execute function private.tg_member_same_org();
create trigger member_same_org before insert or update on public.field_targets for each row execute function private.tg_member_same_org();

-- beat_shops inherit org from the beat; vehicles on a trip/rider must be the same org.
create or replace function private.tg_beat_shops_inherit_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select b.org_id into v_org from public.beats b where b.id = new.beat_id;
  if v_org is null then
    raise exception 'beat_not_found' using errcode = 'P0002';
  end if;
  new.org_id := v_org;
  return new;
end;
$$;
create trigger inherit_org before insert or update of beat_id on public.beat_shops
  for each row execute function private.tg_beat_shops_inherit_org();

create or replace function private.tg_trip_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.riders r where r.id = new.rider_id and r.org_id = new.org_id) then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Rider belongs to another distributor.';
  end if;
  if new.vehicle_id is not null
     and not exists (select 1 from public.vehicles v where v.id = new.vehicle_id and v.org_id = new.org_id) then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Vehicle belongs to another distributor.';
  end if;
  return new;
end;
$$;
create trigger consistency before insert or update of org_id, rider_id, vehicle_id on public.trips
  for each row execute function private.tg_trip_consistency();

-- Stop org/shop come from the order; the order must belong to the trip's distributor.
-- Status changes that settle money (delivered/partially_delivered) only come from
-- confirm_delivery(); direct client updates may move a stop to arrived/failed/skipped/pending.
create or replace function private.tg_trip_stops_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_org uuid;
  v_order_shop uuid;
  v_trip_org uuid;
begin
  select o.org_id, o.shop_id into v_order_org, v_order_shop from public.orders o where o.id = new.order_id;
  select t.org_id into v_trip_org from public.trips t where t.id = new.trip_id;
  if v_order_org is null or v_trip_org is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_order_org <> v_trip_org then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Order belongs to another distributor.';
  end if;
  new.org_id := v_trip_org;
  new.shop_id := v_order_shop;
  return new;
end;
$$;
create trigger consistency before insert or update of trip_id, order_id on public.trip_stops
  for each row execute function private.tg_trip_stops_consistency();

create or replace function private.tg_trip_stops_client_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- RPCs run as the function owner; only direct API writes arrive as anon/authenticated.
  if current_user in ('anon', 'authenticated') then
    if (new.status is distinct from old.status
        and (new.status in ('delivered', 'partially_delivered') or old.status in ('delivered', 'partially_delivered')))
       or new.cash_collected_paisa is distinct from old.cash_collected_paisa
       or new.completed_at is distinct from old.completed_at
       or new.order_id is distinct from old.order_id
       or new.trip_id is distinct from old.trip_id then
      raise exception 'use_confirm_delivery'
        using errcode = '42501', detail = 'Delivery outcome, cash and stop assignment are set by RPCs only.';
    end if;
  end if;
  return new;
end;
$$;
create trigger client_guard before update on public.trip_stops
  for each row execute function private.tg_trip_stops_client_guard();

-- Distance between the booker's check-in and the shop pin.
create or replace function private.tg_visits_distance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.check_in_lat is null or new.check_in_lng is null then
    new.distance_m := null;
    return new;
  end if;
  select round(extensions.st_distance(s.location, private.make_point(new.check_in_lat, new.check_in_lng)))::integer
    into new.distance_m
    from public.shops s
   where s.id = new.shop_id and s.location is not null;
  return new;
end;
$$;
create trigger visits_distance before insert or update of check_in_lat, check_in_lng, shop_id on public.visits
  for each row execute function private.tg_visits_distance();

-- ---------------------------------------------------------------------------------------------
-- Row metadata + RLS
-- ---------------------------------------------------------------------------------------------
create trigger set_row_metadata before insert or update on public.vehicles for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.riders for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.trips for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.trip_stops for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.proof_of_delivery for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.rider_locations for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.beats for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.beat_shops for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.visits for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.field_targets for each row execute function private.set_row_metadata();

alter table public.vehicles enable row level security;
alter table public.riders enable row level security;
alter table public.trips enable row level security;
alter table public.trip_stops enable row level security;
alter table public.proof_of_delivery enable row level security;
alter table public.rider_locations enable row level security;
alter table public.beats enable row level security;
alter table public.beat_shops enable row level security;
alter table public.visits enable row level security;
alter table public.field_targets enable row level security;
