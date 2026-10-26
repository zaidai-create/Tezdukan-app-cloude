-- =============================================================================================
-- Catalog: TezDukan master catalog (brands, categories, master products, search lexicon,
-- images) and each distributor's catalog (products, pack units, price tiers, schemes) plus the
-- distributor <-> shop relationship (retailer_accounts).
-- =============================================================================================

create type public.alias_target_type as enum ('product', 'brand', 'category');
create type public.alias_kind as enum ('name', 'spelling', 'mishearing', 'generic');
create type public.measure_unit as enum ('pc', 'g', 'kg', 'ml', 'l');
create type public.pack_unit_kind as enum ('piece', 'dozen', 'inner', 'carton');
create type public.price_tier_kind as enum ('segment', 'area');
create type public.scheme_kind as enum ('buy_x_get_y', 'slab_discount', 'bundle', 'flat_discount');
create type public.scheme_product_role as enum ('trigger', 'reward', 'bundle_item');
create type public.retailer_account_status as enum ('active', 'on_hold', 'blocked');

-- ---------------------------------------------------------------------------------------------
-- Master catalog (reference data: readable by everyone, written by admins)
-- ---------------------------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  name_ur text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  manufacturer text,
  logo_path text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
create index brands_created_by_idx on public.brands (created_by);
create index brands_name_trgm_idx on public.brands using gin (name extensions.gin_trgm_ops);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  name_ur text,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  image_path text,
  tint text check (tint ~ '^[a-z][a-z0-9-]*$'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.categories.tint is 'Design token name for the tile background, e.g. "mint", "awning".';
create index categories_parent_id_idx on public.categories (parent_id);
create index categories_created_by_idx on public.categories (created_by);
create index categories_name_trgm_idx on public.categories using gin (name extensions.gin_trgm_ops);

create table public.master_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  name_ur text,
  brand_id uuid references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  barcode text unique check (barcode ~ '^[0-9]{8,14}$'),
  sku text unique,
  pack_size_label text,
  net_quantity numeric(12, 3) check (net_quantity > 0),
  net_unit public.measure_unit,
  units_per_carton integer check (units_per_carton > 0),
  mrp_paisa bigint check (mrp_paisa >= 0),
  description text,
  image_path text,
  search_text text generated always as (
    private.search_normalize(
      coalesce(name, '') || ' ' || coalesce(name_ur, '') || ' ' || coalesce(pack_size_label, '') || ' ' ||
      coalesce(sku, '') || ' ' || coalesce(barcode, '')
    )
  ) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null
);
comment on column public.master_products.mrp_paisa is 'Reference MRP per piece; distributors and shops set their own.';
create index master_products_brand_id_idx on public.master_products (brand_id);
create index master_products_category_id_idx on public.master_products (category_id);
create index master_products_created_by_idx on public.master_products (created_by);
create index master_products_search_trgm_idx on public.master_products using gin (search_text extensions.gin_trgm_ops);

-- Search/voice lexicon: Roman Urdu, Urdu script and common mishearings that point at a
-- product, brand or category (e.g. "taapal" -> Tapal, "cheeni" -> Sugar).
create table public.product_aliases (
  id uuid primary key default gen_random_uuid(),
  target_type public.alias_target_type not null,
  master_product_id uuid references public.master_products (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  target_id uuid generated always as (coalesce(master_product_id, brand_id, category_id)) stored,
  alias text not null check (char_length(alias) between 1 and 80),
  alias_normalized text generated always as (private.search_normalize(alias)) stored,
  language public.app_locale not null default 'ur-Latn',
  kind public.alias_kind not null default 'spelling',
  weight real not null default 1 check (weight > 0 and weight <= 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (num_nonnulls(master_product_id, brand_id, category_id) = 1),
  check ((target_type = 'product') = (master_product_id is not null)),
  check ((target_type = 'brand') = (brand_id is not null)),
  check ((target_type = 'category') = (category_id is not null))
);
create unique index product_aliases_target_alias_key on public.product_aliases (target_type, target_id, alias_normalized);
create index product_aliases_master_product_id_idx on public.product_aliases (master_product_id);
create index product_aliases_brand_id_idx on public.product_aliases (brand_id);
create index product_aliases_category_id_idx on public.product_aliases (category_id);
create index product_aliases_created_by_idx on public.product_aliases (created_by);
create index product_aliases_alias_trgm_idx on public.product_aliases using gin (alias_normalized extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------------------------
-- Distributor catalog
-- ---------------------------------------------------------------------------------------------
create table public.distributor_products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  master_product_id uuid references public.master_products (id) on delete set null,
  name text not null check (char_length(name) between 2 and 160),
  name_ur text,
  sku text not null check (char_length(sku) between 1 and 64),
  barcode text check (barcode ~ '^[0-9]{8,14}$'),
  brand_id uuid references public.brands (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  description text,
  pack_size_label text,
  image_path text,
  mrp_paisa bigint not null default 0 check (mrp_paisa >= 0),
  trade_price_paisa bigint not null check (trade_price_paisa >= 0),
  moq_base_qty integer not null default 1 check (moq_base_qty > 0),
  visible_area_ids uuid[],
  is_active boolean not null default true,
  search_text text generated always as (
    private.search_normalize(
      coalesce(name, '') || ' ' || coalesce(name_ur, '') || ' ' || coalesce(pack_size_label, '') || ' ' ||
      coalesce(sku, '') || ' ' || coalesce(barcode, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, sku)
);
comment on column public.distributor_products.mrp_paisa is 'MRP per piece (base unit).';
comment on column public.distributor_products.trade_price_paisa is 'Default trade price per piece; price tiers override it.';
comment on column public.distributor_products.visible_area_ids is 'Service areas where retailers see this product; null = everywhere the distributor serves.';
create unique index distributor_products_org_barcode_key on public.distributor_products (org_id, barcode) where barcode is not null;
create index distributor_products_master_product_id_idx on public.distributor_products (master_product_id);
create index distributor_products_brand_id_idx on public.distributor_products (brand_id);
create index distributor_products_category_id_idx on public.distributor_products (category_id);
create index distributor_products_created_by_idx on public.distributor_products (created_by);
create index distributor_products_search_trgm_idx on public.distributor_products using gin (search_text extensions.gin_trgm_ops);
create index distributor_products_visible_area_ids_idx on public.distributor_products using gin (visible_area_ids);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  master_product_id uuid references public.master_products (id) on delete cascade,
  distributor_product_id uuid references public.distributor_products (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  path text not null check (char_length(path) between 3 and 512),
  sort_order integer not null default 0,
  alt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (num_nonnulls(master_product_id, distributor_product_id) = 1),
  check ((distributor_product_id is null) = (org_id is null))
);
comment on column public.product_images.org_id is 'Owner of a distributor product image; derived from distributor_product_id.';
create index product_images_master_product_id_idx on public.product_images (master_product_id);
create index product_images_distributor_product_id_idx on public.product_images (distributor_product_id);
create index product_images_org_id_idx on public.product_images (org_id);
create index product_images_created_by_idx on public.product_images (created_by);

create table public.pack_units (
  id uuid primary key default gen_random_uuid(),
  distributor_product_id uuid not null references public.distributor_products (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  unit public.pack_unit_kind not null,
  label text not null check (char_length(label) between 1 and 60),
  base_qty integer not null check (base_qty > 0),
  barcode text check (barcode ~ '^[0-9]{8,14}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (distributor_product_id, unit),
  check (unit <> 'piece' or base_qty = 1),
  check (unit <> 'dozen' or base_qty = 12)
);
comment on column public.pack_units.base_qty is 'Pieces per pack, e.g. 24 for a carton of 24.';
create unique index pack_units_one_default on public.pack_units (distributor_product_id) where is_default;
create index pack_units_org_id_idx on public.pack_units (org_id);
create index pack_units_created_by_idx on public.pack_units (created_by);

create table public.price_tiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text,
  kind public.price_tier_kind not null,
  segment public.shop_tier,
  area_id uuid references public.service_areas (id) on delete cascade,
  priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, name),
  check (
    (kind = 'segment' and segment is not null and area_id is null)
    or (kind = 'area' and area_id is not null and segment is null)
  )
);
create index price_tiers_area_id_idx on public.price_tiers (area_id);
create index price_tiers_created_by_idx on public.price_tiers (created_by);

create table public.price_tier_items (
  id uuid primary key default gen_random_uuid(),
  price_tier_id uuid not null references public.price_tiers (id) on delete cascade,
  distributor_product_id uuid not null references public.distributor_products (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  price_paisa bigint not null check (price_paisa >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (price_tier_id, distributor_product_id)
);
comment on column public.price_tier_items.price_paisa is 'Trade price per piece for retailers in this tier.';
create index price_tier_items_distributor_product_id_idx on public.price_tier_items (distributor_product_id);
create index price_tier_items_org_id_idx on public.price_tier_items (org_id);
create index price_tier_items_created_by_idx on public.price_tier_items (created_by);

-- Scheme rules (quantities are pieces; bps = basis points, 100 bps = 1%):
--   buy_x_get_y   {"buy_base_qty": 12, "free_base_qty": 1}  free goods of the reward product
--                 (scheme_products role 'reward'), or of the trigger product itself
--   slab_discount {"basis": "quantity"|"amount", "slabs": [{"min": 24, "discount_bps": 200}, ...]}
--                 min is pieces (quantity) or paisa (amount) of the order line
--   flat_discount {"discount_bps": 500} or {"discount_paisa_per_unit": 200}
--   bundle        {"min_base_qty": 6, "discount_paisa": 5000} per complete set of bundle items
create or replace function private.valid_scheme_rules(p_kind public.scheme_kind, p_rules jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_slab jsonb;
begin
  if p_rules is null or jsonb_typeof(p_rules) <> 'object' then
    return false;
  end if;
  case p_kind
    when 'buy_x_get_y' then
      return coalesce((p_rules ->> 'buy_base_qty') ~ '^[1-9][0-9]{0,6}$', false)
         and coalesce((p_rules ->> 'free_base_qty') ~ '^[1-9][0-9]{0,6}$', false);
    when 'slab_discount' then
      if coalesce(p_rules ->> 'basis', '') not in ('quantity', 'amount')
         or jsonb_typeof(p_rules -> 'slabs') <> 'array'
         or jsonb_array_length(p_rules -> 'slabs') = 0 then
        return false;
      end if;
      for v_slab in select s.value from jsonb_array_elements(p_rules -> 'slabs') as s loop
        if not coalesce((v_slab ->> 'min') ~ '^[1-9][0-9]{0,14}$', false)
           or not coalesce((v_slab ->> 'discount_bps') ~ '^[1-9][0-9]{0,4}$', false)
           or (v_slab ->> 'discount_bps')::integer > 10000 then
          return false;
        end if;
      end loop;
      return true;
    when 'flat_discount' then
      if p_rules ? 'discount_bps' then
        return coalesce((p_rules ->> 'discount_bps') ~ '^[1-9][0-9]{0,4}$', false)
           and (p_rules ->> 'discount_bps')::integer <= 10000;
      end if;
      return coalesce((p_rules ->> 'discount_paisa_per_unit') ~ '^[1-9][0-9]{0,12}$', false);
    when 'bundle' then
      return coalesce((p_rules ->> 'min_base_qty') ~ '^[1-9][0-9]{0,6}$', false)
         and coalesce((p_rules ->> 'discount_paisa') ~ '^[1-9][0-9]{0,12}$', false);
  end case;
  return false;
end;
$$;

create table public.schemes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  name_ur text,
  description text,
  kind public.scheme_kind not null,
  rules jsonb not null check (private.valid_scheme_rules(kind, rules)),
  area_ids uuid[],
  segments public.shop_tier[],
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (ends_at is null or ends_at > starts_at)
);
comment on column public.schemes.area_ids is 'Limit to these service areas; null = all.';
comment on column public.schemes.segments is 'Limit to these shop tiers; null = all.';
create index schemes_org_id_active_idx on public.schemes (org_id, is_active, starts_at);
create index schemes_created_by_idx on public.schemes (created_by);

create table public.scheme_products (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.schemes (id) on delete cascade,
  distributor_product_id uuid not null references public.distributor_products (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.scheme_product_role not null default 'trigger',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (scheme_id, distributor_product_id, role)
);
create index scheme_products_distributor_product_id_idx on public.scheme_products (distributor_product_id);
create index scheme_products_org_id_idx on public.scheme_products (org_id);
create index scheme_products_created_by_idx on public.scheme_products (created_by);

-- ---------------------------------------------------------------------------------------------
-- retailer_accounts: the distributor <-> shop relationship (tier, credit, terms, hold).
--   on_hold  -> credit orders are refused (cash/digital still allowed)
--   blocked  -> all orders are refused
-- ---------------------------------------------------------------------------------------------
create table public.retailer_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  price_tier_id uuid references public.price_tiers (id) on delete set null,
  segment text check (char_length(segment) <= 40),
  credit_limit_paisa bigint not null default 0 check (credit_limit_paisa >= 0),
  payment_terms_days integer not null default 0 check (payment_terms_days between 0 and 365),
  status public.retailer_account_status not null default 'active',
  hold_reason text,
  hold_override_until timestamptz,
  assigned_booker_id uuid references public.org_members (id) on delete set null,
  notes text,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  unique (org_id, shop_id)
);
comment on column public.retailer_accounts.hold_override_until is 'Owner override: auto-hold is skipped and credit orders allowed until this time.';
comment on column public.retailer_accounts.notes is 'Visible to the distributor team and to the shop.';
create index retailer_accounts_shop_id_idx on public.retailer_accounts (shop_id);
create index retailer_accounts_price_tier_id_idx on public.retailer_accounts (price_tier_id);
create index retailer_accounts_assigned_booker_id_idx on public.retailer_accounts (assigned_booker_id);
create index retailer_accounts_created_by_idx on public.retailer_accounts (created_by);

-- ---------------------------------------------------------------------------------------------
-- Tenant derivation / consistency triggers. Child rows inherit org_id from their parent, so a
-- client can never attach a row to another distributor; RLS WITH CHECK then verifies the
-- caller's permission on the derived org (RLS checks run after BEFORE triggers).
-- ---------------------------------------------------------------------------------------------
create or replace function private.tg_inherit_org_from_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if new.distributor_product_id is null then
    if tg_table_name = 'product_images' then
      new.org_id := null;
    end if;
    return new;
  end if;
  select dp.org_id into v_org from public.distributor_products dp where dp.id = new.distributor_product_id;
  if v_org is null then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;
  new.org_id := v_org;
  return new;
end;
$$;

create trigger inherit_org before insert or update of distributor_product_id on public.pack_units
  for each row execute function private.tg_inherit_org_from_product();
create trigger inherit_org before insert or update of distributor_product_id on public.product_images
  for each row execute function private.tg_inherit_org_from_product();

create or replace function private.tg_price_tier_items_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier_org uuid;
  v_product_org uuid;
begin
  select org_id into v_tier_org from public.price_tiers where id = new.price_tier_id;
  select org_id into v_product_org from public.distributor_products where id = new.distributor_product_id;
  if v_tier_org is null or v_product_org is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_tier_org <> v_product_org then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Price tier and product belong to different distributors.';
  end if;
  new.org_id := v_tier_org;
  return new;
end;
$$;
create trigger consistency before insert or update on public.price_tier_items
  for each row execute function private.tg_price_tier_items_consistency();

create or replace function private.tg_scheme_products_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scheme_org uuid;
  v_product_org uuid;
begin
  select org_id into v_scheme_org from public.schemes where id = new.scheme_id;
  select org_id into v_product_org from public.distributor_products where id = new.distributor_product_id;
  if v_scheme_org is null or v_product_org is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_scheme_org <> v_product_org then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Scheme and product belong to different distributors.';
  end if;
  new.org_id := v_scheme_org;
  return new;
end;
$$;
create trigger consistency before insert or update on public.scheme_products
  for each row execute function private.tg_scheme_products_consistency();

create or replace function private.tg_retailer_accounts_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.price_tier_id is not null
     and not exists (select 1 from public.price_tiers t where t.id = new.price_tier_id and t.org_id = new.org_id) then
    raise exception 'tenant_mismatch' using errcode = '23514', detail = 'Price tier belongs to another distributor.';
  end if;
  if new.assigned_booker_id is not null
     and not exists (
       select 1 from public.org_members m
        where m.id = new.assigned_booker_id and m.org_id = new.org_id and m.role = 'booker'
     ) then
    raise exception 'invalid_booker' using errcode = '23514', detail = 'Assigned booker must be a booker of this distributor.';
  end if;
  return new;
end;
$$;
create trigger consistency before insert or update on public.retailer_accounts
  for each row execute function private.tg_retailer_accounts_consistency();

-- Map distributor products to the master catalog by barcode when not mapped explicitly.
create or replace function private.tg_distributor_products_map_master()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.master_product_id is null and new.barcode is not null then
    select mp.id into new.master_product_id from public.master_products mp where mp.barcode = new.barcode;
  end if;
  return new;
end;
$$;
create trigger map_master before insert or update of barcode, master_product_id on public.distributor_products
  for each row execute function private.tg_distributor_products_map_master();

-- ---------------------------------------------------------------------------------------------
-- Row metadata + RLS
-- ---------------------------------------------------------------------------------------------
create trigger set_row_metadata before insert or update on public.brands for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.categories for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.master_products for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.product_aliases for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.distributor_products for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.product_images for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.pack_units for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.price_tiers for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.price_tier_items for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.schemes for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.scheme_products for each row execute function private.set_row_metadata();
create trigger set_row_metadata before insert or update on public.retailer_accounts for each row execute function private.set_row_metadata();

alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.master_products enable row level security;
alter table public.product_aliases enable row level security;
alter table public.distributor_products enable row level security;
alter table public.product_images enable row level security;
alter table public.pack_units enable row level security;
alter table public.price_tiers enable row level security;
alter table public.price_tier_items enable row level security;
alter table public.schemes enable row level security;
alter table public.scheme_products enable row level security;
alter table public.retailer_accounts enable row level security;
