-- =============================================================================================
-- Warehouse: distributor warehouses, suppliers (principal companies), stock receipts, batches
-- with expiry (FEFO), an append-only movement ledger and inter-warehouse transfers.
-- Stock tables are written only by RPCs.
-- =============================================================================================

create type public.stock_movement_type as enum (
  'stock_in', 'transfer_in', 'transfer_out', 'reserve', 'release', 'dispatch', 'return_in',
  'adjust_damage', 'adjust_expiry', 'adjust_count'
);
create type public.stock_transfer_status as enum ('draft', 'in_transit', 'received', 'cancelled');

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9-]{0,15}$'),
  address_line text,
  area_id uuid references public.service_areas (id) on delete set null,
  lat numeric(9, 6) check (lat between -90 and 90),
  lng numeric(9, 6) check (lng between -180 and 180),
  location extensions.geography(point, 4326) generated always as (private.make_point(lat, lng)) stored,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, code)
);
create unique index warehouses_one_default_per_org on public.warehouses (org_id) where is_default;
create index warehouses_area_id_idx on public.warehouses (area_id);
create index warehouses_created_by_idx on public.warehouses (created_by);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  contact_name text,
  phone public.phone_e164,
  email text,
  address_line text,
  ntn text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, name)
);
create index suppliers_created_by_idx on public.suppliers (created_by);
create index suppliers_name_trgm_idx on public.suppliers using gin (name extensions.gin_trgm_ops);

create table public.stock_receipts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  supplier_id uuid references public.suppliers (id) on delete set null,
  receipt_number text not null,
  reference_no text,
  received_at timestamptz not null default now(),
  total_cost_paisa bigint not null default 0 check (total_cost_paisa >= 0),
  notes text,
  received_by uuid references public.profiles (id) on delete set null,
  client_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, receipt_number),
  unique (org_id, client_id)
);
comment on column public.stock_receipts.reference_no is 'Supplier invoice / bilty number.';
create index stock_receipts_warehouse_id_idx on public.stock_receipts (warehouse_id);
create index stock_receipts_supplier_id_idx on public.stock_receipts (supplier_id);
create index stock_receipts_received_by_idx on public.stock_receipts (received_by);
create index stock_receipts_created_by_idx on public.stock_receipts (created_by);

create table public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  distributor_product_id uuid not null references public.distributor_products (id) on delete restrict,
  receipt_id uuid references public.stock_receipts (id) on delete set null,
  batch_no text,
  expiry_date date,
  qty_on_hand integer not null default 0 check (qty_on_hand >= 0),
  qty_reserved integer not null default 0 check (qty_reserved >= 0),
  unit_cost_paisa bigint not null default 0 check (unit_cost_paisa >= 0),
  bin_location text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (qty_reserved <= qty_on_hand)
);
comment on table public.stock_batches is 'Quantities are pieces. FEFO: earliest expiry first, then oldest receipt.';
create index stock_batches_fefo_idx on public.stock_batches (org_id, distributor_product_id, expiry_date, received_at);
create index stock_batches_warehouse_id_idx on public.stock_batches (warehouse_id);
create index stock_batches_distributor_product_id_idx on public.stock_batches (distributor_product_id);
create index stock_batches_receipt_id_idx on public.stock_batches (receipt_id);
create index stock_batches_created_by_idx on public.stock_batches (created_by);

create table public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  transfer_number text not null,
  from_warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  to_warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  status public.stock_transfer_status not null default 'draft',
  notes text,
  shipped_at timestamptz,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, transfer_number),
  check (from_warehouse_id <> to_warehouse_id)
);
create index stock_transfers_from_warehouse_id_idx on public.stock_transfers (from_warehouse_id);
create index stock_transfers_to_warehouse_id_idx on public.stock_transfers (to_warehouse_id);
create index stock_transfers_created_by_idx on public.stock_transfers (created_by);

-- Append-only. quantity is signed pieces: on-hand changes for stock_in/transfer/dispatch/
-- return/adjust_*; reserved-quantity changes for reserve (+) and release (-).
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  batch_id uuid not null references public.stock_batches (id) on delete restrict,
  distributor_product_id uuid not null references public.distributor_products (id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity integer not null check (quantity <> 0),
  unit_cost_paisa bigint not null default 0 check (unit_cost_paisa >= 0),
  reference_type text,
  reference_id uuid,
  transfer_id uuid references public.stock_transfers (id) on delete set null,
  receipt_id uuid references public.stock_receipts (id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index stock_movements_org_created_idx on public.stock_movements (org_id, created_at desc);
create index stock_movements_reference_idx on public.stock_movements (reference_type, reference_id);
create index stock_movements_warehouse_id_idx on public.stock_movements (warehouse_id);
create index stock_movements_batch_id_idx on public.stock_movements (batch_id);
create index stock_movements_distributor_product_id_idx on public.stock_movements (distributor_product_id, created_at desc);
create index stock_movements_transfer_id_idx on public.stock_movements (transfer_id);
create index stock_movements_receipt_id_idx on public.stock_movements (receipt_id);
create index stock_movements_created_by_idx on public.stock_movements (created_by);

alter table public.orders
  add constraint orders_warehouse_id_fkey foreign key (warehouse_id) references public.warehouses (id) on delete set null;
alter table public.trips
  add constraint trips_warehouse_id_fkey foreign key (warehouse_id) references public.warehouses (id) on delete set null;

-- Movements are a ledger: never updated.
create or replace function private.prevent_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'append_only' using errcode = '55000', detail = format('%s rows cannot be changed.', tg_table_name);
end;
$$;
create trigger append_only before update on public.stock_movements for each row execute function private.prevent_update();

create trigger set_row_metadata before insert or update on public.warehouses for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.suppliers for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.stock_receipts for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.stock_batches for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.stock_transfers for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.stock_movements for each row execute function private.set_row_metadata();

create trigger prevent_hard_delete before delete on public.stock_receipts for each row execute function private.prevent_hard_delete();

alter table public.warehouses enable row level security;
alter table public.suppliers enable row level security;
alter table public.stock_receipts enable row level security;
alter table public.stock_batches enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_movements enable row level security;
