-- Qayam Traders ERP schema. Safe to run on every start (idempotent).

create table if not exists users (
  id            serial primary key,
  username      text unique not null check (username ~ '^[a-z0-9._-]{3,30}$'),
  name          text not null,
  role          text not null check (role in ('admin','accountant','salesman')),
  pass_hash     text not null,
  active        boolean not null default true,
  must_change   boolean not null default false,
  token_version int not null default 0,
  phone         text not null default '',
  created_at    timestamptz not null default now()
);

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

create table if not exists accounts (
  code   text primary key,
  name   text not null,
  type   char(1) not null check (type in ('A','B','C','D','E')),  -- A asset, B liability, C income, D expense, E equity
  grp    text not null default '',
  system boolean not null default false
);

create table if not exists parties (
  id           serial primary key,
  kind         char(1) not null check (kind in ('C','V')),           -- C customer, V supplier
  name         text not null,
  city         text not null default '',
  phone        text not null default '',
  address      text not null default '',
  ntn          text not null default '',
  credit_limit numeric(14,2) not null default 0,
  legacy_ref   text unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists products (
  id        serial primary key,
  name      text not null,
  category  text not null default '',
  unit      text not null default 'pc',
  cost      numeric(14,2) not null default 0,
  price     numeric(14,2) not null default 0,
  stock     numeric(14,3) not null default 0,
  reorder   numeric(14,3) not null default 0,
  aliases   text not null default '',          -- extra words for voice matching, e.g. "ghee, desi ghee"
  legacy_id int unique,
  active    boolean not null default true
);

create table if not exists journals (
  id          serial primary key,
  no          text not null,
  date        date not null,
  type        text not null,
  memo        text not null default '',
  ref_invoice int,
  legacy      boolean not null default false,
  created_by  int references users(id),
  created_at  timestamptz not null default now()
);
create index if not exists journals_date on journals(date);
create index if not exists journals_ref on journals(ref_invoice);

create table if not exists journal_lines (
  id         serial primary key,
  journal_id int not null references journals(id) on delete cascade,
  account    text not null references accounts(code),
  party_id   int references parties(id),
  debit      numeric(14,2) not null default 0 check (debit >= 0),
  credit     numeric(14,2) not null default 0 check (credit >= 0)
);
create index if not exists jl_account on journal_lines(account);
create index if not exists jl_party on journal_lines(party_id);
create index if not exists jl_journal on journal_lines(journal_id);

-- Debit must equal credit for every journal. Checked by the database at commit time.
create or replace function check_journal_balance() returns trigger language plpgsql as $$
declare d numeric; c numeric; jid int;
begin
  jid := coalesce(new.journal_id, old.journal_id);
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into d, c from journal_lines where journal_id = jid;
  if d <> c then
    raise exception 'Journal % is not balanced (debit %, credit %)', jid, d, c;
  end if;
  return null;
end $$;
drop trigger if exists trg_journal_balance on journal_lines;
create constraint trigger trg_journal_balance after insert or update or delete on journal_lines
  deferrable initially deferred for each row execute function check_journal_balance();

create table if not exists invoices (
  id          serial primary key,
  kind        text not null check (kind in ('sale','purchase','sale_return','purchase_return')),
  no          text not null,
  date        date not null,
  party_id    int references parties(id),
  subtotal    numeric(14,2) not null default 0,
  discount    numeric(14,2) not null default 0,
  tax_pct     numeric(6,2)  not null default 0,
  tax         numeric(14,2) not null default 0,
  total       numeric(14,2) not null default 0,
  paid        numeric(14,2) not null default 0,
  pay_account text,
  note        text not null default '',
  legacy      boolean not null default false,
  source      text not null default 'app',      -- app | voice | import
  created_by  int references users(id),
  created_at  timestamptz not null default now(),
  unique (kind, no)
);
create index if not exists invoices_date on invoices(date);
create index if not exists invoices_party on invoices(party_id);

create table if not exists invoice_lines (
  id         serial primary key,
  invoice_id int not null references invoices(id) on delete cascade,
  product_id int references products(id),
  qty        numeric(14,3) not null,
  rate       numeric(14,2) not null,
  cost       numeric(14,2) not null default 0,
  amount     numeric(14,2) not null
);
create index if not exists il_invoice on invoice_lines(invoice_id);

create table if not exists counters (
  key text primary key,
  n   int not null
);

create table if not exists voice_drafts (
  id          serial primary key,
  text        text not null,
  draft       jsonb not null,
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by  int references users(id),
  decided_at  timestamptz,
  result      jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists audit_log (
  id        bigserial primary key,
  user_id   int,
  action    text not null,
  entity    text not null,
  entity_id text,
  data      jsonb,
  at        timestamptz not null default now()
);
