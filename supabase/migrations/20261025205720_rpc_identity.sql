-- =============================================================================================
-- Identity RPCs: role switcher, active context, becoming a dukandar/distributor, admin review.
-- All are SECURITY DEFINER with an empty search_path and check authorisation themselves.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- my_role_contexts()
--   returns table (role app_role, context_id uuid, context_name text, member_role text,
--                  status text, image_path text)
-- The role switcher list for the signed-in user:
--   * always one 'customer' row (context_id null, status 'approved', image = avatar_path)
--   * one 'dukandar' row per active shop_staff membership (context = shop, status = the shop's
--     approval status, image = shop photo_path)
--   * one row per active org_members membership: owner/manager/accountant/warehouse ->
--     'distributor', booker -> 'booker', rider -> 'rider' (status = org approval status,
--     image = org logo_path)
--   * an 'admin' row when user_roles has 'admin'
-- Pending/rejected/suspended shops and orgs are included (the UI explains them); suspended or
-- invited memberships are not. Every image_path is a path in the public 'shop-media' bucket.
-- Ordered: customer, dukandar, distributor, booker, rider, admin, then by name.
-- ---------------------------------------------------------------------------------------------
create or replace function public.my_role_contexts()
returns table (
  role public.app_role,
  context_id uuid,
  context_name text,
  member_role text,
  status text,
  image_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.role, c.context_id, c.context_name, c.member_role, c.status, c.image_path
    from (
      select 'customer'::public.app_role as role, null::uuid as context_id, null::text as context_name,
             null::text as member_role, 'approved'::text as status, p.avatar_path as image_path
        from public.profiles p
       where p.id = (select auth.uid())
      union all
      select 'dukandar'::public.app_role, s.id, s.name, ss.role::text, s.status::text, s.photo_path
        from public.shop_staff ss
        join public.shops s on s.id = ss.shop_id
       where ss.user_id = (select auth.uid()) and ss.status = 'active'
      union all
      select case m.role
               when 'booker' then 'booker'::public.app_role
               when 'rider' then 'rider'::public.app_role
               else 'distributor'::public.app_role
             end,
             o.id, o.name, m.role::text, o.status::text, o.logo_path
        from public.org_members m
        join public.organizations o on o.id = m.org_id
       where m.user_id = (select auth.uid()) and m.status = 'active'
      union all
      select 'admin'::public.app_role, null::uuid, null::text, 'admin'::text, 'approved'::text, null::text
        from public.user_roles ur
       where ur.user_id = (select auth.uid()) and ur.role = 'admin'
    ) as c
   order by c.role, c.context_name nulls first, c.context_id
$$;

revoke execute on function public.my_role_contexts() from public, anon;
grant execute on function public.my_role_contexts() to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- switch_active_context(p_role app_role, p_context_id uuid default null) returns void
-- The only way to change profiles.active_role / active_shop_id / active_org_id.
-- Allowed when the caller holds the context and it is usable:
--   customer    always (context ignored)
--   admin       user_roles has 'admin' (context ignored)
--   dukandar    active shop_staff membership in p_context_id, shop status 'approved'
--   distributor active org membership with role owner/manager/accountant/warehouse in an
--               'approved' org
--   booker      active org membership with role booker in an 'approved' org
--   rider       active org membership with role rider in an 'approved' org
-- Otherwise raises 'context_not_allowed' (errcode 42501). Sets the shop for dukandar, the org
-- for distributor/booker/rider, and clears the other one.
-- ---------------------------------------------------------------------------------------------
create or replace function public.switch_active_context(p_role public.app_role, p_context_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
begin
  if v_uid is null or p_role is null then
    raise exception 'context_not_allowed' using errcode = '42501';
  end if;

  if p_role = 'customer' then
    v_allowed := true;
  elsif p_role = 'admin' then
    v_allowed := exists (select 1 from public.user_roles ur where ur.user_id = v_uid and ur.role = 'admin');
  elsif p_role = 'dukandar' then
    v_allowed := p_context_id is not null and exists (
      select 1
        from public.shop_staff ss
        join public.shops s on s.id = ss.shop_id
       where ss.user_id = v_uid
         and ss.shop_id = p_context_id
         and ss.status = 'active'
         and s.status = 'approved'
    );
  else
    v_allowed := p_context_id is not null and exists (
      select 1
        from public.org_members m
        join public.organizations o on o.id = m.org_id
       where m.user_id = v_uid
         and m.org_id = p_context_id
         and m.status = 'active'
         and o.status = 'approved'
         and (
           (p_role = 'booker' and m.role = 'booker')
           or (p_role = 'rider' and m.role = 'rider')
           or (p_role = 'distributor' and m.role in ('owner', 'manager', 'accountant', 'warehouse'))
         )
    );
  end if;

  if not v_allowed then
    raise exception 'context_not_allowed'
      using errcode = '42501', detail = format('You cannot switch to %s for this context.', p_role);
  end if;

  update public.profiles
     set active_role = p_role,
         active_shop_id = case when p_role = 'dukandar' then p_context_id end,
         active_org_id = case when p_role in ('distributor', 'booker', 'rider') then p_context_id end
   where id = v_uid;
  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.switch_active_context(public.app_role, uuid) from public, anon;
grant execute on function public.switch_active_context(public.app_role, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- register_shop(p_name, p_phone, p_address_line, p_area_id, p_lat, p_lng,
--               p_kind default 'kirana', p_whatsapp, p_photo_path, p_ntn, p_strn,
--               p_description, p_onboarded_by_org_id) returns shops
-- "Become a dukandar": creates the shop in status 'pending' (submitted for admin review), the
-- caller as active owner (shop_staff), an offline storefront_settings row, notifies admins and
-- writes the audit log. Phones accept any common Pakistani format and are stored as E.164.
-- At most 3 shops awaiting review per user (limit 54000 'too_many_pending_registrations').
-- Booker onboarding: with p_onboarded_by_org_id the caller must be an active booker (or hold
-- retailers.manage/field.manage) in that approved distributor; the shop gets no owner until the
-- shopkeeper verifies the shop phone (claimed automatically), or is owned at once by the
-- existing TezDukan user with that phone. A retailer account (assigned to the booker) is created.
-- ---------------------------------------------------------------------------------------------
create or replace function public.register_shop(
  p_name text,
  p_phone text,
  p_address_line text,
  p_area_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_kind public.shop_kind default 'kirana',
  p_whatsapp text default null,
  p_photo_path text default null,
  p_ntn text default null,
  p_strn text default null,
  p_description text default null,
  p_onboarded_by_org_id uuid default null
)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_phone text := private.normalize_phone(p_phone);
  v_whatsapp text;
  v_member public.org_members%rowtype;
  v_owner uuid;
  v_shop public.shops%rowtype;
begin
  if char_length(coalesce(btrim(p_name), '')) not between 2 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_whatsapp is not null and btrim(p_whatsapp) <> '' then
    v_whatsapp := private.normalize_phone(p_whatsapp);
    if v_whatsapp is null then
      raise exception 'invalid_phone' using errcode = '22023', detail = 'WhatsApp number';
    end if;
  end if;
  if char_length(coalesce(btrim(p_address_line), '')) < 3 then
    raise exception 'address_required' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'location_required' using errcode = '22023';
  end if;
  if p_area_id is not null and not exists (select 1 from public.service_areas a where a.id = p_area_id and a.is_active) then
    raise exception 'invalid_area' using errcode = '22023';
  end if;

  if p_onboarded_by_org_id is null then
    if (
      select count(*)
        from public.shop_staff ss
        join public.shops s on s.id = ss.shop_id
       where ss.user_id = v_uid and ss.role = 'owner' and s.status in ('draft', 'pending')
    ) >= 3 then
      raise exception 'too_many_pending_registrations' using errcode = '54000';
    end if;
    v_owner := v_uid;
  else
    select m.* into v_member
      from public.org_members m
     where m.org_id = p_onboarded_by_org_id and m.user_id = v_uid and m.status = 'active';
    if v_member.id is null
       or not (
         v_member.role = 'booker'
         or private.has_org_permission(p_onboarded_by_org_id, 'retailers.manage')
         or private.has_org_permission(p_onboarded_by_org_id, 'field.manage')
       ) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
    if not exists (select 1 from public.organizations o where o.id = p_onboarded_by_org_id and o.status = 'approved') then
      raise exception 'organization_not_approved' using errcode = '55000';
    end if;
    v_owner := private.profile_id_by_phone(v_phone);
  end if;

  insert into public.shops (
    owner_id, name, slug, phone, whatsapp, kind, description, address_line, area_id, lat, lng, photo_path,
    status, ntn, strn, onboarded_by_org_id, onboarded_by_member_id, submitted_at
  )
  values (
    v_owner, btrim(p_name), private.unique_slug('shops', p_name), v_phone, v_whatsapp, coalesce(p_kind, 'kirana'),
    nullif(btrim(p_description), ''), btrim(p_address_line), p_area_id, p_lat, p_lng, nullif(btrim(p_photo_path), ''),
    'pending', nullif(btrim(p_ntn), ''), nullif(btrim(p_strn), ''), p_onboarded_by_org_id, v_member.id, now()
  )
  returning * into v_shop;

  if v_owner is not null then
    insert into public.shop_staff (shop_id, user_id, role, status, phone, joined_at)
    values (v_shop.id, v_owner, 'owner', 'active', (select p.phone from public.profiles p where p.id = v_owner), now());
  end if;

  insert into public.storefront_settings (shop_id) values (v_shop.id);

  if p_onboarded_by_org_id is not null then
    insert into public.retailer_accounts (org_id, shop_id, assigned_booker_id)
    values (p_onboarded_by_org_id, v_shop.id, case when v_member.role = 'booker' then v_member.id end)
    on conflict (org_id, shop_id) do nothing;
  end if;

  perform private.audit(
    'shop.registered', 'shop', v_shop.id, p_onboarded_by_org_id, v_shop.id, null,
    to_jsonb(v_shop) - 'location'
  );
  perform private.notify_admins(
    'approval', 'New dukan waiting for approval', v_shop.name,
    jsonb_build_object('event', 'shop.registered', 'shop_id', v_shop.id), '/admin/verifications'
  );
  return v_shop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- register_organization(p_name, p_phone, p_address_line, p_area_id, p_lat, p_lng,
--                       p_legal_name, p_email, p_ntn, p_strn, p_logo_path,
--                       p_served_area_ids, p_description) returns organizations
-- "Become a distributor": creates the organization in status 'pending', the caller as active
-- owner, a default warehouse ("Main warehouse", code MAIN) at the business address, notifies
-- admins and audits. At most 2 organizations awaiting review per user.
-- p_served_area_ids null = serves the whole city.
-- ---------------------------------------------------------------------------------------------
create or replace function public.register_organization(
  p_name text,
  p_phone text,
  p_address_line text,
  p_area_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_legal_name text default null,
  p_email text default null,
  p_ntn text default null,
  p_strn text default null,
  p_logo_path text default null,
  p_served_area_ids uuid[] default null,
  p_description text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_phone text := private.normalize_phone(p_phone);
  v_org public.organizations%rowtype;
begin
  if char_length(coalesce(btrim(p_name), '')) not between 2 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if p_email is not null and btrim(p_email) <> '' and btrim(p_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if char_length(coalesce(btrim(p_address_line), '')) < 3 then
    raise exception 'address_required' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'location_required' using errcode = '22023';
  end if;
  if p_area_id is not null and not exists (select 1 from public.service_areas a where a.id = p_area_id and a.is_active) then
    raise exception 'invalid_area' using errcode = '22023';
  end if;
  if p_served_area_ids is not null and exists (
    select 1 from unnest(p_served_area_ids) as x(area_id)
     where not exists (select 1 from public.service_areas a where a.id = x.area_id and a.is_active)
  ) then
    raise exception 'invalid_area' using errcode = '22023', detail = 'served_area_ids';
  end if;
  if (
    select count(*)
      from public.org_members m
      join public.organizations o on o.id = m.org_id
     where m.user_id = v_uid and m.role = 'owner' and o.status in ('draft', 'pending')
  ) >= 2 then
    raise exception 'too_many_pending_registrations' using errcode = '54000';
  end if;

  insert into public.organizations (
    name, slug, legal_name, description, phone, email, ntn, strn, address_line, area_id, lat, lng,
    served_area_ids, logo_path, status, submitted_at
  )
  values (
    btrim(p_name), private.unique_slug('organizations', p_name), nullif(btrim(p_legal_name), ''),
    nullif(btrim(p_description), ''), v_phone, nullif(btrim(p_email), ''), nullif(btrim(p_ntn), ''),
    nullif(btrim(p_strn), ''), btrim(p_address_line), p_area_id, p_lat, p_lng, p_served_area_ids,
    nullif(btrim(p_logo_path), ''), 'pending', now()
  )
  returning * into v_org;

  insert into public.org_members (org_id, user_id, role, status, phone, joined_at)
  values (v_org.id, v_uid, 'owner', 'active', (select p.phone from public.profiles p where p.id = v_uid), now());

  insert into public.warehouses (org_id, name, code, address_line, area_id, lat, lng, is_default)
  values (v_org.id, 'Main warehouse', 'MAIN', v_org.address_line, v_org.area_id, v_org.lat, v_org.lng, true);

  perform private.audit('organization.registered', 'organization', v_org.id, v_org.id, null, null, to_jsonb(v_org) - 'location');
  perform private.notify_admins(
    'approval', 'New distributor waiting for approval', v_org.name,
    jsonb_build_object('event', 'organization.registered', 'org_id', v_org.id), '/admin/verifications'
  );
  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- resubmit_shop(p_shop_id uuid) returns shops
-- resubmit_organization(p_org_id uuid) returns organizations
-- Owner sends a draft or rejected registration (after editing it) back to admin review.
-- ---------------------------------------------------------------------------------------------
create or replace function public.resubmit_shop(p_shop_id uuid)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop public.shops%rowtype;
begin
  perform private.require_user();
  if not private.is_shop_owner(p_shop_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.shops
     set status = 'pending', submitted_at = now(), rejection_reason = null
   where id = p_shop_id and status in ('draft', 'rejected')
  returning * into v_shop;
  if v_shop.id is null then
    raise exception 'invalid_status' using errcode = '55000', detail = 'Only draft or rejected registrations can be submitted.';
  end if;
  perform private.audit('shop.resubmitted', 'shop', v_shop.id, null, v_shop.id);
  perform private.notify_admins(
    'approval', 'Dukan resubmitted for approval', v_shop.name,
    jsonb_build_object('event', 'shop.resubmitted', 'shop_id', v_shop.id), '/admin/verifications'
  );
  return v_shop;
end;
$$;

create or replace function public.resubmit_organization(p_org_id uuid)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
begin
  perform private.require_user();
  if not private.is_org_owner(p_org_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  update public.organizations
     set status = 'pending', submitted_at = now(), rejection_reason = null
   where id = p_org_id and status in ('draft', 'rejected')
  returning * into v_org;
  if v_org.id is null then
    raise exception 'invalid_status' using errcode = '55000', detail = 'Only draft or rejected registrations can be submitted.';
  end if;
  perform private.audit('organization.resubmitted', 'organization', v_org.id, v_org.id, null);
  perform private.notify_admins(
    'approval', 'Distributor resubmitted for approval', v_org.name,
    jsonb_build_object('event', 'organization.resubmitted', 'org_id', v_org.id), '/admin/verifications'
  );
  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- approve_shop(p_shop_id uuid) returns shops                       admin only, pending -> approved
-- reject_shop(p_shop_id uuid, p_reason text) returns shops         admin only, pending -> rejected
-- approve_organization(p_org_id uuid) returns organizations        admin only, pending -> approved
-- reject_organization(p_org_id uuid, p_reason text) returns organizations
-- Approval unlocks the dukandar/distributor contexts in switch_active_context. Owners get an
-- in-app notification; every decision is audited. A rejection needs a reason (3+ characters)
-- that the applicant sees on the status screen.
-- ---------------------------------------------------------------------------------------------
create or replace function public.approve_shop(p_shop_id uuid)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.shops%rowtype;
  v_shop public.shops%rowtype;
begin
  perform private.require_user();
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_before from public.shops where id = p_shop_id for update;
  if v_before.id is null then
    raise exception 'shop_not_found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'pending' then
    raise exception 'invalid_status' using errcode = '55000', detail = format('Shop is %s, not pending.', v_before.status);
  end if;
  update public.shops
     set status = 'approved', approved_at = now(), approved_by = auth.uid(), rejection_reason = null
   where id = p_shop_id
  returning * into v_shop;
  perform private.audit(
    'shop.approved', 'shop', v_shop.id, null, v_shop.id,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_shop.status)
  );
  perform private.notify_shop(
    v_shop.id, array['settings'], 'approval', 'Your dukan is approved', v_shop.name,
    jsonb_build_object('event', 'shop.approved', 'shop_id', v_shop.id), '/dukan'
  );
  return v_shop;
end;
$$;

create or replace function public.reject_shop(p_shop_id uuid, p_reason text)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.shops%rowtype;
  v_shop public.shops%rowtype;
begin
  perform private.require_user();
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if char_length(coalesce(btrim(p_reason), '')) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into v_before from public.shops where id = p_shop_id for update;
  if v_before.id is null then
    raise exception 'shop_not_found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'pending' then
    raise exception 'invalid_status' using errcode = '55000', detail = format('Shop is %s, not pending.', v_before.status);
  end if;
  update public.shops
     set status = 'rejected', rejection_reason = btrim(p_reason), approved_at = null, approved_by = null
   where id = p_shop_id
  returning * into v_shop;
  perform private.audit(
    'shop.rejected', 'shop', v_shop.id, null, v_shop.id,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_shop.status, 'reason', v_shop.rejection_reason)
  );
  perform private.notify_shop(
    v_shop.id, array['settings'], 'approval', 'Your dukan registration needs changes', v_shop.rejection_reason,
    jsonb_build_object('event', 'shop.rejected', 'shop_id', v_shop.id), '/register/status'
  );
  return v_shop;
end;
$$;

create or replace function public.approve_organization(p_org_id uuid)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.organizations%rowtype;
  v_org public.organizations%rowtype;
begin
  perform private.require_user();
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_before from public.organizations where id = p_org_id for update;
  if v_before.id is null then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'pending' then
    raise exception 'invalid_status' using errcode = '55000', detail = format('Organization is %s, not pending.', v_before.status);
  end if;
  update public.organizations
     set status = 'approved', approved_at = now(), approved_by = auth.uid(), rejection_reason = null
   where id = p_org_id
  returning * into v_org;
  perform private.audit(
    'organization.approved', 'organization', v_org.id, v_org.id, null,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_org.status)
  );
  perform private.notify_org(
    v_org.id, array['settings.manage'], 'approval', 'Your distributor account is approved', v_org.name,
    jsonb_build_object('event', 'organization.approved', 'org_id', v_org.id), '/distributor'
  );
  return v_org;
end;
$$;

create or replace function public.reject_organization(p_org_id uuid, p_reason text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.organizations%rowtype;
  v_org public.organizations%rowtype;
begin
  perform private.require_user();
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if char_length(coalesce(btrim(p_reason), '')) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into v_before from public.organizations where id = p_org_id for update;
  if v_before.id is null then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  if v_before.status <> 'pending' then
    raise exception 'invalid_status' using errcode = '55000', detail = format('Organization is %s, not pending.', v_before.status);
  end if;
  update public.organizations
     set status = 'rejected', rejection_reason = btrim(p_reason), approved_at = null, approved_by = null
   where id = p_org_id
  returning * into v_org;
  perform private.audit(
    'organization.rejected', 'organization', v_org.id, v_org.id, null,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_org.status, 'reason', v_org.rejection_reason)
  );
  perform private.notify_org(
    v_org.id, array['settings.manage'], 'approval', 'Your distributor registration needs changes', v_org.rejection_reason,
    jsonb_build_object('event', 'organization.rejected', 'org_id', v_org.id), '/register/status'
  );
  return v_org;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- set_shop_status(p_shop_id uuid, p_status approval_status, p_reason text default null)
--   returns shops
-- set_organization_status(p_org_id uuid, p_status approval_status, p_reason text default null)
--   returns organizations
-- Admin suspend/reinstate: approved -> suspended (reason required) or suspended -> approved.
-- Suspending drops anyone working in that shop/org back to the customer context.
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_shop_status(p_shop_id uuid, p_status public.approval_status, p_reason text default null)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.shops%rowtype;
  v_shop public.shops%rowtype;
begin
  perform private.require_user();
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_before from public.shops where id = p_shop_id for update;
  if v_before.id is null then
    raise exception 'shop_not_found' using errcode = 'P0002';
  end if;
  if not ((v_before.status = 'approved' and p_status = 'suspended') or (v_before.status = 'suspended' and p_status = 'approved')) then
    raise exception 'invalid_status' using errcode = '55000',
      detail = format('Cannot move a %s shop to %s here; use approve_shop/reject_shop for reviews.', v_before.status, p_status);
  end if;
  if p_status = 'suspended' and char_length(coalesce(btrim(p_reason), '')) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.shops
     set status = p_status,
         rejection_reason = case when p_status = 'suspended' then btrim(p_reason) end
   where id = p_shop_id
  returning * into v_shop;
  if p_status = 'suspended' then
    perform private.reset_contexts_for(v_shop.id, null);
  end if;
  perform private.audit(
    case when p_status = 'suspended' then 'shop.suspended' else 'shop.reinstated' end, 'shop', v_shop.id, null, v_shop.id,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_shop.status, 'reason', p_reason)
  );
  perform private.notify_shop(
    v_shop.id, array['settings'], 'approval',
    case when p_status = 'suspended' then 'Your dukan has been suspended' else 'Your dukan is active again' end,
    v_shop.rejection_reason,
    jsonb_build_object('event', case when p_status = 'suspended' then 'shop.suspended' else 'shop.reinstated' end, 'shop_id', v_shop.id),
    '/register/status'
  );
  return v_shop;
end;
$$;

create or replace function public.set_organization_status(p_org_id uuid, p_status public.approval_status, p_reason text default null)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.organizations%rowtype;
  v_org public.organizations%rowtype;
begin
  perform private.require_user();
  if not private.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select * into v_before from public.organizations where id = p_org_id for update;
  if v_before.id is null then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  if not ((v_before.status = 'approved' and p_status = 'suspended') or (v_before.status = 'suspended' and p_status = 'approved')) then
    raise exception 'invalid_status' using errcode = '55000',
      detail = format('Cannot move a %s organization to %s here; use approve/reject for reviews.', v_before.status, p_status);
  end if;
  if p_status = 'suspended' and char_length(coalesce(btrim(p_reason), '')) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.organizations
     set status = p_status,
         rejection_reason = case when p_status = 'suspended' then btrim(p_reason) end
   where id = p_org_id
  returning * into v_org;
  if p_status = 'suspended' then
    perform private.reset_contexts_for(null, v_org.id);
  end if;
  perform private.audit(
    case when p_status = 'suspended' then 'organization.suspended' else 'organization.reinstated' end, 'organization', v_org.id, v_org.id, null,
    jsonb_build_object('status', v_before.status), jsonb_build_object('status', v_org.status, 'reason', p_reason)
  );
  perform private.notify_org(
    v_org.id, array['settings.manage'], 'approval',
    case when p_status = 'suspended' then 'Your distributor account has been suspended' else 'Your distributor account is active again' end,
    v_org.rejection_reason,
    jsonb_build_object('event', case when p_status = 'suspended' then 'organization.suspended' else 'organization.reinstated' end, 'org_id', v_org.id),
    '/register/status'
  );
  return v_org;
end;
$$;

-- Grants: signed-in users only; each function checks its own authorisation.
revoke execute on function
  public.register_shop(text, text, text, uuid, numeric, numeric, public.shop_kind, text, text, text, text, text, uuid),
  public.register_organization(text, text, text, uuid, numeric, numeric, text, text, text, text, text, uuid[], text),
  public.resubmit_shop(uuid),
  public.resubmit_organization(uuid),
  public.approve_shop(uuid),
  public.reject_shop(uuid, text),
  public.approve_organization(uuid),
  public.reject_organization(uuid, text),
  public.set_shop_status(uuid, public.approval_status, text),
  public.set_organization_status(uuid, public.approval_status, text)
from public, anon;

grant execute on function
  public.register_shop(text, text, text, uuid, numeric, numeric, public.shop_kind, text, text, text, text, text, uuid),
  public.register_organization(text, text, text, uuid, numeric, numeric, text, text, text, text, text, uuid[], text),
  public.resubmit_shop(uuid),
  public.resubmit_organization(uuid),
  public.approve_shop(uuid),
  public.reject_shop(uuid, text),
  public.approve_organization(uuid),
  public.reject_organization(uuid, text),
  public.set_shop_status(uuid, public.approval_status, text),
  public.set_organization_status(uuid, public.approval_status, text)
to authenticated, service_role;
