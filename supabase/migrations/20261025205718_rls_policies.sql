-- =============================================================================================
-- Row Level Security: helpers, privileges and policies for every public table.
--
-- Model (PLAN.md §6.2):
--   * Helpers live in `private`, are SECURITY DEFINER + STABLE with an empty search_path, and are
--     always called as (select private.fn()) so Postgres evaluates them once per statement.
--   * Shop rows: shop_id in (select private.shop_ids_with_any_permission(...)). Owners hold every
--     shop permission; other staff only the permissions listed on their membership.
--   * Org rows: org_id in (select private.org_ids_with_any_permission(...)). Role defaults:
--     owner = all; manager = all but billing.manage/team.manage; accountant = orders.view,
--     credit.manage, collections.manage, analytics.view; warehouse = orders.view, orders.manage,
--     warehouse.manage; booker/rider = none (they see only what is assigned to them).
--   * Financial and stock tables have NO client write policies and their INSERT/UPDATE/DELETE
--     privileges are revoked from `authenticated`: writes go through RPCs.
--   * Soft-deleted financial rows are hidden from everyone but platform staff.
--   * One policy per (table, command, role); no FOR ALL policies.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'admin'
  )
$$;

create or replace function private.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role in ('admin', 'support')
  )
$$;

create or replace function private.org_role_permissions(p_role public.org_member_role)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'owner' then array[
      'orders.view', 'orders.manage', 'catalog.manage', 'pricing.manage', 'warehouse.manage',
      'retailers.manage', 'credit.manage', 'collections.manage', 'delivery.manage', 'field.manage',
      'promotions.manage', 'analytics.view', 'team.manage', 'billing.manage', 'integrations.manage',
      'settings.manage'
    ]
    when 'manager' then array[
      'orders.view', 'orders.manage', 'catalog.manage', 'pricing.manage', 'warehouse.manage',
      'retailers.manage', 'credit.manage', 'collections.manage', 'delivery.manage', 'field.manage',
      'promotions.manage', 'analytics.view', 'integrations.manage', 'settings.manage'
    ]
    when 'accountant' then array['orders.view', 'credit.manage', 'collections.manage', 'analytics.view']
    when 'warehouse' then array['orders.view', 'orders.manage', 'warehouse.manage']
    else '{}'::text[]
  end
$$;

-- Shops ---------------------------------------------------------------------------------------
create or replace function private.my_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ss.shop_id from public.shop_staff ss
   where ss.user_id = (select auth.uid()) and ss.status = 'active'
$$;

create or replace function private.shop_ids_with_any_permission(p_perms text[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ss.shop_id from public.shop_staff ss
   where ss.user_id = (select auth.uid())
     and ss.status = 'active'
     and (ss.role = 'owner' or ss.permissions && p_perms)
$$;

create or replace function private.shop_ids_with_permission(p_perm text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ss.shop_id from public.shop_staff ss
   where ss.user_id = (select auth.uid())
     and ss.status = 'active'
     and (ss.role = 'owner' or p_perm = any (ss.permissions))
$$;

create or replace function private.has_shop_permission(p_shop_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_staff ss
     where ss.shop_id = p_shop_id
       and ss.user_id = (select auth.uid())
       and ss.status = 'active'
       and (ss.role = 'owner' or p_perm = any (ss.permissions))
  )
$$;

create or replace function private.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_staff ss
     where ss.shop_id = p_shop_id and ss.user_id = (select auth.uid()) and ss.status = 'active' and ss.role = 'owner'
  )
$$;

-- Organizations -------------------------------------------------------------------------------
create or replace function private.my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.org_members m
   where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function private.org_ids_with_any_permission(p_perms text[])
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.org_members m
   where m.user_id = (select auth.uid())
     and m.status = 'active'
     and (m.permissions && p_perms or private.org_role_permissions(m.role) && p_perms)
$$;

create or replace function private.org_ids_with_permission(p_perm text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.org_id from public.org_members m
   where m.user_id = (select auth.uid())
     and m.status = 'active'
     and (p_perm = any (m.permissions) or p_perm = any (private.org_role_permissions(m.role)))
$$;

create or replace function private.has_org_permission(p_org_id uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
     where m.org_id = p_org_id
       and m.user_id = (select auth.uid())
       and m.status = 'active'
       and (p_perm = any (m.permissions) or p_perm = any (private.org_role_permissions(m.role)))
  )
$$;

create or replace function private.is_org_owner(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.org_members m
     where m.org_id = p_org_id and m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'owner'
  )
$$;

create or replace function private.my_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.org_members m
   where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

-- Field force ---------------------------------------------------------------------------------
create or replace function private.my_rider_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.id from public.riders r
    join public.org_members m on m.id = r.member_id
   where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function private.my_trip_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id from public.trips t
   where t.rider_id in (
     select r.id from public.riders r join public.org_members m on m.id = r.member_id
      where m.user_id = (select auth.uid()) and m.status = 'active'
   )
$$;

create or replace function private.my_beat_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id from public.beats b
   where b.booker_id in (
     select m.id from public.org_members m where m.user_id = (select auth.uid()) and m.status = 'active'
   )
$$;

-- Orders a booker booked or a rider carries.
create or replace function private.my_field_order_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from public.orders o
   where o.booker_id in (
     select m.id from public.org_members m where m.user_id = (select auth.uid()) and m.status = 'active'
   )
  union
  select ts.order_id from public.trip_stops ts
   where ts.trip_id in (
     select t.id from public.trips t
       join public.riders r on r.id = t.rider_id
       join public.org_members m on m.id = r.member_id
      where m.user_id = (select auth.uid()) and m.status = 'active'
   )
$$;

-- Shops a booker covers: assigned retailer accounts and shops on their beats.
create or replace function private.my_booker_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ra.shop_id from public.retailer_accounts ra
   where ra.assigned_booker_id in (
     select m.id from public.org_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'booker'
   )
  union
  select bs.shop_id from public.beat_shops bs
    join public.beats b on b.id = bs.beat_id
   where b.booker_id in (
     select m.id from public.org_members m where m.user_id = (select auth.uid()) and m.status = 'active' and m.role = 'booker'
   )
$$;

-- Shops a distributor team member may see: retailers of orgs where they hold a retailer-facing
-- permission, a booker's own shops, and shops on a rider's trips.
create or replace function private.org_visible_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ra.shop_id from public.retailer_accounts ra
   where ra.org_id in (
     select m.org_id from public.org_members m
      where m.user_id = (select auth.uid())
        and m.status = 'active'
        and (
          m.permissions && array['orders.view', 'orders.manage', 'retailers.manage', 'credit.manage', 'collections.manage', 'delivery.manage', 'field.manage', 'analytics.view']
          or private.org_role_permissions(m.role) && array['orders.view', 'orders.manage', 'retailers.manage', 'credit.manage', 'collections.manage', 'delivery.manage', 'field.manage', 'analytics.view']
        )
   )
  union
  select private.my_booker_shop_ids()
  union
  select ts.shop_id from public.trip_stops ts where ts.trip_id in (select private.my_trip_ids())
$$;

-- Trips currently carrying an order for one of my shops (live tracking).
create or replace function private.shop_tracking_trip_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ts.trip_id from public.trip_stops ts
   where ts.status in ('pending', 'arrived')
     and ts.shop_id in (
       select ss.shop_id from public.shop_staff ss
        where ss.user_id = (select auth.uid()) and ss.status = 'active'
          and (ss.role = 'owner' or 'orders' = any (ss.permissions))
     )
$$;

-- Marketplace ---------------------------------------------------------------------------------

-- Service areas of my approved shops, plus their parent (city) areas.
create or replace function private.my_shop_area_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct a.id), '{}'::uuid[])
    from public.shop_staff ss
    join public.shops s on s.id = ss.shop_id and s.status = 'approved'
    join public.service_areas a on a.id = s.area_id or a.id = (select z.parent_id from public.service_areas z where z.id = s.area_id)
   where ss.user_id = (select auth.uid()) and ss.status = 'active'
$$;

-- Distributors my shops already deal with.
create or replace function private.my_retailer_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ra.org_id from public.retailer_accounts ra
   where ra.status <> 'blocked'
     and ra.shop_id in (select ss.shop_id from public.shop_staff ss where ss.user_id = (select auth.uid()) and ss.status = 'active')
$$;

-- Distributors a dukandar may browse: approved and serving one of my shops' areas, plus those
-- my shops already have an account with.
create or replace function private.marketplace_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select o.id from public.organizations o
   where o.status = 'approved'
     and exists (
       select 1 from public.shop_staff ss join public.shops s on s.id = ss.shop_id
        where ss.user_id = (select auth.uid()) and ss.status = 'active' and s.status = 'approved'
     )
     and (o.served_area_ids is null or o.served_area_ids && private.my_shop_area_ids())
  union
  select private.my_retailer_org_ids()
$$;

-- People ---------------------------------------------------------------------------------------
create or replace function private.my_co_member_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select other.user_id from public.shop_staff mine
    join public.shop_staff other on other.shop_id = mine.shop_id
   where mine.user_id = (select auth.uid()) and mine.status = 'active' and other.user_id is not null
  union
  select other.user_id from public.org_members mine
    join public.org_members other on other.org_id = mine.org_id
   where mine.user_id = (select auth.uid()) and mine.status = 'active' and other.user_id is not null
$$;

create or replace function private.my_cart_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.carts c where c.user_id = (select auth.uid())
$$;

-- Khata cards that belong to me as a customer of some dukan.
create or replace function private.my_shop_customer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sc.id from public.shop_customers sc
   where sc.profile_id = (select auth.uid()) and sc.deleted_at is null
$$;

create or replace function private.profile_id_by_phone(p_phone text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where p.phone = p_phone and p.deleted_at is null
$$;

create or replace function private.count_active_owners(p_kind text, p_parent_id uuid, p_excluding uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'org' then (
      select count(*)::integer from public.org_members m
       where m.org_id = p_parent_id and m.role = 'owner' and m.status = 'active' and m.id <> p_excluding
    )
    else (
      select count(*)::integer from public.shop_staff s
       where s.shop_id = p_parent_id and s.role = 'owner' and s.status = 'active' and s.id <> p_excluding
    )
  end
$$;

grant execute on function
  private.is_admin(),
  private.is_platform_staff(),
  private.org_role_permissions(public.org_member_role),
  private.my_shop_ids(),
  private.shop_ids_with_any_permission(text[]),
  private.shop_ids_with_permission(text),
  private.has_shop_permission(uuid, text),
  private.is_shop_owner(uuid),
  private.my_org_ids(),
  private.org_ids_with_any_permission(text[]),
  private.org_ids_with_permission(text),
  private.has_org_permission(uuid, text),
  private.is_org_owner(uuid),
  private.my_member_ids(),
  private.my_rider_ids(),
  private.my_trip_ids(),
  private.my_beat_ids(),
  private.my_field_order_ids(),
  private.my_booker_shop_ids(),
  private.org_visible_shop_ids(),
  private.shop_tracking_trip_ids(),
  private.my_shop_area_ids(),
  private.my_retailer_org_ids(),
  private.marketplace_org_ids(),
  private.my_co_member_user_ids(),
  private.my_cart_ids(),
  private.my_shop_customer_ids(),
  private.profile_id_by_phone(text),
  private.count_active_owners(text, uuid, uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Membership guards for direct client writes (RPCs run as the function owner and skip them).
-- ---------------------------------------------------------------------------------------------
create or replace function private.tg_membership_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text := case when tg_table_name = 'org_members' then 'org' else 'shop' end;
  v_parent uuid;
  v_is_owner boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_parent := case when v_kind = 'org' then (to_jsonb(old) ->> 'org_id')::uuid else (to_jsonb(old) ->> 'shop_id')::uuid end;
  else
    v_parent := case when v_kind = 'org' then (to_jsonb(new) ->> 'org_id')::uuid else (to_jsonb(new) ->> 'shop_id')::uuid end;
  end if;
  v_is_owner := case when v_kind = 'org' then private.is_org_owner(v_parent) else private.is_shop_owner(v_parent) end;

  if tg_op = 'INSERT' then
    if new.role::text = 'owner' and not v_is_owner then
      raise exception 'only_owner_can_manage_owners' using errcode = '42501';
    end if;
    if new.phone is null then
      raise exception 'phone_required' using errcode = '22023', detail = 'Invite team members by phone number.';
    end if;
    -- Existing users join immediately; others when they verify this phone number.
    new.user_id := private.profile_id_by_phone(new.phone);
    if new.user_id is null then
      new.status := 'invited';
      new.joined_at := null;
    else
      new.status := 'active';
      new.joined_at := now();
    end if;
    new.invited_by := auth.uid();
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id or new.phone is distinct from old.phone
       or (to_jsonb(new) ->> 'org_id') is distinct from (to_jsonb(old) ->> 'org_id')
       or (to_jsonb(new) ->> 'shop_id') is distinct from (to_jsonb(old) ->> 'shop_id') then
      raise exception 'immutable_member_fields' using errcode = '42501', detail = 'Remove the member and invite again instead.';
    end if;
    if old.user_id = auth.uid()
       and (new.role is distinct from old.role or new.permissions is distinct from old.permissions or new.status is distinct from old.status) then
      raise exception 'cannot_change_own_access' using errcode = '42501';
    end if;
    if (old.role::text = 'owner' or new.role::text = 'owner')
       and (new.role is distinct from old.role or new.status is distinct from old.status or new.permissions is distinct from old.permissions)
       and not v_is_owner then
      raise exception 'only_owner_can_manage_owners' using errcode = '42501';
    end if;
    if old.role::text = 'owner' and old.status = 'active' and (new.role::text <> 'owner' or new.status <> 'active')
       and private.count_active_owners(v_kind, v_parent, old.id) = 0 then
      raise exception 'last_owner' using errcode = '23514', detail = 'Add another owner first.';
    end if;
    return new;
  end if;

  -- DELETE
  if old.role::text = 'owner' and not v_is_owner then
    raise exception 'only_owner_can_manage_owners' using errcode = '42501';
  end if;
  if old.role::text = 'owner' and old.status = 'active' and private.count_active_owners(v_kind, v_parent, old.id) = 0 then
    raise exception 'last_owner' using errcode = '23514', detail = 'Add another owner first.';
  end if;
  return old;
end;
$$;

create trigger membership_guard before insert or update or delete on public.org_members
  for each row execute function private.tg_membership_guard();
create trigger membership_guard before insert or update or delete on public.shop_staff
  for each row execute function private.tg_membership_guard();

-- Credit terms, hold and override need credit.manage even when retailers.manage can edit the rest.
create or replace function private.tg_retailer_accounts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if (tg_op = 'INSERT' and (new.credit_limit_paisa <> 0 or new.status <> 'active' or new.hold_override_until is not null))
     or (tg_op = 'UPDATE' and (
          new.credit_limit_paisa is distinct from old.credit_limit_paisa
          or new.payment_terms_days is distinct from old.payment_terms_days
          or new.status is distinct from old.status
          or new.hold_reason is distinct from old.hold_reason
          or new.hold_override_until is distinct from old.hold_override_until)) then
    if not private.has_org_permission(new.org_id, 'credit.manage') then
      raise exception 'not_authorized' using errcode = '42501', detail = 'Changing credit terms needs credit.manage.';
    end if;
  end if;
  if tg_op = 'UPDATE' and (new.org_id <> old.org_id or new.shop_id <> old.shop_id) then
    raise exception 'immutable_account_fields' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger client_guard before insert or update on public.retailer_accounts
  for each row execute function private.tg_retailer_accounts_guard();

-- Rider positions inherit org from the rider.
create or replace function private.tg_rider_locations_inherit_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select r.org_id into new.org_id from public.riders r where r.id = new.rider_id;
  if new.org_id is null then
    raise exception 'rider_not_found' using errcode = 'P0002';
  end if;
  return new;
end;
$$;
create trigger inherit_org before insert or update of rider_id on public.rider_locations
  for each row execute function private.tg_rider_locations_inherit_org();

-- Support ticket numbers (column default; clients cannot supply their own, see grants below).
create or replace function private.next_ticket_number()
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select 'TKT-' || lpad(private.next_counter('support_ticket')::text, 6, '0')
$$;
grant execute on function private.next_ticket_number() to authenticated, service_role;
alter table public.support_tickets alter column ticket_number set default private.next_ticket_number();

-- ---------------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------------

-- Reference data readable before sign-in.
grant select on
  public.service_areas, public.brands, public.categories, public.master_products, public.product_aliases,
  public.product_images, public.plans, public.content_pages, public.feature_flags
to anon;

-- RPC-only tables: no direct writes from the API at all.
revoke insert, update, delete on
  public.orders, public.order_items, public.order_status_history, public.delivery_otps, public.returns,
  public.return_items, public.credit_notes, public.proof_of_delivery, public.stock_receipts,
  public.stock_batches, public.stock_movements, public.stock_transfers, public.ledger_accounts,
  public.ledger_journals, public.ledger_entries, public.payments, public.payment_allocations,
  public.cash_settlements, public.subscriptions, public.subscription_invoices, public.shop_stock_batches,
  public.shop_stock_movements, public.pos_bills, public.pos_bill_items, public.expenses, public.cash_book,
  public.customer_orders, public.customer_order_items, public.reviews, public.reward_points,
  public.message_outbox, public.audit_logs, public.counters, public.rate_limits, public.seed_registry,
  public.webhook_deliveries
from authenticated;

-- Column-level write privileges where some columns are managed by RPCs/triggers only.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, avatar_path, locale, theme, data_saver, tts_enabled, last_seen_at) on public.profiles to authenticated;

revoke insert, update on public.organizations from authenticated;
grant update (
  name, legal_name, description, phone, email, ntn, strn, address_line, area_id, lat, lng, served_area_ids,
  logo_path, cover_path, min_order_paisa, delivery_fee_paisa, free_delivery_above_paisa, settings
) on public.organizations to authenticated;

revoke insert, update on public.shops from authenticated;
grant update (name, phone, whatsapp, kind, description, address_line, area_id, lat, lng, photo_path, cover_path, ntn, strn)
  on public.shops to authenticated;

revoke insert, update on public.org_members from authenticated;
grant insert (id, org_id, phone, role, permissions, display_name) on public.org_members to authenticated;
grant update (role, permissions, status, display_name) on public.org_members to authenticated;

revoke insert, update on public.shop_staff from authenticated;
grant insert (id, shop_id, phone, role, permissions, display_name) on public.shop_staff to authenticated;
grant update (role, permissions, status, display_name) on public.shop_staff to authenticated;

revoke insert, update on public.shop_inventory from authenticated;
grant insert (
  id, shop_id, master_product_id, distributor_product_id, name, name_ur, barcode, sku, category_id, brand_id,
  pack_size_label, unit, is_loose, cost_price_paisa, selling_price_paisa, mrp_paisa, low_stock_threshold,
  is_favourite, is_visible_online, is_active, image_path
) on public.shop_inventory to authenticated;
grant update (
  master_product_id, distributor_product_id, name, name_ur, barcode, sku, category_id, brand_id, pack_size_label,
  unit, is_loose, cost_price_paisa, selling_price_paisa, mrp_paisa, low_stock_threshold, is_favourite,
  is_visible_online, is_active, image_path
) on public.shop_inventory to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke insert on public.notifications from authenticated;

revoke update on public.trip_stops from authenticated;
grant update (sequence, status, eta, arrived_at, failure_reason, notes) on public.trip_stops to authenticated;
revoke insert, delete on public.trip_stops from authenticated;

revoke update on public.retailer_accounts from authenticated;
grant update (
  price_tier_id, segment, credit_limit_paisa, payment_terms_days, status, hold_reason, hold_override_until,
  assigned_booker_id, notes
) on public.retailer_accounts to authenticated;
revoke delete on public.retailer_accounts from authenticated;

revoke update on public.api_keys from authenticated;
grant update (name, scopes, expires_at, revoked_at) on public.api_keys to authenticated;

revoke insert, update on public.support_tickets from authenticated;
grant insert (id, kind, priority, subject, opened_by, shop_id, org_id, order_id, customer_order_id) on public.support_tickets to authenticated;
grant update (kind, status, priority, assigned_to, resolved_at, closed_at) on public.support_tickets to authenticated;

revoke update on public.trips from authenticated;
grant update (vehicle_id, warehouse_id, trip_date, status, notes) on public.trips to authenticated;

revoke update, delete on public.events from authenticated;
revoke update, delete on public.data_deletion_requests from authenticated;
grant update (status, handled_by, handled_at, resolution_notes) on public.data_deletion_requests to authenticated;
revoke insert on public.data_deletion_requests from authenticated;

-- =============================================================================================
-- Policies
-- =============================================================================================

-- Identity ------------------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_platform_staff())
    or id in (select private.my_co_member_user_ids())
  );
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_staff()));
create policy user_roles_insert_admin on public.user_roles for insert to authenticated
  with check ((select private.is_admin()));
create policy user_roles_update_admin on public.user_roles for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy user_roles_delete_admin on public.user_roles for delete to authenticated
  using ((select private.is_admin()));

create policy service_areas_select_anon on public.service_areas for select to anon using (is_active);
create policy service_areas_select on public.service_areas for select to authenticated
  using (is_active or (select private.is_admin()));
create policy service_areas_insert_admin on public.service_areas for insert to authenticated with check ((select private.is_admin()));
create policy service_areas_update_admin on public.service_areas for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy service_areas_delete_admin on public.service_areas for delete to authenticated using ((select private.is_admin()));

create policy organizations_select on public.organizations for select to authenticated
  using (
    id in (select private.my_org_ids())
    or (select private.is_platform_staff())
    or id in (select private.marketplace_org_ids())
  );
create policy organizations_update on public.organizations for update to authenticated
  using (id in (select private.org_ids_with_permission('settings.manage')))
  with check (id in (select private.org_ids_with_permission('settings.manage')));

create policy org_members_select on public.org_members for select to authenticated
  using (
    org_id in (select private.my_org_ids())
    or user_id = (select auth.uid())
    or (select private.is_platform_staff())
  );
create policy org_members_insert on public.org_members for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('team.manage')));
create policy org_members_update on public.org_members for update to authenticated
  using (org_id in (select private.org_ids_with_permission('team.manage')))
  with check (org_id in (select private.org_ids_with_permission('team.manage')));
create policy org_members_delete on public.org_members for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('team.manage')) or user_id = (select auth.uid()));

create policy shops_select on public.shops for select to authenticated
  using (
    id in (select private.my_shop_ids())
    or (select private.is_platform_staff())
    or id in (select private.org_visible_shop_ids())
  );
create policy shops_update on public.shops for update to authenticated
  using (id in (select private.shop_ids_with_permission('settings')))
  with check (id in (select private.shop_ids_with_permission('settings')));

create policy shop_staff_select on public.shop_staff for select to authenticated
  using (
    shop_id in (select private.my_shop_ids())
    or user_id = (select auth.uid())
    or (select private.is_platform_staff())
  );
create policy shop_staff_insert on public.shop_staff for insert to authenticated
  with check (shop_id in (select private.shop_ids_with_permission('staff')));
create policy shop_staff_update on public.shop_staff for update to authenticated
  using (shop_id in (select private.shop_ids_with_permission('staff')))
  with check (shop_id in (select private.shop_ids_with_permission('staff')));
create policy shop_staff_delete on public.shop_staff for delete to authenticated
  using (shop_id in (select private.shop_ids_with_permission('staff')) or user_id = (select auth.uid()));

create policy addresses_select on public.addresses for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_platform_staff()));
create policy addresses_insert on public.addresses for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy addresses_update on public.addresses for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy addresses_delete on public.addresses for delete to authenticated
  using (user_id = (select auth.uid()));

-- Master catalog (reference data) -------------------------------------------------------------
create policy brands_select_anon on public.brands for select to anon using (is_active);
create policy brands_select on public.brands for select to authenticated using (is_active or (select private.is_admin()));
create policy brands_insert_admin on public.brands for insert to authenticated with check ((select private.is_admin()));
create policy brands_update_admin on public.brands for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy brands_delete_admin on public.brands for delete to authenticated using ((select private.is_admin()));

create policy categories_select_anon on public.categories for select to anon using (is_active);
create policy categories_select on public.categories for select to authenticated using (is_active or (select private.is_admin()));
create policy categories_insert_admin on public.categories for insert to authenticated with check ((select private.is_admin()));
create policy categories_update_admin on public.categories for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy categories_delete_admin on public.categories for delete to authenticated using ((select private.is_admin()));

create policy master_products_select_anon on public.master_products for select to anon using (is_active);
create policy master_products_select on public.master_products for select to authenticated using (is_active or (select private.is_admin()));
create policy master_products_insert_admin on public.master_products for insert to authenticated with check ((select private.is_admin()));
create policy master_products_update_admin on public.master_products for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy master_products_delete_admin on public.master_products for delete to authenticated using ((select private.is_admin()));

create policy product_aliases_select_anon on public.product_aliases for select to anon using (true);
create policy product_aliases_select on public.product_aliases for select to authenticated using (true);
create policy product_aliases_insert_admin on public.product_aliases for insert to authenticated with check ((select private.is_admin()));
create policy product_aliases_update_admin on public.product_aliases for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy product_aliases_delete_admin on public.product_aliases for delete to authenticated using ((select private.is_admin()));

create policy product_images_select_anon on public.product_images for select to anon using (master_product_id is not null);
create policy product_images_select on public.product_images for select to authenticated
  using (
    master_product_id is not null
    or org_id in (select private.my_org_ids())
    or org_id in (select private.marketplace_org_ids())
    or (select private.is_platform_staff())
  );
create policy product_images_insert on public.product_images for insert to authenticated
  with check (
    (master_product_id is not null and (select private.is_admin()))
    or org_id in (select private.org_ids_with_permission('catalog.manage'))
  );
create policy product_images_update on public.product_images for update to authenticated
  using (
    (master_product_id is not null and (select private.is_admin()))
    or org_id in (select private.org_ids_with_permission('catalog.manage'))
  )
  with check (
    (master_product_id is not null and (select private.is_admin()))
    or org_id in (select private.org_ids_with_permission('catalog.manage'))
  );
create policy product_images_delete on public.product_images for delete to authenticated
  using (
    (master_product_id is not null and (select private.is_admin()))
    or org_id in (select private.org_ids_with_permission('catalog.manage'))
  );

-- Distributor catalog -------------------------------------------------------------------------
create policy distributor_products_select on public.distributor_products for select to authenticated
  using (
    org_id in (select private.my_org_ids())
    or (select private.is_platform_staff())
    or (
      is_active
      and org_id in (select private.marketplace_org_ids())
      and (visible_area_ids is null or visible_area_ids && (select private.my_shop_area_ids()))
    )
  );
create policy distributor_products_insert on public.distributor_products for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('catalog.manage')));
create policy distributor_products_update on public.distributor_products for update to authenticated
  using (org_id in (select private.org_ids_with_permission('catalog.manage')))
  with check (org_id in (select private.org_ids_with_permission('catalog.manage')));
create policy distributor_products_delete on public.distributor_products for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('catalog.manage')));

create policy pack_units_select on public.pack_units for select to authenticated
  using (
    org_id in (select private.my_org_ids())
    or org_id in (select private.marketplace_org_ids())
    or (select private.is_platform_staff())
  );
create policy pack_units_insert on public.pack_units for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('catalog.manage')));
create policy pack_units_update on public.pack_units for update to authenticated
  using (org_id in (select private.org_ids_with_permission('catalog.manage')))
  with check (org_id in (select private.org_ids_with_permission('catalog.manage')));
create policy pack_units_delete on public.pack_units for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('catalog.manage')));

create policy price_tiers_select on public.price_tiers for select to authenticated
  using (org_id in (select private.my_org_ids()) or (select private.is_platform_staff()));
create policy price_tiers_insert on public.price_tiers for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy price_tiers_update on public.price_tiers for update to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')))
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy price_tiers_delete on public.price_tiers for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')));

create policy price_tier_items_select on public.price_tier_items for select to authenticated
  using (org_id in (select private.my_org_ids()) or (select private.is_platform_staff()));
create policy price_tier_items_insert on public.price_tier_items for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy price_tier_items_update on public.price_tier_items for update to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')))
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy price_tier_items_delete on public.price_tier_items for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')));

create policy schemes_select on public.schemes for select to authenticated
  using (
    org_id in (select private.my_org_ids())
    or (select private.is_platform_staff())
    or (is_active and org_id in (select private.marketplace_org_ids()))
  );
create policy schemes_insert on public.schemes for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy schemes_update on public.schemes for update to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')))
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy schemes_delete on public.schemes for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')));

create policy scheme_products_select on public.scheme_products for select to authenticated
  using (
    org_id in (select private.my_org_ids())
    or org_id in (select private.marketplace_org_ids())
    or (select private.is_platform_staff())
  );
create policy scheme_products_insert on public.scheme_products for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy scheme_products_update on public.scheme_products for update to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')))
  with check (org_id in (select private.org_ids_with_permission('pricing.manage')));
create policy scheme_products_delete on public.scheme_products for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('pricing.manage')));

create policy retailer_accounts_select on public.retailer_accounts for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'retailers.manage', 'credit.manage', 'collections.manage', 'delivery.manage', 'field.manage', 'analytics.view']))
    or (org_id in (select private.my_org_ids()) and shop_id in (select private.my_booker_shop_ids()))
    or shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
    or (select private.is_platform_staff())
  );
create policy retailer_accounts_insert on public.retailer_accounts for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('retailers.manage')));
create policy retailer_accounts_update on public.retailer_accounts for update to authenticated
  using (org_id in (select private.org_ids_with_any_permission(array['retailers.manage', 'credit.manage'])))
  with check (org_id in (select private.org_ids_with_any_permission(array['retailers.manage', 'credit.manage'])));

-- Ordering --------------------------------------------------------------------------------------
create policy carts_select on public.carts for select to authenticated using (user_id = (select auth.uid()));
create policy carts_insert on public.carts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (shop_id in (select private.shop_ids_with_permission('orders')) or shop_id in (select private.my_booker_shop_ids()))
  );
create policy carts_update on public.carts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy carts_delete on public.carts for delete to authenticated using (user_id = (select auth.uid()));

create policy cart_items_select on public.cart_items for select to authenticated using (cart_id in (select private.my_cart_ids()));
create policy cart_items_insert on public.cart_items for insert to authenticated with check (cart_id in (select private.my_cart_ids()));
create policy cart_items_update on public.cart_items for update to authenticated
  using (cart_id in (select private.my_cart_ids())) with check (cart_id in (select private.my_cart_ids()));
create policy cart_items_delete on public.cart_items for delete to authenticated using (cart_id in (select private.my_cart_ids()));

create policy orders_select on public.orders for select to authenticated
  using (
    (
      deleted_at is null
      and (
        shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
        or org_id in (select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'delivery.manage', 'credit.manage', 'collections.manage', 'analytics.view']))
        or id in (select private.my_field_order_ids())
      )
    )
    or (select private.is_platform_staff())
  );

create policy order_items_select on public.order_items for select to authenticated
  using (
    (
      deleted_at is null
      and (
        shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
        or org_id in (select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'delivery.manage', 'credit.manage', 'collections.manage', 'analytics.view']))
        or order_id in (select private.my_field_order_ids())
      )
    )
    or (select private.is_platform_staff())
  );

create policy order_status_history_select on public.order_status_history for select to authenticated
  using (
    shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
    or org_id in (select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'delivery.manage', 'credit.manage', 'collections.manage', 'analytics.view']))
    or order_id in (select private.my_field_order_ids())
    or (select private.is_platform_staff())
  );

-- Only the ordering shop can read its delivery code (not the distributor, not the rider).
create policy delivery_otps_select on public.delivery_otps for select to authenticated
  using (shop_id in (select private.shop_ids_with_permission('orders')));

create policy returns_select on public.returns for select to authenticated
  using (
    shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
    or org_id in (select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'credit.manage']))
    or (select private.is_platform_staff())
  );
create policy return_items_select on public.return_items for select to authenticated
  using (
    shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
    or org_id in (select private.org_ids_with_any_permission(array['orders.view', 'orders.manage', 'credit.manage']))
    or (select private.is_platform_staff())
  );
create policy credit_notes_select on public.credit_notes for select to authenticated
  using (
    (
      deleted_at is null
      and (
        shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
        or org_id in (select private.org_ids_with_any_permission(array['orders.view', 'credit.manage', 'collections.manage', 'analytics.view']))
      )
    )
    or (select private.is_platform_staff())
  );

-- Delivery and field ----------------------------------------------------------------------------
create policy vehicles_select on public.vehicles for select to authenticated
  using (org_id in (select private.my_org_ids()) or (select private.is_platform_staff()));
create policy vehicles_insert on public.vehicles for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('delivery.manage')));
create policy vehicles_update on public.vehicles for update to authenticated
  using (org_id in (select private.org_ids_with_permission('delivery.manage')))
  with check (org_id in (select private.org_ids_with_permission('delivery.manage')));
create policy vehicles_delete on public.vehicles for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('delivery.manage')));

create policy riders_select on public.riders for select to authenticated
  using (org_id in (select private.my_org_ids()) or (select private.is_platform_staff()));
create policy riders_insert on public.riders for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('delivery.manage')));
create policy riders_update on public.riders for update to authenticated
  using (org_id in (select private.org_ids_with_permission('delivery.manage')))
  with check (org_id in (select private.org_ids_with_permission('delivery.manage')));
create policy riders_delete on public.riders for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('delivery.manage')));

create policy trips_select on public.trips for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['delivery.manage', 'orders.view', 'orders.manage', 'collections.manage']))
    or id in (select private.my_trip_ids())
    or (select private.is_platform_staff())
  );
create policy trips_insert on public.trips for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('delivery.manage')));
create policy trips_update on public.trips for update to authenticated
  using (org_id in (select private.org_ids_with_permission('delivery.manage')))
  with check (org_id in (select private.org_ids_with_permission('delivery.manage')));
create policy trips_delete on public.trips for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('delivery.manage')) and status = 'planned');

create policy trip_stops_select on public.trip_stops for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['delivery.manage', 'orders.view', 'orders.manage', 'collections.manage']))
    or trip_id in (select private.my_trip_ids())
    or shop_id in (select private.shop_ids_with_permission('orders'))
    or (select private.is_platform_staff())
  );
create policy trip_stops_update on public.trip_stops for update to authenticated
  using (org_id in (select private.org_ids_with_permission('delivery.manage')) or trip_id in (select private.my_trip_ids()))
  with check (org_id in (select private.org_ids_with_permission('delivery.manage')) or trip_id in (select private.my_trip_ids()));

create policy proof_of_delivery_select on public.proof_of_delivery for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['delivery.manage', 'orders.view', 'orders.manage']))
    or shop_id in (select private.shop_ids_with_permission('orders'))
    or order_id in (select private.my_field_order_ids())
    or (select private.is_platform_staff())
  );

create policy rider_locations_select on public.rider_locations for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['delivery.manage', 'orders.view', 'orders.manage']))
    or rider_id in (select private.my_rider_ids())
    or trip_id in (select private.shop_tracking_trip_ids())
    or (select private.is_platform_staff())
  );
create policy rider_locations_insert on public.rider_locations for insert to authenticated
  with check (rider_id in (select private.my_rider_ids()));
create policy rider_locations_update on public.rider_locations for update to authenticated
  using (rider_id in (select private.my_rider_ids())) with check (rider_id in (select private.my_rider_ids()));

create policy beats_select on public.beats for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['field.manage', 'analytics.view']))
    or booker_id in (select private.my_member_ids())
    or (select private.is_platform_staff())
  );
create policy beats_insert on public.beats for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('field.manage')));
create policy beats_update on public.beats for update to authenticated
  using (org_id in (select private.org_ids_with_permission('field.manage')))
  with check (org_id in (select private.org_ids_with_permission('field.manage')));
create policy beats_delete on public.beats for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('field.manage')));

create policy beat_shops_select on public.beat_shops for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['field.manage', 'analytics.view']))
    or beat_id in (select private.my_beat_ids())
    or (select private.is_platform_staff())
  );
create policy beat_shops_insert on public.beat_shops for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('field.manage')));
create policy beat_shops_update on public.beat_shops for update to authenticated
  using (org_id in (select private.org_ids_with_permission('field.manage')))
  with check (org_id in (select private.org_ids_with_permission('field.manage')));
create policy beat_shops_delete on public.beat_shops for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('field.manage')));

create policy visits_select on public.visits for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['field.manage', 'analytics.view']))
    or booker_id in (select private.my_member_ids())
    or (select private.is_platform_staff())
  );
create policy visits_insert on public.visits for insert to authenticated
  with check (booker_id in (select private.my_member_ids()) and org_id in (select private.my_org_ids()));
create policy visits_update on public.visits for update to authenticated
  using (booker_id in (select private.my_member_ids()) or org_id in (select private.org_ids_with_permission('field.manage')))
  with check (booker_id in (select private.my_member_ids()) or org_id in (select private.org_ids_with_permission('field.manage')));

create policy field_targets_select on public.field_targets for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['field.manage', 'analytics.view']))
    or member_id in (select private.my_member_ids())
    or (select private.is_platform_staff())
  );
create policy field_targets_insert on public.field_targets for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('field.manage')));
create policy field_targets_update on public.field_targets for update to authenticated
  using (org_id in (select private.org_ids_with_permission('field.manage')))
  with check (org_id in (select private.org_ids_with_permission('field.manage')));
create policy field_targets_delete on public.field_targets for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('field.manage')));

-- Warehouse ------------------------------------------------------------------------------------
create policy warehouses_select on public.warehouses for select to authenticated
  using (org_id in (select private.my_org_ids()) or (select private.is_platform_staff()));
create policy warehouses_insert on public.warehouses for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('warehouse.manage')));
create policy warehouses_update on public.warehouses for update to authenticated
  using (org_id in (select private.org_ids_with_permission('warehouse.manage')))
  with check (org_id in (select private.org_ids_with_permission('warehouse.manage')));
create policy warehouses_delete on public.warehouses for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('warehouse.manage')));

create policy suppliers_select on public.suppliers for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['warehouse.manage', 'catalog.manage', 'analytics.view']))
    or (select private.is_platform_staff())
  );
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('warehouse.manage')));
create policy suppliers_update on public.suppliers for update to authenticated
  using (org_id in (select private.org_ids_with_permission('warehouse.manage')))
  with check (org_id in (select private.org_ids_with_permission('warehouse.manage')));
create policy suppliers_delete on public.suppliers for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('warehouse.manage')));

create policy stock_receipts_select on public.stock_receipts for select to authenticated
  using (
    (deleted_at is null and org_id in (select private.org_ids_with_any_permission(array['warehouse.manage', 'orders.manage', 'catalog.manage', 'analytics.view'])))
    or (select private.is_platform_staff())
  );
create policy stock_batches_select on public.stock_batches for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['warehouse.manage', 'orders.view', 'orders.manage', 'catalog.manage', 'analytics.view']))
    or (select private.is_platform_staff())
  );
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['warehouse.manage', 'orders.manage', 'catalog.manage', 'analytics.view']))
    or (select private.is_platform_staff())
  );
create policy stock_transfers_select on public.stock_transfers for select to authenticated
  using (
    org_id in (select private.org_ids_with_any_permission(array['warehouse.manage', 'orders.manage', 'analytics.view']))
    or (select private.is_platform_staff())
  );

-- Money ------------------------------------------------------------------------------------------
-- The retailer shop reads the distributor's receivable account/entries that name it as
-- counterparty (its "distributor ledger"); bookers read the dues of shops they cover.
create policy ledger_accounts_select on public.ledger_accounts for select to authenticated
  using (
    (book_type = 'org' and org_id in (select private.org_ids_with_any_permission(array['credit.manage', 'collections.manage', 'analytics.view'])))
    or (book_type = 'shop' and shop_id in (select private.shop_ids_with_any_permission(array['khata', 'reports'])))
    or counterparty_shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
    or (org_id in (select private.my_org_ids()) and counterparty_shop_id in (select private.my_booker_shop_ids()))
    or counterparty_customer_id in (select private.my_shop_customer_ids())
    or (select private.is_admin())
  );

create policy ledger_journals_select on public.ledger_journals for select to authenticated
  using (
    (
      deleted_at is null
      and (
        (book_type = 'org' and org_id in (select private.org_ids_with_any_permission(array['credit.manage', 'collections.manage', 'analytics.view'])))
        or (book_type = 'shop' and shop_id in (select private.shop_ids_with_any_permission(array['khata', 'reports'])))
      )
    )
    or (select private.is_admin())
  );

create policy ledger_entries_select on public.ledger_entries for select to authenticated
  using (
    (
      deleted_at is null
      and (
        (book_type = 'org' and org_id in (select private.org_ids_with_any_permission(array['credit.manage', 'collections.manage', 'analytics.view'])))
        or (book_type = 'shop' and shop_id in (select private.shop_ids_with_any_permission(array['khata', 'reports'])))
        or counterparty_shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
        or (org_id in (select private.my_org_ids()) and counterparty_shop_id in (select private.my_booker_shop_ids()))
        or counterparty_customer_id in (select private.my_shop_customer_ids())
      )
    )
    or (select private.is_admin())
  );

create policy payments_select on public.payments for select to authenticated
  using (
    (
      deleted_at is null
      and (
        (book_type = 'org' and org_id in (select private.org_ids_with_any_permission(array['collections.manage', 'credit.manage', 'analytics.view'])))
        or (book_type = 'shop' and shop_id in (select private.shop_ids_with_any_permission(array['khata', 'reports'])))
        or payer_shop_id in (select private.shop_ids_with_any_permission(array['orders', 'reports']))
        or payer_customer_id in (select private.my_shop_customer_ids())
        or collected_by = (select auth.uid())
      )
    )
    or (select private.is_admin())
  );

create policy payment_allocations_select on public.payment_allocations for select to authenticated
  using (
    (deleted_at is null and payment_id in (select p.id from public.payments p))
    or (select private.is_admin())
  );

create policy cash_settlements_select on public.cash_settlements for select to authenticated
  using (
    (
      deleted_at is null
      and (
        org_id in (select private.org_ids_with_any_permission(array['collections.manage', 'analytics.view']))
        or member_id in (select private.my_member_ids())
      )
    )
    or (select private.is_admin())
  );

create policy plans_select_anon on public.plans for select to anon using (is_active);
create policy plans_select on public.plans for select to authenticated using (is_active or (select private.is_admin()));
create policy plans_insert_admin on public.plans for insert to authenticated with check ((select private.is_admin()));
create policy plans_update_admin on public.plans for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy plans_delete_admin on public.plans for delete to authenticated using ((select private.is_admin()));

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (
    (deleted_at is null and org_id in (select private.org_ids_with_any_permission(array['billing.manage', 'settings.manage'])))
    or (select private.is_admin())
  );
create policy subscription_invoices_select on public.subscription_invoices for select to authenticated
  using (
    (deleted_at is null and org_id in (select private.org_ids_with_permission('billing.manage')))
    or (select private.is_admin())
  );

-- Shop OS ------------------------------------------------------------------------------------------
create policy shop_customers_select on public.shop_customers for select to authenticated
  using (
    (deleted_at is null and shop_id in (select private.shop_ids_with_any_permission(array['khata', 'billing', 'reports'])))
    or (deleted_at is null and profile_id = (select auth.uid()))
    or (select private.is_platform_staff())
  );
create policy shop_customers_insert on public.shop_customers for insert to authenticated
  with check (shop_id in (select private.shop_ids_with_any_permission(array['khata', 'billing'])));
create policy shop_customers_update on public.shop_customers for update to authenticated
  using (shop_id in (select private.shop_ids_with_permission('khata')))
  with check (shop_id in (select private.shop_ids_with_permission('khata')));

create policy shop_inventory_select on public.shop_inventory for select to authenticated
  using (
    shop_id in (select private.shop_ids_with_any_permission(array['inventory', 'billing', 'reports', 'customer_orders', 'storefront', 'orders']))
    or (select private.is_platform_staff())
  );
create policy shop_inventory_insert on public.shop_inventory for insert to authenticated
  with check (shop_id in (select private.shop_ids_with_permission('inventory')));
create policy shop_inventory_update on public.shop_inventory for update to authenticated
  using (shop_id in (select private.shop_ids_with_permission('inventory')))
  with check (shop_id in (select private.shop_ids_with_permission('inventory')));
create policy shop_inventory_delete on public.shop_inventory for delete to authenticated
  using (shop_id in (select private.shop_ids_with_permission('inventory')));

create policy shop_stock_batches_select on public.shop_stock_batches for select to authenticated
  using (shop_id in (select private.shop_ids_with_any_permission(array['inventory', 'reports'])) or (select private.is_platform_staff()));
create policy shop_stock_movements_select on public.shop_stock_movements for select to authenticated
  using (shop_id in (select private.shop_ids_with_any_permission(array['inventory', 'reports'])) or (select private.is_platform_staff()));

create policy pos_bills_select on public.pos_bills for select to authenticated
  using (
    (deleted_at is null and shop_id in (select private.shop_ids_with_any_permission(array['billing', 'reports'])))
    or (select private.is_platform_staff())
  );
create policy pos_bill_items_select on public.pos_bill_items for select to authenticated
  using (
    (deleted_at is null and shop_id in (select private.shop_ids_with_any_permission(array['billing', 'reports'])))
    or (select private.is_platform_staff())
  );
create policy expenses_select on public.expenses for select to authenticated
  using (
    (deleted_at is null and shop_id in (select private.shop_ids_with_any_permission(array['expenses', 'reports'])))
    or (select private.is_platform_staff())
  );
create policy cash_book_select on public.cash_book for select to authenticated
  using (
    (deleted_at is null and shop_id in (select private.shop_ids_with_any_permission(array['expenses', 'reports', 'billing'])))
    or (select private.is_platform_staff())
  );

-- Storefront -----------------------------------------------------------------------------------
create policy storefront_settings_select on public.storefront_settings for select to authenticated
  using (shop_id in (select private.my_shop_ids()) or (select private.is_platform_staff()));
create policy storefront_settings_insert on public.storefront_settings for insert to authenticated
  with check (shop_id in (select private.shop_ids_with_permission('storefront')));
create policy storefront_settings_update on public.storefront_settings for update to authenticated
  using (shop_id in (select private.shop_ids_with_permission('storefront')))
  with check (shop_id in (select private.shop_ids_with_permission('storefront')));

create policy customer_orders_select on public.customer_orders for select to authenticated
  using (
    (
      deleted_at is null
      and (customer_id = (select auth.uid()) or shop_id in (select private.shop_ids_with_permission('customer_orders')))
    )
    or (select private.is_platform_staff())
  );
create policy customer_order_items_select on public.customer_order_items for select to authenticated
  using (
    customer_id = (select auth.uid())
    or shop_id in (select private.shop_ids_with_permission('customer_orders'))
    or (select private.is_platform_staff())
  );

create policy reviews_select on public.reviews for select to authenticated
  using (
    reviewer_id = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
    or org_id in (select private.my_org_ids())
    or reviewer_shop_id in (select private.my_shop_ids())
    or (select private.is_platform_staff())
  );

-- Engagement -----------------------------------------------------------------------------------
create policy banners_select on public.banners for select to authenticated
  using (
    (owner_type = 'platform' and is_active)
    or org_id in (select private.my_org_ids())
    or (is_active and org_id in (select private.my_retailer_org_ids()))
    or (select private.is_admin())
  );
create policy banners_insert on public.banners for insert to authenticated
  with check (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  );
create policy banners_update on public.banners for update to authenticated
  using (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  )
  with check (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  );
create policy banners_delete on public.banners for delete to authenticated
  using (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  );

create policy campaigns_select on public.campaigns for select to authenticated
  using (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  );
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  );
create policy campaigns_update on public.campaigns for update to authenticated
  using (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  )
  with check (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
  );
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (
    status in ('draft', 'cancelled')
    and (
      (owner_type = 'platform' and (select private.is_admin()))
      or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('promotions.manage')))
    )
  );

create policy notifications_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

create policy reward_points_select on public.reward_points for select to authenticated
  using (shop_id in (select private.my_shop_ids()) or (select private.is_platform_staff()));

-- AI and audit ---------------------------------------------------------------------------------
create policy ai_conversations_select on public.ai_conversations for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy ai_conversations_insert on public.ai_conversations for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy ai_conversations_update on public.ai_conversations for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ai_conversations_delete on public.ai_conversations for delete to authenticated
  using (user_id = (select auth.uid()));

create policy ai_messages_select on public.ai_messages for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy ai_messages_insert on public.ai_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and conversation_id in (select c.id from public.ai_conversations c where c.user_id = (select auth.uid())));

create policy ai_actions_select on public.ai_actions for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy ai_actions_insert on public.ai_actions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy ai_actions_update on public.ai_actions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy product_embeddings_select on public.product_embeddings for select to authenticated using ((select private.is_admin()));
create policy product_embeddings_insert on public.product_embeddings for insert to authenticated with check ((select private.is_admin()));
create policy product_embeddings_update on public.product_embeddings for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy product_embeddings_delete on public.product_embeddings for delete to authenticated using ((select private.is_admin()));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (
    (select private.is_platform_staff())
    or org_id in (select private.org_ids_with_any_permission(array['team.manage', 'settings.manage']))
    or shop_id in (select private.shop_ids_with_any_permission(array['settings', 'staff']))
  );

create policy feature_flags_select_anon on public.feature_flags for select to anon using (true);
create policy feature_flags_select on public.feature_flags for select to authenticated using (true);
create policy feature_flags_insert_admin on public.feature_flags for insert to authenticated with check ((select private.is_admin()));
create policy feature_flags_update_admin on public.feature_flags for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy feature_flags_delete_admin on public.feature_flags for delete to authenticated using ((select private.is_admin()));

-- Platform and integrations --------------------------------------------------------------------
-- OTPs and outgoing messages: admins only (the app's Sandbox panel reads with the service role).
create policy message_outbox_select_admin on public.message_outbox for select to authenticated using ((select private.is_admin()));

create policy api_keys_select on public.api_keys for select to authenticated
  using (org_id in (select private.org_ids_with_permission('integrations.manage')) or (select private.is_admin()));
create policy api_keys_insert on public.api_keys for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('integrations.manage')));
create policy api_keys_update on public.api_keys for update to authenticated
  using (org_id in (select private.org_ids_with_permission('integrations.manage')))
  with check (org_id in (select private.org_ids_with_permission('integrations.manage')));
create policy api_keys_delete on public.api_keys for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('integrations.manage')));

create policy webhook_endpoints_select on public.webhook_endpoints for select to authenticated
  using (org_id in (select private.org_ids_with_permission('integrations.manage')) or (select private.is_admin()));
create policy webhook_endpoints_insert on public.webhook_endpoints for insert to authenticated
  with check (org_id in (select private.org_ids_with_permission('integrations.manage')));
create policy webhook_endpoints_update on public.webhook_endpoints for update to authenticated
  using (org_id in (select private.org_ids_with_permission('integrations.manage')))
  with check (org_id in (select private.org_ids_with_permission('integrations.manage')));
create policy webhook_endpoints_delete on public.webhook_endpoints for delete to authenticated
  using (org_id in (select private.org_ids_with_permission('integrations.manage')));

create policy webhook_deliveries_select on public.webhook_deliveries for select to authenticated
  using (org_id in (select private.org_ids_with_permission('integrations.manage')) or (select private.is_admin()));

create policy integration_settings_select on public.integration_settings for select to authenticated
  using (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.my_org_ids()))
    or (owner_type = 'shop' and shop_id in (select private.my_shop_ids()))
  );
create policy integration_settings_insert on public.integration_settings for insert to authenticated
  with check (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('integrations.manage')))
    or (owner_type = 'shop' and shop_id in (select private.shop_ids_with_permission('settings')))
  );
create policy integration_settings_update on public.integration_settings for update to authenticated
  using (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('integrations.manage')))
    or (owner_type = 'shop' and shop_id in (select private.shop_ids_with_permission('settings')))
  )
  with check (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('integrations.manage')))
    or (owner_type = 'shop' and shop_id in (select private.shop_ids_with_permission('settings')))
  );
create policy integration_settings_delete on public.integration_settings for delete to authenticated
  using (
    (owner_type = 'platform' and (select private.is_admin()))
    or (owner_type = 'org' and org_id in (select private.org_ids_with_permission('integrations.manage')))
    or (owner_type = 'shop' and shop_id in (select private.shop_ids_with_permission('settings')))
  );

create policy support_tickets_select on public.support_tickets for select to authenticated
  using (
    opened_by = (select auth.uid())
    or shop_id in (select private.my_shop_ids())
    or org_id in (select private.my_org_ids())
    or (select private.is_platform_staff())
  );
create policy support_tickets_insert on public.support_tickets for insert to authenticated
  with check (
    opened_by = (select auth.uid())
    and (shop_id is null or shop_id in (select private.my_shop_ids()))
    and (org_id is null or org_id in (select private.my_org_ids()) or org_id in (select private.my_retailer_org_ids()))
    and (order_id is null or order_id in (select o.id from public.orders o))
    and (customer_order_id is null or customer_order_id in (select co.id from public.customer_orders co))
  );
create policy support_tickets_update on public.support_tickets for update to authenticated
  using ((select private.is_platform_staff())) with check ((select private.is_platform_staff()));

create policy support_messages_select on public.support_messages for select to authenticated
  using (
    ticket_id in (select t.id from public.support_tickets t)
    and (not is_internal or (select private.is_platform_staff()))
  );
create policy support_messages_insert on public.support_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and ticket_id in (select t.id from public.support_tickets t)
    and (not is_internal or (select private.is_platform_staff()))
  );

create policy content_pages_select_anon on public.content_pages for select to anon using (is_published);
create policy content_pages_select on public.content_pages for select to authenticated
  using (is_published or (select private.is_admin()));
create policy content_pages_insert_admin on public.content_pages for insert to authenticated with check ((select private.is_admin()));
create policy content_pages_update_admin on public.content_pages for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy content_pages_delete_admin on public.content_pages for delete to authenticated using ((select private.is_admin()));

create policy data_deletion_requests_select on public.data_deletion_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy data_deletion_requests_update_admin on public.data_deletion_requests for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy events_insert on public.events for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy events_select_admin on public.events for select to authenticated using ((select private.is_admin()));

-- counters, rate_limits and seed_registry: RLS on, no policies (service role / RPC internals only).

-- =============================================================================================
-- Read models (security_invoker: the caller's RLS applies to the underlying tables)
-- =============================================================================================
create view public.ledger_account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.book_type,
  a.org_id,
  a.shop_id,
  a.book_id,
  a.code,
  a.name,
  a.counterparty_type,
  a.counterparty_shop_id,
  a.counterparty_customer_id,
  coalesce(sum(e.debit_paisa), 0)::bigint as debit_paisa,
  coalesce(sum(e.credit_paisa), 0)::bigint as credit_paisa,
  coalesce(sum(e.debit_paisa - e.credit_paisa), 0)::bigint as balance_paisa,
  max(e.entry_date) as last_entry_date
from public.ledger_accounts a
left join public.ledger_entries e on e.account_id = a.id and e.deleted_at is null
group by a.id;
comment on view public.ledger_account_balances is 'balance_paisa is debit minus credit: for a receivable it is the amount the counterparty owes.';

-- Delivered B2B orders with money still outstanding (invoice aging, FIFO allocation order).
create view public.open_invoices
with (security_invoker = true)
as
select
  o.id as order_id,
  o.org_id,
  o.shop_id,
  o.order_number,
  o.invoice_number,
  o.delivered_at,
  o.due_date,
  o.total_paisa,
  o.paid_paisa,
  (o.total_paisa - o.paid_paisa) as outstanding_paisa,
  greatest(private.pkt_today() - o.due_date, 0) as days_overdue
from public.orders o
where o.status in ('delivered', 'partially_delivered')
  and o.deleted_at is null
  and o.paid_paisa < o.total_paisa;

revoke insert, update, delete on public.ledger_account_balances, public.open_invoices from authenticated;
