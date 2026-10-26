-- =============================================================================================
-- Ordering (B2B): server carts, orders split per distributor, line snapshots, status history,
-- delivery OTPs, return claims and credit notes. Orders and their children are financial:
-- written only by RPCs (no client write policies), never hard-deleted.
-- =============================================================================================

create type public.order_status as enum (
  'new', 'confirmed', 'picking', 'packed', 'dispatched', 'delivered', 'partially_delivered', 'returned', 'cancelled'
);
create type public.order_payment_method as enum ('cod', 'credit', 'jazzcash', 'easypaisa', 'raast', 'bank_transfer');
create type public.order_payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
create type public.order_source as enum ('app', 'munshi', 'parchi', 'reorder', 'booker', 'api', 'whatsapp');
create type public.cart_item_source as enum ('manual', 'munshi', 'parchi', 'reorder', 'booker');
create type public.substitution_status as enum ('proposed', 'accepted', 'rejected');
create type public.return_status as enum ('requested', 'approved', 'rejected', 'received', 'credited');
create type public.return_reason as enum ('damaged', 'short', 'expired', 'wrong_item', 'quality', 'other');
create type public.credit_note_status as enum ('issued', 'applied', 'void');

-- ---------------------------------------------------------------------------------------------
-- Server cart per (shop, user) so other devices and Munshi see the same cart. Bookers get their
-- own cart per shop they book for.
-- ---------------------------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (shop_id, user_id)
);
create index carts_user_id_idx on public.carts (user_id);
create index carts_created_by_idx on public.carts (created_by);
create index carts_updated_at_idx on public.carts (updated_at);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  distributor_product_id uuid not null references public.distributor_products (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  pack_unit_id uuid not null references public.pack_units (id) on delete cascade,
  quantity integer not null check (quantity between 1 and 100000),
  added_via public.cart_item_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (cart_id, distributor_product_id, pack_unit_id)
);
comment on column public.cart_items.org_id is 'Derived from the product; used to split the cart by distributor.';
create index cart_items_distributor_product_id_idx on public.cart_items (distributor_product_id);
create index cart_items_org_id_idx on public.cart_items (org_id);
create index cart_items_pack_unit_id_idx on public.cart_items (pack_unit_id);
create index cart_items_created_by_idx on public.cart_items (created_by);

-- ---------------------------------------------------------------------------------------------
-- orders: one per (shop, distributor) per checkout. Totals are always consistent:
-- subtotal - discount - scheme_discount + delivery_fee = total. Before delivery `total` is the
-- ordered amount; confirm_delivery restates it to the invoiced (delivered) amount and keeps the
-- original in ordered_total_paisa.
-- ---------------------------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  shop_id uuid not null references public.shops (id) on delete restrict,
  org_id uuid not null references public.organizations (id) on delete restrict,
  warehouse_id uuid,
  placed_by uuid references public.profiles (id) on delete set null,
  placed_by_name text,
  booker_id uuid references public.org_members (id) on delete set null,
  source public.order_source not null default 'app',
  status public.order_status not null default 'new',
  payment_method public.order_payment_method not null,
  payment_status public.order_payment_status not null default 'unpaid',
  subtotal_paisa bigint not null default 0 check (subtotal_paisa >= 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  scheme_discount_paisa bigint not null default 0 check (scheme_discount_paisa >= 0),
  delivery_fee_paisa bigint not null default 0 check (delivery_fee_paisa >= 0),
  total_paisa bigint not null default 0 check (total_paisa >= 0),
  ordered_total_paisa bigint not null default 0 check (ordered_total_paisa >= 0),
  paid_paisa bigint not null default 0 check (paid_paisa >= 0),
  delivery_slot_start timestamptz,
  delivery_slot_end timestamptz,
  delivery_address jsonb,
  notes text check (char_length(notes) <= 1000),
  cancel_reason text,
  cancelled_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  picking_at timestamptz,
  packed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  returned_at timestamptz,
  received_at timestamptz,
  received_by uuid references public.profiles (id) on delete set null,
  trip_id uuid,
  invoice_number text unique,
  invoice_path text,
  invoiced_at timestamptz,
  due_date date,
  rating smallint check (rating between 1 and 5),
  client_request_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (subtotal_paisa - discount_paisa - scheme_discount_paisa + delivery_fee_paisa = total_paisa),
  check (paid_paisa <= total_paisa),
  check (delivery_slot_start is null or delivery_slot_end is null or delivery_slot_end > delivery_slot_start)
);
comment on column public.orders.due_date is 'Invoice due date (delivery date + payment terms); null until invoiced.';
comment on column public.orders.client_request_id is 'Idempotency key shared by all orders created by one place_order call.';
create unique index orders_idempotency_key on public.orders (shop_id, org_id, client_request_id) where client_request_id is not null;
create index orders_shop_id_created_idx on public.orders (shop_id, created_at desc);
create index orders_org_id_status_idx on public.orders (org_id, status, created_at desc);
create index orders_open_invoices_idx on public.orders (org_id, shop_id, due_date) where status in ('delivered', 'partially_delivered') and deleted_at is null;
create index orders_warehouse_id_idx on public.orders (warehouse_id);
create index orders_placed_by_idx on public.orders (placed_by);
create index orders_booker_id_idx on public.orders (booker_id);
create index orders_cancelled_by_idx on public.orders (cancelled_by);
create index orders_received_by_idx on public.orders (received_by);
create index orders_trip_id_idx on public.orders (trip_id);
create index orders_created_by_idx on public.orders (created_by);

-- Line snapshots. Paid quantity = quantity packs x base_qty_per_unit pieces; free goods are in
-- free_base_qty (reward-product lines have quantity 0 and only free goods).
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  distributor_product_id uuid not null references public.distributor_products (id) on delete restrict,
  master_product_id uuid references public.master_products (id) on delete set null,
  pack_unit_id uuid references public.pack_units (id) on delete set null,
  name text not null,
  name_ur text,
  sku text,
  barcode text,
  image_path text,
  category_id uuid references public.categories (id) on delete set null,
  pack_unit public.pack_unit_kind not null,
  pack_label text,
  base_qty_per_unit integer not null check (base_qty_per_unit > 0),
  quantity integer not null check (quantity >= 0),
  base_qty integer generated always as (quantity * base_qty_per_unit) stored,
  piece_price_paisa bigint not null check (piece_price_paisa >= 0),
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  mrp_paisa bigint not null default 0 check (mrp_paisa >= 0),
  scheme_id uuid references public.schemes (id) on delete set null,
  free_base_qty integer not null default 0 check (free_base_qty >= 0),
  line_discount_paisa bigint not null default 0 check (line_discount_paisa >= 0),
  line_total_paisa bigint not null check (line_total_paisa >= 0),
  delivered_base_qty integer check (delivered_base_qty >= 0),
  free_delivered_base_qty integer check (free_delivered_base_qty >= 0),
  damaged_base_qty integer not null default 0 check (damaged_base_qty >= 0),
  short_base_qty integer not null default 0 check (short_base_qty >= 0),
  invoiced_total_paisa bigint check (invoiced_total_paisa >= 0),
  received_base_qty integer check (received_base_qty >= 0),
  substitution_of_item_id uuid references public.order_items (id) on delete set null,
  substitution_status public.substitution_status,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (quantity > 0 or free_base_qty > 0),
  check (unit_price_paisa = piece_price_paisa * base_qty_per_unit),
  check (line_total_paisa = quantity * unit_price_paisa - line_discount_paisa)
);
comment on column public.order_items.piece_price_paisa is 'Server-resolved trade price per piece (tier-aware) at order time.';
comment on column public.order_items.invoiced_total_paisa is 'Line amount invoiced for the delivered quantity.';
create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_org_id_idx on public.order_items (org_id);
create index order_items_shop_product_idx on public.order_items (shop_id, distributor_product_id);
create index order_items_distributor_product_id_idx on public.order_items (distributor_product_id);
create index order_items_master_product_id_idx on public.order_items (master_product_id);
create index order_items_pack_unit_id_idx on public.order_items (pack_unit_id);
create index order_items_category_id_idx on public.order_items (category_id);
create index order_items_scheme_id_idx on public.order_items (scheme_id);
create index order_items_substitution_of_item_id_idx on public.order_items (substitution_of_item_id);
create index order_items_created_by_idx on public.order_items (created_by);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_by_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index order_status_history_order_id_idx on public.order_status_history (order_id, created_at);
create index order_status_history_org_id_idx on public.order_status_history (org_id);
create index order_status_history_shop_id_idx on public.order_status_history (shop_id);
create index order_status_history_changed_by_idx on public.order_status_history (changed_by);
create index order_status_history_created_by_idx on public.order_status_history (created_by);

-- 4-digit code the dukandar gives the rider at delivery. Readable only by the ordering shop.
create table public.delivery_otps (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$'),
  attempts integer not null default 0 check (attempts >= 0),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index delivery_otps_shop_id_idx on public.delivery_otps (shop_id);
create index delivery_otps_created_by_idx on public.delivery_otps (created_by);

-- ---------------------------------------------------------------------------------------------
-- Return / damage / short claims and credit notes
-- ---------------------------------------------------------------------------------------------
create table public.returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  org_id uuid not null references public.organizations (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  status public.return_status not null default 'requested',
  reason public.return_reason not null,
  notes text,
  photo_paths text[] not null default '{}',
  claim_total_paisa bigint not null default 0 check (claim_total_paisa >= 0),
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  received_at timestamptz,
  credited_at timestamptz,
  credit_note_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index returns_org_id_idx on public.returns (org_id, status);
create index returns_shop_id_idx on public.returns (shop_id);
create index returns_order_id_idx on public.returns (order_id);
create index returns_requested_by_idx on public.returns (requested_by);
create index returns_reviewed_by_idx on public.returns (reviewed_by);
create index returns_credit_note_id_idx on public.returns (credit_note_id);
create index returns_created_by_idx on public.returns (created_by);

create table public.return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  order_item_id uuid not null references public.order_items (id) on delete restrict,
  distributor_product_id uuid not null references public.distributor_products (id) on delete restrict,
  base_qty integer not null check (base_qty > 0),
  reason public.return_reason not null,
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  amount_paisa bigint not null check (amount_paisa >= 0),
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.return_items.unit_price_paisa is 'Invoiced net price per piece used to value the claim.';
create index return_items_return_id_idx on public.return_items (return_id);
create index return_items_org_id_idx on public.return_items (org_id);
create index return_items_shop_id_idx on public.return_items (shop_id);
create index return_items_order_item_id_idx on public.return_items (order_item_id);
create index return_items_distributor_product_id_idx on public.return_items (distributor_product_id);
create index return_items_created_by_idx on public.return_items (created_by);

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_number text not null unique,
  org_id uuid not null references public.organizations (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  return_id uuid references public.returns (id) on delete restrict,
  amount_paisa bigint not null check (amount_paisa > 0),
  reason text,
  status public.credit_note_status not null default 'issued',
  journal_id uuid,
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index credit_notes_org_id_idx on public.credit_notes (org_id);
create index credit_notes_shop_id_idx on public.credit_notes (shop_id);
create index credit_notes_order_id_idx on public.credit_notes (order_id);
create index credit_notes_return_id_idx on public.credit_notes (return_id);
create index credit_notes_journal_id_idx on public.credit_notes (journal_id);
create index credit_notes_issued_by_idx on public.credit_notes (issued_by);
create index credit_notes_created_by_idx on public.credit_notes (created_by);

alter table public.returns
  add constraint returns_credit_note_id_fkey foreign key (credit_note_id) references public.credit_notes (id) on delete set null;

-- ---------------------------------------------------------------------------------------------
-- Cart consistency: org_id comes from the product, the pack unit must belong to the product,
-- and touching an item bumps the cart (stale carts are purged by housekeeping).
-- ---------------------------------------------------------------------------------------------
create or replace function private.tg_cart_items_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select dp.org_id into v_org from public.distributor_products dp where dp.id = new.distributor_product_id;
  if v_org is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.pack_units pu
     where pu.id = new.pack_unit_id and pu.distributor_product_id = new.distributor_product_id
  ) then
    raise exception 'invalid_pack_unit' using errcode = '22023', detail = 'Pack unit does not belong to the product.';
  end if;
  new.org_id := v_org;
  return new;
end;
$$;
create trigger consistency before insert or update on public.cart_items
  for each row execute function private.tg_cart_items_consistency();

create or replace function private.tg_touch_cart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.carts set updated_at = now() where id = coalesce(new.cart_id, old.cart_id);
  return null;
end;
$$;
create trigger touch_cart after insert or update or delete on public.cart_items
  for each row execute function private.tg_touch_cart();

-- ---------------------------------------------------------------------------------------------
-- Row metadata, soft-delete guard, RLS
-- ---------------------------------------------------------------------------------------------
create trigger set_row_metadata before insert or update on public.carts for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.cart_items for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.orders for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.order_items for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.order_status_history for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.delivery_otps for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.returns for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.return_items for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.credit_notes for each row execute function private.set_row_metadata();

create trigger prevent_hard_delete before delete on public.orders for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.order_items for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.credit_notes for each row execute function private.prevent_hard_delete();

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.delivery_otps enable row level security;
alter table public.returns enable row level security;
alter table public.return_items enable row level security;
alter table public.credit_notes enable row level security;
