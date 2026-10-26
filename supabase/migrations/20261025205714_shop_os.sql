-- =============================================================================================
-- Shop OS: the dukan's own inventory (loose quantities allowed), stock batches and movements,
-- POS bills (offline-first, idempotent on the device-generated client_id), khata customers,
-- expenses and the cash book.
-- =============================================================================================

create type public.shop_stock_movement_type as enum (
  'receive', 'sale', 'sale_return', 'adjust_damage', 'adjust_expiry', 'self_use', 'count', 'opening'
);
create type public.pos_bill_status as enum ('completed', 'held', 'void', 'returned');
create type public.sale_channel as enum ('counter', 'online');
create type public.expense_category as enum ('rent', 'bijli', 'salaries', 'gas', 'transport', 'other');
create type public.cash_book_entry_type as enum ('opening', 'closing', 'cash_in', 'cash_out');

-- Khata customers (people who buy on udhaar from this shop).
create table public.shop_customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  phone public.phone_e164,
  credit_limit_paisa bigint check (credit_limit_paisa >= 0),
  terms_days integer not null default 0 check (terms_days between 0 and 365),
  profile_id uuid references public.profiles (id) on delete set null,
  address_line text,
  notes text,
  search_text text generated always as (private.search_normalize(coalesce(name, '') || ' ' || coalesce(phone, ''))) stored,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.shop_customers.credit_limit_paisa is 'Udhaar limit; null = no limit set.';
comment on column public.shop_customers.profile_id is 'Linked TezDukan user, if the customer has an account.';
create unique index shop_customers_shop_phone_key on public.shop_customers (shop_id, phone) where phone is not null and deleted_at is null;
create index shop_customers_shop_id_idx on public.shop_customers (shop_id);
create index shop_customers_profile_id_idx on public.shop_customers (profile_id);
create index shop_customers_created_by_idx on public.shop_customers (created_by);
create index shop_customers_search_trgm_idx on public.shop_customers using gin (search_text extensions.gin_trgm_ops);

create table public.shop_inventory (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  master_product_id uuid references public.master_products (id) on delete set null,
  distributor_product_id uuid references public.distributor_products (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  name_ur text,
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  sku text,
  category_id uuid references public.categories (id) on delete set null,
  brand_id uuid references public.brands (id) on delete set null,
  pack_size_label text,
  unit public.measure_unit not null default 'pc',
  is_loose boolean not null default false,
  cost_price_paisa bigint not null default 0 check (cost_price_paisa >= 0),
  selling_price_paisa bigint not null check (selling_price_paisa >= 0),
  mrp_paisa bigint check (mrp_paisa >= 0),
  qty_on_hand numeric(12, 3) not null default 0,
  low_stock_threshold numeric(12, 3) not null default 0 check (low_stock_threshold >= 0),
  is_favourite boolean not null default false,
  is_visible_online boolean not null default true,
  is_active boolean not null default true,
  image_path text,
  search_text text generated always as (
    private.search_normalize(
      coalesce(name, '') || ' ' || coalesce(name_ur, '') || ' ' || coalesce(pack_size_label, '') || ' ' ||
      coalesce(sku, '') || ' ' || coalesce(barcode, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (is_loose or qty_on_hand = trunc(qty_on_hand))
);
comment on column public.shop_inventory.cost_price_paisa is 'Moving-average cost per unit (per kg/litre for loose items).';
comment on column public.shop_inventory.qty_on_hand is 'Changes only through stock RPCs. May go negative when an offline sale outran the books; the RPC reports it.';
create unique index shop_inventory_shop_master_key on public.shop_inventory (shop_id, master_product_id) where master_product_id is not null;
create unique index shop_inventory_shop_barcode_key on public.shop_inventory (shop_id, barcode) where barcode is not null;
create index shop_inventory_shop_id_idx on public.shop_inventory (shop_id, is_active);
create index shop_inventory_master_product_id_idx on public.shop_inventory (master_product_id);
create index shop_inventory_distributor_product_id_idx on public.shop_inventory (distributor_product_id);
create index shop_inventory_category_id_idx on public.shop_inventory (category_id);
create index shop_inventory_brand_id_idx on public.shop_inventory (brand_id);
create index shop_inventory_created_by_idx on public.shop_inventory (created_by);
create index shop_inventory_search_trgm_idx on public.shop_inventory using gin (search_text extensions.gin_trgm_ops);

create table public.shop_stock_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  inventory_id uuid not null references public.shop_inventory (id) on delete cascade,
  batch_no text,
  expiry_date date,
  qty numeric(12, 3) not null default 0 check (qty >= 0),
  unit_cost_paisa bigint not null default 0 check (unit_cost_paisa >= 0),
  received_at timestamptz not null default now(),
  source_order_id uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index shop_stock_batches_shop_expiry_idx on public.shop_stock_batches (shop_id, expiry_date) where qty > 0;
create index shop_stock_batches_inventory_id_idx on public.shop_stock_batches (inventory_id, expiry_date);
create index shop_stock_batches_source_order_id_idx on public.shop_stock_batches (source_order_id);
create index shop_stock_batches_created_by_idx on public.shop_stock_batches (created_by);

create table public.shop_stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  inventory_id uuid not null references public.shop_inventory (id) on delete restrict,
  batch_id uuid references public.shop_stock_batches (id) on delete set null,
  movement_type public.shop_stock_movement_type not null,
  qty numeric(12, 3) not null check (qty <> 0),
  balance_after numeric(12, 3) not null,
  unit_cost_paisa bigint not null default 0 check (unit_cost_paisa >= 0),
  reference_type text,
  reference_id uuid,
  reason text,
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create unique index shop_stock_movements_client_id_key on public.shop_stock_movements (shop_id, client_id) where client_id is not null;
create index shop_stock_movements_shop_id_idx on public.shop_stock_movements (shop_id, created_at desc);
create index shop_stock_movements_inventory_id_idx on public.shop_stock_movements (inventory_id, created_at desc);
create index shop_stock_movements_batch_id_idx on public.shop_stock_movements (batch_id);
create index shop_stock_movements_reference_idx on public.shop_stock_movements (reference_type, reference_id);
create index shop_stock_movements_created_by_idx on public.shop_stock_movements (created_by);

-- POS bills. Money identity for completed bills:
--   subtotal - item_discount - bill_discount = total
--   paid_cash + paid_digital + udhaar - change = total
create table public.pos_bills (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  client_id uuid not null,
  bill_number bigint not null check (bill_number > 0),
  channel public.sale_channel not null default 'counter',
  customer_order_id uuid,
  customer_id uuid references public.shop_customers (id) on delete restrict,
  cashier_id uuid references public.profiles (id) on delete set null,
  status public.pos_bill_status not null default 'completed',
  subtotal_paisa bigint not null default 0 check (subtotal_paisa >= 0),
  item_discount_paisa bigint not null default 0 check (item_discount_paisa >= 0),
  bill_discount_paisa bigint not null default 0 check (bill_discount_paisa >= 0),
  total_paisa bigint not null default 0 check (total_paisa >= 0),
  paid_cash_paisa bigint not null default 0 check (paid_cash_paisa >= 0),
  paid_digital_paisa bigint not null default 0 check (paid_digital_paisa >= 0),
  digital_method public.payment_method,
  digital_reference text,
  udhaar_paisa bigint not null default 0 check (udhaar_paisa >= 0),
  udhaar_paid_paisa bigint not null default 0 check (udhaar_paid_paisa >= 0),
  change_paisa bigint not null default 0 check (change_paisa >= 0),
  cost_total_paisa bigint not null default 0 check (cost_total_paisa >= 0),
  created_offline boolean not null default false,
  device_id text,
  billed_at timestamptz not null default now(),
  synced_at timestamptz,
  notes text,
  journal_id uuid references public.ledger_journals (id) on delete restrict,
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (shop_id, client_id),
  unique (shop_id, bill_number),
  check (subtotal_paisa - item_discount_paisa - bill_discount_paisa = total_paisa),
  check (status = 'held' or paid_cash_paisa + paid_digital_paisa + udhaar_paisa - change_paisa = total_paisa),
  check (udhaar_paisa = 0 or customer_id is not null),
  check (paid_digital_paisa = 0 or digital_method is not null),
  check (udhaar_paid_paisa <= udhaar_paisa)
);
comment on column public.pos_bills.client_id is 'Generated on the device; makes offline sync idempotent.';
comment on column public.pos_bills.billed_at is 'When the sale happened on the device (may be before synced_at).';
create index pos_bills_shop_billed_idx on public.pos_bills (shop_id, billed_at desc);
create index pos_bills_customer_id_idx on public.pos_bills (customer_id);
create index pos_bills_customer_order_id_idx on public.pos_bills (customer_order_id);
create index pos_bills_cashier_id_idx on public.pos_bills (cashier_id);
create index pos_bills_journal_id_idx on public.pos_bills (journal_id);
create index pos_bills_voided_by_idx on public.pos_bills (voided_by);
create index pos_bills_created_by_idx on public.pos_bills (created_by);

create table public.pos_bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.pos_bills (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  inventory_id uuid references public.shop_inventory (id) on delete set null,
  name text not null,
  barcode text,
  category_id uuid references public.categories (id) on delete set null,
  unit public.measure_unit not null default 'pc',
  qty numeric(12, 3) not null check (qty > 0),
  unit_price_paisa bigint not null check (unit_price_paisa >= 0),
  mrp_paisa bigint check (mrp_paisa >= 0),
  cost_price_paisa bigint not null default 0 check (cost_price_paisa >= 0),
  discount_paisa bigint not null default 0 check (discount_paisa >= 0),
  line_total_paisa bigint not null check (line_total_paisa >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (line_total_paisa = round(qty * unit_price_paisa) - discount_paisa)
);
comment on column public.pos_bill_items.cost_price_paisa is 'Cost per unit snapshot at sale time, for profit reports.';
create index pos_bill_items_bill_id_idx on public.pos_bill_items (bill_id);
create index pos_bill_items_shop_id_idx on public.pos_bill_items (shop_id, created_at desc);
create index pos_bill_items_inventory_id_idx on public.pos_bill_items (inventory_id);
create index pos_bill_items_category_id_idx on public.pos_bill_items (category_id);
create index pos_bill_items_created_by_idx on public.pos_bill_items (created_by);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  category public.expense_category not null,
  amount_paisa bigint not null check (amount_paisa > 0),
  paid_from public.payment_method not null default 'cash',
  expense_date date not null default private.pkt_today(),
  notes text,
  receipt_path text,
  recorded_by uuid references public.profiles (id) on delete set null,
  client_id uuid,
  void_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (shop_id, client_id)
);
create index expenses_shop_date_idx on public.expenses (shop_id, expense_date desc);
create index expenses_recorded_by_idx on public.expenses (recorded_by);
create index expenses_created_by_idx on public.expenses (created_by);

-- Manual cash entries plus the daily opening/closing count. POS cash and expenses join these
-- in the daily cash view.
create table public.cash_book (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  entry_date date not null default private.pkt_today(),
  entry_type public.cash_book_entry_type not null,
  amount_paisa bigint not null check (amount_paisa >= 0),
  note text,
  reference_type text,
  reference_id uuid,
  recorded_by uuid references public.profiles (id) on delete set null,
  client_id uuid,
  void_reason text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (shop_id, client_id)
);
create unique index cash_book_one_opening_closing_per_day on public.cash_book (shop_id, entry_date, entry_type)
  where entry_type in ('opening', 'closing') and deleted_at is null;
create index cash_book_shop_date_idx on public.cash_book (shop_id, entry_date desc);
create index cash_book_recorded_by_idx on public.cash_book (recorded_by);
create index cash_book_created_by_idx on public.cash_book (created_by);

-- Forward references from the money area.
alter table public.ledger_accounts
  add constraint ledger_accounts_counterparty_customer_id_fkey foreign key (counterparty_customer_id) references public.shop_customers (id) on delete restrict;
alter table public.ledger_entries
  add constraint ledger_entries_counterparty_customer_id_fkey foreign key (counterparty_customer_id) references public.shop_customers (id) on delete restrict;
alter table public.payments
  add constraint payments_payer_customer_id_fkey foreign key (payer_customer_id) references public.shop_customers (id) on delete restrict;
alter table public.payment_allocations
  add constraint payment_allocations_pos_bill_id_fkey foreign key (pos_bill_id) references public.pos_bills (id) on delete restrict;

create trigger append_only before update on public.shop_stock_movements for each row execute function private.prevent_update();

create trigger set_row_metadata before insert or update on public.shop_customers for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.shop_inventory for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.shop_stock_batches for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.shop_stock_movements for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.pos_bills for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.pos_bill_items for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.expenses for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.cash_book for each row execute function private.set_row_metadata();

create trigger prevent_hard_delete before delete on public.shop_customers for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.pos_bills for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.pos_bill_items for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.expenses for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.cash_book for each row execute function private.prevent_hard_delete();

alter table public.shop_customers enable row level security;
alter table public.shop_inventory enable row level security;
alter table public.shop_stock_batches enable row level security;
alter table public.shop_stock_movements enable row level security;
alter table public.pos_bills enable row level security;
alter table public.pos_bill_items enable row level security;
alter table public.expenses enable row level security;
alter table public.cash_book enable row level security;
