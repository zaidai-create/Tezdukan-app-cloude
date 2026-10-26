-- =============================================================================================
-- Money: double-entry ledger (one book per distributor and per shop), payments with FIFO
-- allocation, rider/booker cash settlements, and distributor subscriptions.
--
-- Books:
--   book_type 'org'  (book = a distributor): receivable accounts per retailer shop
--                    (counterparty_type 'shop'). A dukandar's "distributor ledger" reads exactly
--                    these entries - one source of truth.
--   book_type 'shop' (book = a dukan): POS sales and the khata, with receivable accounts per
--                    khata customer (counterparty_type 'shop_customer').
-- Journals always balance (enforced in post_ledger_entry and by a deferred constraint trigger).
-- Entries are immutable; corrections are reversal journals.
-- =============================================================================================

create type public.ledger_book_type as enum ('org', 'shop');
create type public.ledger_account_code as enum (
  'cash', 'bank', 'wallet', 'sales', 'sales_returns', 'discounts', 'scheme_expense', 'receivable',
  'write_off', 'opening_equity', 'cash_in_transit'
);
create type public.counterparty_type as enum ('shop', 'shop_customer');
create type public.payment_method as enum ('cash', 'jazzcash', 'easypaisa', 'raast', 'bank_transfer', 'cheque', 'card');
create type public.payment_status as enum ('pending_verification', 'confirmed', 'rejected');
create type public.cash_settlement_status as enum ('pending', 'approved', 'disputed');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');
create type public.billing_interval as enum ('monthly', 'yearly');
create type public.invoice_status as enum ('draft', 'issued', 'paid', 'overdue', 'void');

-- ---------------------------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------------------------
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  book_type public.ledger_book_type not null,
  org_id uuid references public.organizations (id) on delete restrict,
  shop_id uuid references public.shops (id) on delete restrict,
  book_id uuid generated always as (coalesce(org_id, shop_id)) stored,
  code public.ledger_account_code not null,
  name text not null,
  counterparty_type public.counterparty_type,
  counterparty_shop_id uuid references public.shops (id) on delete restrict,
  counterparty_customer_id uuid,
  counterparty_id uuid generated always as (coalesce(counterparty_shop_id, counterparty_customer_id)) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((book_type = 'org' and org_id is not null and shop_id is null) or (book_type = 'shop' and shop_id is not null and org_id is null)),
  check (
    (counterparty_type is null and counterparty_shop_id is null and counterparty_customer_id is null)
    or (counterparty_type = 'shop' and book_type = 'org' and counterparty_shop_id is not null and counterparty_customer_id is null)
    or (counterparty_type = 'shop_customer' and book_type = 'shop' and counterparty_customer_id is not null and counterparty_shop_id is null)
  ),
  check ((code = 'receivable') = (counterparty_type is not null)),
  unique nulls not distinct (book_id, code, counterparty_id)
);
comment on table public.ledger_accounts is 'Chart of accounts per book. Receivable accounts carry the counterparty (retailer shop or khata customer).';
create index ledger_accounts_org_id_idx on public.ledger_accounts (org_id);
create index ledger_accounts_shop_id_idx on public.ledger_accounts (shop_id);
create index ledger_accounts_counterparty_shop_id_idx on public.ledger_accounts (counterparty_shop_id);
create index ledger_accounts_counterparty_customer_id_idx on public.ledger_accounts (counterparty_customer_id);
create index ledger_accounts_created_by_idx on public.ledger_accounts (created_by);

create table public.ledger_journals (
  id uuid primary key default gen_random_uuid(),
  book_type public.ledger_book_type not null,
  org_id uuid references public.organizations (id) on delete restrict,
  shop_id uuid references public.shops (id) on delete restrict,
  book_id uuid generated always as (coalesce(org_id, shop_id)) stored,
  entry_date date not null default private.pkt_today(),
  memo text,
  reference_type text,
  reference_id uuid,
  reversal_of uuid references public.ledger_journals (id) on delete restrict,
  client_id uuid,
  posted_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((book_type = 'org' and org_id is not null and shop_id is null) or (book_type = 'shop' and shop_id is not null and org_id is null))
);
comment on table public.ledger_journals is 'Journal header: one balanced set of entries in one book.';
create unique index ledger_journals_client_id_key on public.ledger_journals (book_id, client_id) where client_id is not null;
create unique index ledger_journals_reversal_of_key on public.ledger_journals (reversal_of) where reversal_of is not null;
create index ledger_journals_org_id_idx on public.ledger_journals (org_id, entry_date);
create index ledger_journals_shop_id_idx on public.ledger_journals (shop_id, entry_date);
create index ledger_journals_reference_idx on public.ledger_journals (reference_type, reference_id);
create index ledger_journals_posted_by_idx on public.ledger_journals (posted_by);
create index ledger_journals_created_by_idx on public.ledger_journals (created_by);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.ledger_journals (id) on delete restrict,
  account_id uuid not null references public.ledger_accounts (id) on delete restrict,
  book_type public.ledger_book_type not null,
  org_id uuid references public.organizations (id) on delete restrict,
  shop_id uuid references public.shops (id) on delete restrict,
  book_id uuid generated always as (coalesce(org_id, shop_id)) stored,
  counterparty_shop_id uuid references public.shops (id) on delete restrict,
  counterparty_customer_id uuid,
  debit_paisa bigint not null default 0 check (debit_paisa >= 0),
  credit_paisa bigint not null default 0 check (credit_paisa >= 0),
  entry_date date not null default private.pkt_today(),
  due_date date,
  memo text,
  reference_type text,
  reference_id uuid,
  reversal_of uuid references public.ledger_entries (id) on delete restrict,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((book_type = 'org' and org_id is not null and shop_id is null) or (book_type = 'shop' and shop_id is not null and org_id is null)),
  check ((debit_paisa > 0) <> (credit_paisa > 0))
);
comment on column public.ledger_entries.counterparty_shop_id is 'Copied from the account: lets the retailer shop read its own receivable lines.';
create index ledger_entries_journal_id_idx on public.ledger_entries (journal_id);
create index ledger_entries_account_id_idx on public.ledger_entries (account_id, entry_date);
create index ledger_entries_org_id_idx on public.ledger_entries (org_id, entry_date);
create index ledger_entries_shop_id_idx on public.ledger_entries (shop_id, entry_date);
create index ledger_entries_counterparty_shop_id_idx on public.ledger_entries (counterparty_shop_id, entry_date);
create index ledger_entries_counterparty_customer_id_idx on public.ledger_entries (counterparty_customer_id, entry_date);
create index ledger_entries_reversal_of_idx on public.ledger_entries (reversal_of);
create index ledger_entries_reference_idx on public.ledger_entries (reference_type, reference_id);
create index ledger_entries_created_by_idx on public.ledger_entries (created_by);

-- Backstop: at commit every touched journal must balance (sum debit = sum credit, >= 2 lines).
create or replace function private.check_journal_balanced()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_journal uuid;
  v_debit bigint;
  v_credit bigint;
  v_lines integer;
begin
  if tg_op = 'DELETE' then
    v_journal := old.journal_id;
  else
    v_journal := new.journal_id;
  end if;
  select coalesce(sum(e.debit_paisa), 0), coalesce(sum(e.credit_paisa), 0), count(*)
    into v_debit, v_credit, v_lines
    from public.ledger_entries e
   where e.journal_id = v_journal
     and e.deleted_at is null;
  if v_lines > 0 and (v_debit <> v_credit or v_lines < 2) then
    raise exception 'unbalanced_journal'
      using errcode = '23514',
            detail = format('Journal %s: debit %s, credit %s, %s line(s).', v_journal, v_debit, v_credit, v_lines);
  end if;
  return null;
end;
$$;
create constraint trigger ledger_entries_balanced
  after insert or update or delete on public.ledger_entries
  deferrable initially deferred
  for each row execute function private.check_journal_balanced();

-- Entries never change after posting (only a whole-journal soft delete is possible).
create or replace function private.ledger_entries_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.journal_id, new.account_id, new.book_type, new.org_id, new.shop_id, new.counterparty_shop_id,
      new.counterparty_customer_id, new.debit_paisa, new.credit_paisa, new.entry_date, new.due_date,
      new.memo, new.reference_type, new.reference_id, new.reversal_of)
     is distinct from
     (old.journal_id, old.account_id, old.book_type, old.org_id, old.shop_id, old.counterparty_shop_id,
      old.counterparty_customer_id, old.debit_paisa, old.credit_paisa, old.entry_date, old.due_date,
      old.memo, old.reference_type, old.reference_id, old.reversal_of) then
    raise exception 'ledger_entries_are_immutable' using errcode = '55000', detail = 'Post a reversal instead.';
  end if;
  return new;
end;
$$;
create trigger immutable before update on public.ledger_entries
  for each row execute function private.ledger_entries_immutable();

-- Entries copy book and counterparty from their account and must match the journal's book.
create or replace function private.tg_ledger_entries_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acc public.ledger_accounts%rowtype;
  v_journal_book uuid;
begin
  select * into v_acc from public.ledger_accounts where id = new.account_id;
  if v_acc.id is null then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  select j.book_id into v_journal_book from public.ledger_journals j where j.id = new.journal_id;
  if v_journal_book is distinct from v_acc.book_id then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Entry account is not in the journal''s book.';
  end if;
  new.book_type := v_acc.book_type;
  new.org_id := v_acc.org_id;
  new.shop_id := v_acc.shop_id;
  new.counterparty_shop_id := v_acc.counterparty_shop_id;
  new.counterparty_customer_id := v_acc.counterparty_customer_id;
  return new;
end;
$$;
create trigger consistency before insert on public.ledger_entries
  for each row execute function private.tg_ledger_entries_consistency();

-- ---------------------------------------------------------------------------------------------
-- Payments and allocations
-- ---------------------------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  book_type public.ledger_book_type not null,
  org_id uuid references public.organizations (id) on delete restrict,
  shop_id uuid references public.shops (id) on delete restrict,
  book_id uuid generated always as (coalesce(org_id, shop_id)) stored,
  payer_type public.counterparty_type not null,
  payer_shop_id uuid references public.shops (id) on delete restrict,
  payer_customer_id uuid,
  payer_id uuid generated always as (coalesce(payer_shop_id, payer_customer_id)) stored,
  amount_paisa bigint not null check (amount_paisa > 0),
  allocated_paisa bigint not null default 0 check (allocated_paisa >= 0),
  method public.payment_method not null,
  reference_no text,
  receipt_path text,
  status public.payment_status not null default 'confirmed',
  collected_by uuid references public.profiles (id) on delete set null,
  collected_by_member_id uuid references public.org_members (id) on delete set null,
  trip_id uuid references public.trips (id) on delete set null,
  received_at timestamptz not null default now(),
  journal_id uuid references public.ledger_journals (id) on delete restrict,
  settlement_id uuid,
  client_id uuid,
  notes text,
  rejection_reason text,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check ((book_type = 'org' and org_id is not null and shop_id is null) or (book_type = 'shop' and shop_id is not null and org_id is null)),
  check (
    (payer_type = 'shop' and book_type = 'org' and payer_shop_id is not null and payer_customer_id is null)
    or (payer_type = 'shop_customer' and book_type = 'shop' and payer_customer_id is not null and payer_shop_id is null)
  ),
  check (allocated_paisa <= amount_paisa)
);
comment on column public.payments.collected_by_member_id is 'Rider/booker who collected cash in the field (settled at day end).';
create unique index payments_client_id_key on public.payments (book_id, client_id) where client_id is not null;
create index payments_org_id_idx on public.payments (org_id, received_at desc);
create index payments_shop_id_idx on public.payments (shop_id, received_at desc);
create index payments_payer_shop_id_idx on public.payments (payer_shop_id);
create index payments_payer_customer_id_idx on public.payments (payer_customer_id);
create index payments_collected_by_idx on public.payments (collected_by);
create index payments_collected_by_member_id_idx on public.payments (collected_by_member_id);
create index payments_trip_id_idx on public.payments (trip_id);
create index payments_journal_id_idx on public.payments (journal_id);
create index payments_settlement_id_idx on public.payments (settlement_id);
create index payments_verified_by_idx on public.payments (verified_by);
create index payments_created_by_idx on public.payments (created_by);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  book_type public.ledger_book_type not null,
  org_id uuid references public.organizations (id) on delete restrict,
  shop_id uuid references public.shops (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict,
  pos_bill_id uuid,
  amount_paisa bigint not null check (amount_paisa > 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (num_nonnulls(order_id, pos_bill_id) = 1)
);
create index payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index payment_allocations_org_id_idx on public.payment_allocations (org_id);
create index payment_allocations_shop_id_idx on public.payment_allocations (shop_id);
create index payment_allocations_order_id_idx on public.payment_allocations (order_id);
create index payment_allocations_pos_bill_id_idx on public.payment_allocations (pos_bill_id);
create index payment_allocations_created_by_idx on public.payment_allocations (created_by);

-- Day-end hand-over of cash collected by a rider or booker.
create table public.cash_settlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  member_id uuid not null references public.org_members (id) on delete restrict,
  trip_id uuid references public.trips (id) on delete set null,
  settlement_date date not null default private.pkt_today(),
  expected_paisa bigint not null check (expected_paisa >= 0),
  received_paisa bigint not null check (received_paisa >= 0),
  variance_paisa bigint generated always as (received_paisa - expected_paisa) stored,
  status public.cash_settlement_status not null default 'pending',
  notes text,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  journal_id uuid references public.ledger_journals (id) on delete restrict,
  client_id uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, client_id)
);
create index cash_settlements_member_id_idx on public.cash_settlements (member_id, settlement_date);
create index cash_settlements_trip_id_idx on public.cash_settlements (trip_id);
create index cash_settlements_approved_by_idx on public.cash_settlements (approved_by);
create index cash_settlements_journal_id_idx on public.cash_settlements (journal_id);
create index cash_settlements_created_by_idx on public.cash_settlements (created_by);

alter table public.payments
  add constraint payments_settlement_id_fkey foreign key (settlement_id) references public.cash_settlements (id) on delete set null;
alter table public.credit_notes
  add constraint credit_notes_journal_id_fkey foreign key (journal_id) references public.ledger_journals (id) on delete restrict;

-- ---------------------------------------------------------------------------------------------
-- Distributor subscriptions
-- ---------------------------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  name_ur text,
  description text,
  price_paisa bigint not null check (price_paisa >= 0),
  billing_interval public.billing_interval not null default 'monthly',
  trial_days integer not null default 30 check (trial_days between 0 and 365),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  features text[] not null default '{}',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.plans.limits is 'e.g. {"max_users": 5, "max_products": 500, "max_warehouses": 1, "munshi_requests_per_month": 1000}';
create index plans_created_by_idx on public.plans (created_by);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  plan_id uuid not null references public.plans (id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  price_paisa bigint not null check (price_paisa >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (current_period_end > current_period_start)
);
create unique index subscriptions_one_live_per_org on public.subscriptions (org_id)
  where status in ('trialing', 'active', 'past_due') and deleted_at is null;
create index subscriptions_org_id_idx on public.subscriptions (org_id);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end) where status in ('trialing', 'active', 'past_due');
create index subscriptions_created_by_idx on public.subscriptions (created_by);

create table public.subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  org_id uuid not null references public.organizations (id) on delete restrict,
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  plan_id uuid not null references public.plans (id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  amount_paisa bigint not null check (amount_paisa >= 0),
  status public.invoice_status not null default 'issued',
  issued_at timestamptz not null default now(),
  due_date date not null,
  paid_at timestamptz,
  payment_reference text,
  pdf_path text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (subscription_id, period_start),
  check (period_end > period_start)
);
create index subscription_invoices_org_id_idx on public.subscription_invoices (org_id, issued_at desc);
create index subscription_invoices_plan_id_idx on public.subscription_invoices (plan_id);
create index subscription_invoices_created_by_idx on public.subscription_invoices (created_by);

-- ---------------------------------------------------------------------------------------------
-- Row metadata, soft-delete guard, RLS
-- ---------------------------------------------------------------------------------------------
create trigger set_row_metadata before insert or update on public.ledger_accounts for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.ledger_journals for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.ledger_entries for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.payments for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.payment_allocations for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.cash_settlements for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.plans for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.subscriptions for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.subscription_invoices for each row execute function private.set_row_metadata();

create trigger prevent_hard_delete before delete on public.ledger_journals for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.ledger_entries for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.payments for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.payment_allocations for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.cash_settlements for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.subscriptions for each row execute function private.prevent_hard_delete();
create trigger prevent_hard_delete before delete on public.subscription_invoices for each row execute function private.prevent_hard_delete();

alter table public.ledger_accounts enable row level security;
alter table public.ledger_journals enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.cash_settlements enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;
