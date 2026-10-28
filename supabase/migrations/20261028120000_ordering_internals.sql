-- =============================================================================================
-- Phase 2 internals: what a shop can order and at what price, scheme maths, stock availability,
-- delivery slots, the priced cart, and ledger helpers. Private schema only; the public RPCs in
-- the next migration call these. One pricing path (price_cart) serves the cart screen and
-- place_order, so what the dukandar sees is exactly what gets ordered.
-- =============================================================================================

-- The row every catalog read returns (search, browse, home feed, product detail, cart lines).
create type public.catalog_item as (
  distributor_product_id uuid,
  org_id uuid,
  org_name text,
  master_product_id uuid,
  name text,
  name_ur text,
  brand_id uuid,
  brand_name text,
  brand_slug text,
  category_id uuid,
  category_slug text,
  pack_size_label text,
  image_path text,
  mrp_paisa bigint,
  price_paisa bigint,
  moq_base_qty integer,
  pack_units jsonb,
  scheme jsonb,
  in_stock boolean,
  available_base_qty integer,
  rank real
);
comment on type public.catalog_item is
  'A distributor product as one shop sees it: its price for that shop, best live scheme, pack units and stock.';

-- ---------------------------------------------------------------------------------------------
-- Who may buy for a shop: its staff with the "orders" permission (owners hold every
-- permission), or a booker of a distributor that covers the shop. Returns the booker's
-- org_members.id when a booker is acting, else null.
-- ---------------------------------------------------------------------------------------------
create or replace function private.require_shop_buyer(p_shop_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_member uuid;
begin
  if p_shop_id is null then
    raise exception 'shop_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.shops s where s.id = p_shop_id and s.status = 'approved') then
    raise exception 'shop_not_available' using errcode = '55000', detail = p_shop_id::text;
  end if;
  if private.has_shop_permission(p_shop_id, 'orders') then
    return null;
  end if;
  select m.id into v_member
    from public.org_members m
    join public.organizations o on o.id = m.org_id and o.status = 'approved'
   where m.user_id = v_uid
     and m.status = 'active'
     and m.role = 'booker'
     and (
       exists (select 1 from public.retailer_accounts ra where ra.shop_id = p_shop_id and ra.assigned_booker_id = m.id)
       or exists (
         select 1 from public.beat_shops bs join public.beats b on b.id = bs.beat_id
          where bs.shop_id = p_shop_id and b.booker_id = m.id
       )
     )
   order by m.created_at
   limit 1;
  if v_member is null then
    raise exception 'not_allowed' using errcode = '42501', detail = 'You cannot order for this shop.';
  end if;
  return v_member;
end;
$$;

-- The shop's zone and its city: distributor coverage and area prices are set at either level.
create or replace function private.shop_area_ids(p_shop_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_remove(array[s.area_id, a.parent_id], null), '{}'::uuid[])
    from public.shops s
    left join public.service_areas a on a.id = s.area_id
   where s.id = p_shop_id
$$;

-- Distributors a shop can order from: approved and delivering to the shop's area, or already
-- holding an account for the shop. A booker only sees their own distributor.
create or replace function private.orderable_org_ids(p_shop_id uuid, p_booker uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with booker_org as (
    select m.org_id from public.org_members m where m.id = p_booker
  )
  select o.id
    from public.organizations o
   where o.status = 'approved'
     and (o.served_area_ids is null or o.served_area_ids && private.shop_area_ids(p_shop_id))
     and (p_booker is null or o.id in (select org_id from booker_org))
  union
  select ra.org_id
    from public.retailer_accounts ra
    join public.organizations o on o.id = ra.org_id and o.status = 'approved'
   where ra.shop_id = p_shop_id
     and (p_booker is null or ra.org_id in (select org_id from booker_org))
$$;

-- A scheme is live for a shop when it is active, inside its dates and aimed at the shop's
-- area and tier (null lists mean "everyone").
create or replace function private.scheme_is_live(
  p_scheme public.schemes,
  p_area_ids uuid[],
  p_tier public.shop_tier
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_scheme.is_active
     and p_scheme.starts_at <= now()
     and (p_scheme.ends_at is null or p_scheme.ends_at > now())
     and (p_scheme.area_ids is null or p_scheme.area_ids && coalesce(p_area_ids, '{}'::uuid[]))
     and (p_scheme.segments is null or p_tier = any (p_scheme.segments))
$$;

-- ---------------------------------------------------------------------------------------------
-- catalog_rows(shop, booker, ids): every product the shop can order (optionally only `ids`),
-- priced for the shop. Price precedence: the retailer account's price tier, then an area tier
-- for the shop's zone or city (zone first, then priority), then the trade price.
-- Stock: unexpired on-hand minus reserved across active warehouses; null when the distributor
-- keeps no stock records at all (then everything counts as in stock).
-- ---------------------------------------------------------------------------------------------
create or replace function private.catalog_rows(p_shop_id uuid, p_booker uuid, p_ids uuid[] default null)
returns setof public.catalog_item
language sql
stable
security definer
set search_path = ''
as $$
  with shop as (
    select s.id, s.tier, s.area_id, private.shop_area_ids(s.id) as areas
      from public.shops s
     where s.id = p_shop_id
  ),
  orgs as (
    select private.orderable_org_ids(p_shop_id, p_booker) as org_id
  )
  select
    dp.id,
    dp.org_id,
    o.name,
    dp.master_product_id,
    dp.name,
    coalesce(dp.name_ur, mp.name_ur),
    dp.brand_id,
    b.name,
    b.slug,
    dp.category_id,
    c.slug,
    coalesce(dp.pack_size_label, mp.pack_size_label),
    coalesce(dp.image_path, mp.image_path),
    dp.mrp_paisa,
    coalesce(account_price.price_paisa, area_price.price_paisa, dp.trade_price_paisa),
    dp.moq_base_qty,
    coalesce(units.pack_units, '[]'::jsonb),
    best_scheme.scheme,
    (not tracking.tracks or coalesce(stock.available, 0) > 0),
    case when tracking.tracks then coalesce(stock.available, 0) end,
    0::real
  from public.distributor_products dp
  cross join shop
  join public.organizations o on o.id = dp.org_id
  left join public.master_products mp on mp.id = dp.master_product_id
  left join public.brands b on b.id = dp.brand_id
  left join public.categories c on c.id = dp.category_id
  left join lateral (
    select pti.price_paisa
      from public.retailer_accounts ra
      join public.price_tiers t on t.id = ra.price_tier_id and t.is_active
      join public.price_tier_items pti on pti.price_tier_id = t.id and pti.distributor_product_id = dp.id
     where ra.org_id = dp.org_id and ra.shop_id = shop.id
  ) account_price on true
  left join lateral (
    select pti.price_paisa
      from public.price_tiers t
      join public.price_tier_items pti on pti.price_tier_id = t.id and pti.distributor_product_id = dp.id
     where t.org_id = dp.org_id
       and t.kind = 'area'
       and t.is_active
       and t.area_id = any (shop.areas)
     order by (t.area_id = shop.area_id) desc, t.priority desc, t.created_at
     limit 1
  ) area_price on true
  left join lateral (
    select jsonb_agg(
             jsonb_build_object(
               'id', pu.id, 'unit', pu.unit, 'label', pu.label, 'base_qty', pu.base_qty,
               'is_default', pu.is_default
             )
             order by pu.base_qty
           ) as pack_units
      from public.pack_units pu
     where pu.distributor_product_id = dp.id
  ) units on true
  left join lateral (
    select jsonb_build_object(
             'id', s.id, 'kind', s.kind, 'name', s.name, 'name_ur', s.name_ur, 'rules', s.rules,
             'ends_at', s.ends_at
           ) as scheme
      from public.scheme_products sp
      join public.schemes s on s.id = sp.scheme_id
     where sp.distributor_product_id = dp.id
       and sp.role in ('trigger', 'bundle_item')
       and private.scheme_is_live(s, shop.areas, shop.tier)
     order by s.priority desc, s.starts_at desc, s.id
     limit 1
  ) best_scheme on true
  left join lateral (
    select exists (select 1 from public.stock_batches sb where sb.org_id = dp.org_id) as tracks
  ) tracking on true
  left join lateral (
    select sum(sb.qty_on_hand - sb.qty_reserved)::integer as available
      from public.stock_batches sb
      join public.warehouses w on w.id = sb.warehouse_id and w.is_active
     where sb.distributor_product_id = dp.id
       and (sb.expiry_date is null or sb.expiry_date > private.pkt_today())
  ) stock on true
  where dp.is_active
    and dp.org_id in (select org_id from orgs)
    and (dp.visible_area_ids is null or dp.visible_area_ids && shop.areas)
    and (p_ids is null or dp.id = any (p_ids))
$$;

-- ---------------------------------------------------------------------------------------------
-- Scheme maths for one order line (pieces and paisa). Bundles are priced across lines by
-- price_cart, so a bundle scheme has no line-level effect here.
--   buy_x_get_y   free = floor(base_qty / buy) * free
--   slab_discount the highest slab reached (by pieces or line amount), in basis points
--   flat_discount basis points of the line, or paisa per piece, capped at the line amount
-- ---------------------------------------------------------------------------------------------
create or replace function private.scheme_line_effect(
  p_kind public.scheme_kind,
  p_rules jsonb,
  p_base_qty integer,
  p_gross_paisa bigint,
  out free_base_qty integer,
  out discount_paisa bigint
)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_bps integer;
begin
  free_base_qty := 0;
  discount_paisa := 0;
  if p_kind is null or p_rules is null or coalesce(p_base_qty, 0) <= 0 then
    return;
  end if;
  case p_kind
    when 'buy_x_get_y' then
      free_base_qty := (p_base_qty / (p_rules ->> 'buy_base_qty')::integer) * (p_rules ->> 'free_base_qty')::integer;
    when 'slab_discount' then
      select (s.value ->> 'discount_bps')::integer into v_bps
        from jsonb_array_elements(p_rules -> 'slabs') as s
       where (s.value ->> 'min')::bigint <= case when p_rules ->> 'basis' = 'amount' then p_gross_paisa else p_base_qty end
       order by (s.value ->> 'min')::bigint desc
       limit 1;
      discount_paisa := coalesce(p_gross_paisa * v_bps / 10000, 0);
    when 'flat_discount' then
      if p_rules ? 'discount_bps' then
        discount_paisa := p_gross_paisa * (p_rules ->> 'discount_bps')::integer / 10000;
      else
        discount_paisa := least(p_base_qty::bigint * (p_rules ->> 'discount_paisa_per_unit')::bigint, p_gross_paisa);
      end if;
    else
      null;
  end case;
end;
$$;

-- What the shop owes the distributor: the distributor's receivable account for this shop.
create or replace function private.receivable_balance(p_org_id uuid, p_shop_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(e.debit_paisa - e.credit_paisa), 0)::bigint
    from public.ledger_entries e
    join public.ledger_accounts a on a.id = e.account_id and a.code = 'receivable'
   where e.org_id = p_org_id
     and e.counterparty_shop_id = p_shop_id
     and e.deleted_at is null
$$;

-- Credit already promised to undelivered credit orders.
create or replace function private.open_credit_paisa(p_org_id uuid, p_shop_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(o.total_paisa), 0)::bigint
    from public.orders o
   where o.org_id = p_org_id
     and o.shop_id = p_shop_id
     and o.payment_method = 'credit'
     and o.status in ('new', 'confirmed', 'picking', 'packed', 'dispatched')
     and o.deleted_at is null
$$;

-- ---------------------------------------------------------------------------------------------
-- Delivery slots: two-hour windows 10:00-18:00 Asia/Karachi on the distributor's delivery days
-- (ISO weekdays, default Monday-Saturday), from tomorrow, or the day after once today's order
-- cutoff (default 18:00) has passed. p_days counts delivery days, not slots.
-- ---------------------------------------------------------------------------------------------
create or replace function private.delivery_slots_for(p_org_id uuid, p_days integer default 5)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings jsonb;
  v_cutoff time;
  v_days integer[];
  v_now timestamp := now() at time zone 'Asia/Karachi';
  v_day date;
  v_found integer := 0;
  v_hour integer;
begin
  select o.settings into v_settings from public.organizations o where o.id = p_org_id;
  if not found then
    return;
  end if;
  v_cutoff := coalesce((v_settings ->> 'order_cutoff_time')::time, time '18:00');
  select coalesce(array_agg(d.value::integer), array[1, 2, 3, 4, 5, 6])
    into v_days
    from jsonb_array_elements_text(coalesce(v_settings -> 'delivery_days', '[]'::jsonb)) as d;
  if cardinality(v_days) = 0 then
    v_days := array[1, 2, 3, 4, 5, 6];
  end if;
  v_day := v_now::date + case when v_now::time < v_cutoff then 1 else 2 end;
  for i in 1..21 loop
    exit when v_found >= greatest(coalesce(p_days, 5), 1);
    if extract(isodow from v_day)::integer = any (v_days) then
      foreach v_hour in array array[10, 12, 14, 16] loop
        slot_start := (v_day + make_time(v_hour, 0, 0)) at time zone 'Asia/Karachi';
        slot_end := (v_day + make_time(v_hour + 2, 0, 0)) at time zone 'Asia/Karachi';
        return next;
      end loop;
      v_found := v_found + 1;
    end if;
    v_day := v_day + 1;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- price_cart(shop, user, booker, org_ids): the cart priced exactly as place_order will order
-- it, split per distributor. Shape: see cart_summary in the next migration. Line problems:
--   inactive            the product is no longer orderable
--   below_moq           fewer pieces than the product's minimum
--   out_of_stock /
--   insufficient_stock  only when the distributor enforces stock (settings.enforce_stock,
--                       default true) and keeps stock records
-- ---------------------------------------------------------------------------------------------
create or replace function private.price_cart(
  p_shop_id uuid,
  p_user_id uuid,
  p_booker uuid,
  p_org_ids uuid[] default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cart as (
    select c.id from public.carts c where c.shop_id = p_shop_id and c.user_id = p_user_id
  ),
  raw as (
    select ci.id as cart_item_id, ci.created_at as added_at, ci.distributor_product_id, ci.org_id,
           ci.pack_unit_id, ci.quantity, pu.label as pack_label, pu.base_qty as base_qty_per_unit
      from public.cart_items ci
      join public.pack_units pu on pu.id = ci.pack_unit_id
     where ci.cart_id in (select id from cart)
       and (p_org_ids is null or ci.org_id = any (p_org_ids))
  ),
  cat as (
    select *
      from private.catalog_rows(
        p_shop_id, p_booker, (select coalesce(array_agg(distinct raw.distributor_product_id), '{}'::uuid[]) from raw)
      )
  ),
  lines as (
    select r.*,
           c as item,
           (c.distributor_product_id is not null) as orderable,
           c.scheme,
           c.moq_base_qty,
           c.available_base_qty,
           coalesce(c.price_paisa, 0) as piece_price,
           coalesce(c.price_paisa, 0) * r.base_qty_per_unit as unit_price,
           r.quantity * r.base_qty_per_unit as base_qty,
           r.quantity::bigint * coalesce(c.price_paisa, 0) * r.base_qty_per_unit as gross,
           coalesce((o.settings ->> 'enforce_stock')::boolean, true) as enforce_stock
      from raw r
      left join cat c on c.distributor_product_id = r.distributor_product_id
      join public.organizations o on o.id = r.org_id
  ),
  effects as (
    select l.*, e.free_base_qty, e.discount_paisa
      from lines l
      cross join lateral private.scheme_line_effect(
        case when l.orderable then (l.scheme ->> 'kind')::public.scheme_kind end,
        l.scheme -> 'rules', l.base_qty, l.gross
      ) e
  ),
  bundle_schemes as (
    select distinct e.org_id, (e.scheme ->> 'id')::uuid as scheme_id,
           (e.scheme -> 'rules' ->> 'min_base_qty')::integer as min_qty,
           (e.scheme -> 'rules' ->> 'discount_paisa')::bigint as set_discount
      from effects e
     where e.orderable and e.scheme ->> 'kind' = 'bundle'
  ),
  bundle_sets as (
    select bs.org_id, bs.scheme_id, bs.set_discount,
           min(
             coalesce(
               (select sum(e2.base_qty) from effects e2
                 where e2.org_id = bs.org_id and e2.orderable and e2.distributor_product_id = sp.distributor_product_id),
               0
             ) / bs.min_qty
           ) as sets
      from bundle_schemes bs
      join public.scheme_products sp on sp.scheme_id = bs.scheme_id and sp.role = 'bundle_item'
     group by bs.org_id, bs.scheme_id, bs.set_discount
  ),
  bundle_lines as (
    select distinct on (bs.org_id, bs.scheme_id)
           e.cart_item_id, least(bs.sets * bs.set_discount, e.gross) as discount
      from bundle_sets bs
      join effects e on e.org_id = bs.org_id and e.orderable and (e.scheme ->> 'id')::uuid = bs.scheme_id
     where bs.sets > 0
     order by bs.org_id, bs.scheme_id, e.added_at, e.cart_item_id
  ),
  final as (
    select e.*,
           e.discount_paisa + coalesce(bl.discount, 0) as line_discount,
           array_remove(array[
             case when not e.orderable then 'inactive' end,
             case when e.orderable and e.base_qty < e.moq_base_qty then 'below_moq' end,
             case
               when e.orderable and e.enforce_stock and e.available_base_qty is not null
                    and e.available_base_qty <= 0 then 'out_of_stock'
               when e.orderable and e.enforce_stock and e.available_base_qty is not null
                    and e.available_base_qty < e.base_qty + e.free_base_qty then 'insufficient_stock'
             end
           ], null) as problems
      from effects e
      left join bundle_lines bl on bl.cart_item_id = e.cart_item_id
  ),
  groups as (
    select f.org_id,
           sum(f.gross)::bigint as subtotal,
           sum(f.line_discount)::bigint as scheme_discount,
           jsonb_agg(
             jsonb_build_object(
               'cart_item_id', f.cart_item_id,
               'distributor_product_id', f.distributor_product_id,
               'item', case when f.orderable then to_jsonb(f.item) end,
               'pack_unit_id', f.pack_unit_id,
               'pack_label', f.pack_label,
               'base_qty_per_unit', f.base_qty_per_unit,
               'quantity', f.quantity,
               'piece_price_paisa', f.piece_price,
               'unit_price_paisa', f.unit_price,
               'line_discount_paisa', f.line_discount,
               'line_total_paisa', f.gross - f.line_discount,
               'free_base_qty', f.free_base_qty,
               'scheme_applied', case
                 when f.orderable and (f.free_base_qty > 0 or f.line_discount > 0) then
                   jsonb_build_object('id', f.scheme ->> 'id', 'name', f.scheme ->> 'name', 'name_ur', f.scheme ->> 'name_ur')
               end,
               'problems', to_jsonb(f.problems)
             )
             order by f.added_at, f.cart_item_id
           ) as items
      from final f
     group by f.org_id
  ),
  priced as (
    select g.*,
           o.name as org_name, o.logo_path, o.min_order_paisa, o.delivery_fee_paisa, o.free_delivery_above_paisa,
           ra.status as account_status,
           coalesce(ra.credit_limit_paisa, 0) as credit_limit_paisa,
           g.subtotal - g.scheme_discount as net,
           case
             when o.free_delivery_above_paisa is not null and g.subtotal - g.scheme_discount >= o.free_delivery_above_paisa then 0
             else o.delivery_fee_paisa
           end as delivery_charge
      from groups g
      join public.organizations o on o.id = g.org_id
      left join public.retailer_accounts ra on ra.org_id = g.org_id and ra.shop_id = p_shop_id
  ),
  shaped as (
    select p.subtotal, p.net + p.delivery_charge as total,
           jsonb_build_object(
             'org_id', p.org_id,
             'org_name', p.org_name,
             'logo_path', p.logo_path,
             'account_status', coalesce(p.account_status::text, 'none'),
             'credit_limit_paisa', p.credit_limit_paisa,
             'credit_available_paisa', case
               when p.account_status is null then 0
               else greatest(
                 p.credit_limit_paisa - private.receivable_balance(p.org_id, p_shop_id)
                   - private.open_credit_paisa(p.org_id, p_shop_id),
                 0
               )
             end,
             'min_order_paisa', p.min_order_paisa,
             'delivery_fee_paisa', p.delivery_fee_paisa,
             'free_delivery_above_paisa', p.free_delivery_above_paisa,
             'subtotal_paisa', p.subtotal,
             'scheme_discount_paisa', p.scheme_discount,
             'delivery_charge_paisa', p.delivery_charge,
             'total_paisa', p.net + p.delivery_charge,
             'meets_minimum', p.net >= p.min_order_paisa,
             'short_by_paisa', greatest(p.min_order_paisa - p.net, 0),
             'next_slots', coalesce(
               (select jsonb_agg(jsonb_build_object('start', s.slot_start, 'end', s.slot_end) order by s.slot_start)
                  from (select * from private.delivery_slots_for(p.org_id, 1) limit 3) s),
               '[]'::jsonb
             ),
             'items', p.items
           ) as grp
      from priced p
  )
  select jsonb_build_object(
           'item_count', (select count(*) from raw),
           'total_paisa', coalesce((select sum(s.total) from shaped s), 0),
           'groups', coalesce(
             (select jsonb_agg(s.grp order by s.subtotal desc, s.grp ->> 'org_name') from shaped s),
             '[]'::jsonb
           )
         )
$$;

-- ---------------------------------------------------------------------------------------------
-- Ledger helpers (distributor book). Accounts are created on first use.
-- ---------------------------------------------------------------------------------------------
create or replace function private.org_ledger_account(
  p_org_id uuid,
  p_code public.ledger_account_code,
  p_counterparty_shop_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select a.id into v_id
    from public.ledger_accounts a
   where a.book_type = 'org'
     and a.org_id = p_org_id
     and a.code = p_code
     and a.counterparty_shop_id is not distinct from p_counterparty_shop_id;
  if v_id is null then
    insert into public.ledger_accounts (book_type, org_id, code, name, counterparty_type, counterparty_shop_id)
    values (
      'org', p_org_id, p_code,
      case when p_code = 'receivable'
        then 'Receivable: ' || coalesce((select s.name from public.shops s where s.id = p_counterparty_shop_id), 'shop')
        else initcap(replace(p_code::text, '_', ' '))
      end,
      case when p_counterparty_shop_id is not null then 'shop'::public.counterparty_type end,
      p_counterparty_shop_id
    )
    on conflict do nothing
    returning id into v_id;
    if v_id is null then
      select a.id into v_id
        from public.ledger_accounts a
       where a.book_type = 'org' and a.org_id = p_org_id and a.code = p_code
         and a.counterparty_shop_id is not distinct from p_counterparty_shop_id;
    end if;
  end if;
  return v_id;
end;
$$;

-- Releases any stock still reserved for an order (cancellations before dispatch).
create or replace function private.release_order_reservations(p_order_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select m.batch_id, m.warehouse_id, m.org_id, m.distributor_product_id, sum(m.quantity)::integer as held
      from public.stock_movements m
     where m.reference_type = 'order'
       and m.reference_id = p_order_id
       and m.movement_type in ('reserve', 'release')
     group by m.batch_id, m.warehouse_id, m.org_id, m.distributor_product_id
    having sum(m.quantity) > 0
  loop
    update public.stock_batches
       set qty_reserved = greatest(qty_reserved - r.held, 0)
     where id = r.batch_id;
    insert into public.stock_movements (org_id, warehouse_id, batch_id, distributor_product_id, movement_type, quantity, reference_type, reference_id, reason)
    values (r.org_id, r.warehouse_id, r.batch_id, r.distributor_product_id, 'release', -r.held, 'order', p_order_id, p_reason);
  end loop;
end;
$$;
