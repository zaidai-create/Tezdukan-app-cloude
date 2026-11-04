-- Admin panel, phase A: the overview, the approval queue, lists of dukans, distributors, users
-- and orders, pausing and restarting a dukan or distributor, the app's feature switches and the
-- audit log. Platform staff (admin or support) can read; only admins can change anything, and
-- every change lands in the audit log.

create or replace function private.require_staff()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if not private.is_platform_staff() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_user();
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

-- Digits of a typed phone number without the leading 0, so "0300 1234567" finds +923001234567.
-- Null when too short to mean a phone number.
create or replace function private.phone_digits(p_query text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(d) >= 4 then d
  end
    from (select regexp_replace(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '^0+', '') as d) x
$$;

-- One period's marketplace figures: delivered sales and orders on both sides, and sign-ups.
create or replace function private.admin_kpis(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with c as (
    select o.status, o.total_paisa, o.customer_id
      from public.customer_orders o
     where o.deleted_at is null and o.created_at >= p_from and o.created_at < p_to
  ),
  b as (
    select o.status, o.total_paisa, o.shop_id
      from public.orders o
     where o.deleted_at is null and o.created_at >= p_from and o.created_at < p_to
  )
  select jsonb_build_object(
    'customer_paisa', coalesce((select sum(total_paisa) from c where status = 'delivered'), 0),
    'b2b_paisa', coalesce((
      select sum(total_paisa) from b where status in ('delivered', 'partially_delivered')
    ), 0),
    'customer_orders', (select count(*) from c where status not in ('cancelled', 'rejected')),
    'b2b_orders', (select count(*) from b where status not in ('cancelled', 'returned')),
    'customers', (
      select count(distinct customer_id) from c where status not in ('cancelled', 'rejected')
    ),
    'ordering_shops', (select count(distinct shop_id) from b where status <> 'cancelled'),
    'new_users', (
      select count(*) from public.profiles p where p.created_at >= p_from and p.created_at < p_to
    ),
    'new_shops', (
      select count(*) from public.shops s where s.created_at >= p_from and s.created_at < p_to
    ),
    'new_orgs', (
      select count(*) from public.organizations g where g.created_at >= p_from and g.created_at < p_to
    )
  )
$$;

-- The overview: figures for today, the last 7 or the last 30 days (against the period before
-- up to the same time of day), sales for 14 days, the newest orders, the best dukans and what
-- needs someone's attention.
create or replace function public.admin_overview(p_range text default 'today')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_today date := (v_now at time zone 'Asia/Karachi')::date;
  v_to timestamptz := (v_today + 1)::timestamp at time zone 'Asia/Karachi';
  v_from timestamptz;
  v_prev_from timestamptz;
  v_prev_to timestamptz;
  v_chart_from timestamptz := (v_today - 13)::timestamp at time zone 'Asia/Karachi';
begin
  perform private.require_staff();
  case coalesce(p_range, '')
    when 'today' then
      v_from := v_today::timestamp at time zone 'Asia/Karachi';
      v_prev_from := v_from - interval '1 day';
      v_prev_to := v_now - interval '1 day';
    when 'week' then
      v_from := (v_today - 6)::timestamp at time zone 'Asia/Karachi';
      v_prev_from := v_from - interval '7 days';
      v_prev_to := v_now - interval '7 days';
    when 'month' then
      v_from := (v_today - 29)::timestamp at time zone 'Asia/Karachi';
      v_prev_from := v_from - interval '30 days';
      v_prev_to := v_now - interval '30 days';
    else
      raise exception 'invalid_range' using errcode = '22023';
  end case;

  return jsonb_build_object(
    'range', p_range,
    'kpis', private.admin_kpis(v_from, v_to),
    'previous', private.admin_kpis(v_prev_from, v_prev_to),
    'totals', jsonb_build_object(
      'shops', (select count(*) from public.shops s where s.status = 'approved'),
      'shops_live', (
        select count(*) from public.shops s
          join public.storefront_settings ss on ss.shop_id = s.id and ss.is_live
         where s.status = 'approved'
      ),
      'orgs', (select count(*) from public.organizations g where g.status = 'approved'),
      'users', (select count(*) from public.profiles p where p.deleted_at is null)
    ),
    'attention', jsonb_build_object(
      'pending_shops', (select count(*) from public.shops s where s.status = 'pending'),
      'pending_orgs', (select count(*) from public.organizations g where g.status = 'pending'),
      'stuck_customer_orders', (
        select count(*) from public.customer_orders o
         where o.deleted_at is null and o.status = 'placed' and o.created_at < v_now - interval '20 minutes'
      ),
      'stuck_b2b_orders', (
        select count(*) from public.orders o
         where o.deleted_at is null and o.status = 'new' and o.created_at < v_now - interval '2 hours'
      ),
      'open_support', (
        select count(*) from public.conversations c
         where c.kind = 'support' and c.status = 'open' and c.last_message_at is not null
           and c.last_sender_side is distinct from 'staff'
      ),
      'deletion_requests', (
        select count(*) from public.data_deletion_requests r where r.status in ('requested', 'in_review')
      )
    ),
    'series', (
      select jsonb_agg(jsonb_build_object(
               'day', d.day::date,
               'customer_paisa', coalesce(c.sales, 0),
               'b2b_paisa', coalesce(b.sales, 0)
             ) order by d.day)
        from generate_series(v_today - 13, v_today, interval '1 day') as d(day)
        left join (
          select (o.created_at at time zone 'Asia/Karachi')::date as day, sum(o.total_paisa) as sales
            from public.customer_orders o
           where o.deleted_at is null and o.status = 'delivered' and o.created_at >= v_chart_from
           group by 1
        ) c on c.day = d.day::date
        left join (
          select (o.created_at at time zone 'Asia/Karachi')::date as day, sum(o.total_paisa) as sales
            from public.orders o
           where o.deleted_at is null and o.status in ('delivered', 'partially_delivered')
             and o.created_at >= v_chart_from
           group by 1
        ) b on b.day = d.day::date
    ),
    'feed', (
      select coalesce(jsonb_agg(f order by f.created_at desc), '[]'::jsonb)
        from (
          select *
            from (
              (select 'customer'::text as kind, o.id, o.order_number as number, o.status::text as status,
                      o.total_paisa, o.created_at, o.shop_name as seller, o.customer_name as buyer
                 from public.customer_orders o
                where o.deleted_at is null
                order by o.created_at desc
                limit 10)
              union all
              (select 'b2b'::text, o.id, o.order_number, o.status::text, o.total_paisa, o.created_at,
                      g.name, s.name
                 from public.orders o
                 join public.organizations g on g.id = o.org_id
                 join public.shops s on s.id = o.shop_id
                where o.deleted_at is null
                order by o.created_at desc
                limit 10)
            ) u
           order by u.created_at desc
           limit 10
        ) f
    ),
    'top_shops', (
      select coalesce(jsonb_agg(t order by t.sales_paisa desc, t.name), '[]'::jsonb)
        from (
          select s.id, s.name, s.slug, a.name as area, count(*)::integer as orders,
                 sum(o.total_paisa) as sales_paisa
            from public.customer_orders o
            join public.shops s on s.id = o.shop_id
            left join public.service_areas a on a.id = s.area_id
           where o.deleted_at is null and o.status = 'delivered'
             and o.created_at >= v_from and o.created_at < v_to
           group by s.id, s.name, s.slug, a.name
           order by sum(o.total_paisa) desc, s.name
           limit 5
        ) t
    )
  );
end;
$$;

-- Registrations waiting for a decision, with what an admin needs to decide.
create or replace function public.admin_approvals()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'shops', (
      select coalesce(jsonb_agg(x order by x.submitted_at nulls last, x.created_at), '[]'::jsonb)
        from (
          select s.id, s.name, s.kind::text as kind, s.phone, s.address_line, a.name as area,
                 s.lat, s.lng, s.photo_path, s.submitted_at, s.created_at,
                 p.full_name as owner_name, p.phone as owner_phone
            from public.shops s
            left join public.service_areas a on a.id = s.area_id
            left join public.profiles p on p.id = s.owner_id
           where s.status = 'pending'
        ) x
    ),
    'orgs', (
      select coalesce(jsonb_agg(x order by x.submitted_at nulls last, x.created_at), '[]'::jsonb)
        from (
          select g.id, g.name, g.phone, g.address_line, a.name as area, g.lat, g.lng, g.logo_path,
                 g.submitted_at, g.created_at, ow.full_name as owner_name, ow.phone as owner_phone
            from public.organizations g
            left join public.service_areas a on a.id = g.area_id
            left join lateral (
              select pr.full_name, coalesce(m.phone, pr.phone) as phone
                from public.org_members m
                left join public.profiles pr on pr.id = m.user_id
               where m.org_id = g.id and m.role = 'owner'
               order by m.created_at
               limit 1
            ) ow on true
           where g.status = 'pending'
        ) x
    ),
    'auto_approve', coalesce((
      select f.enabled from public.feature_flags f where f.key = 'auto_approve_registrations'
    ), false)
  );
end;
$$;

-- Every dukan with its owner, how it is doing online in the last 30 days and its rating.
create or replace function public.admin_shops(
  p_status text default null,
  p_query text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := private.phone_digits(p_query);
begin
  perform private.require_staff();
  return (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (
        select s.id, s.name, s.slug, s.status::text as status, s.tier::text as tier, s.phone,
               s.address_line, a.name as area, s.created_at, s.rejection_reason,
               p.full_name as owner_name, p.phone as owner_phone,
               coalesce(ss.is_live, false) as is_live,
               (select count(*)::integer from public.shop_inventory i
                 where i.shop_id = s.id and i.is_active and i.is_visible_online and i.qty_on_hand > 0) as products,
               o.orders as orders_30d, o.sales as sales_30d,
               r.rating, r.rating_count
          from public.shops s
          left join public.service_areas a on a.id = s.area_id
          left join public.profiles p on p.id = s.owner_id
          left join public.storefront_settings ss on ss.shop_id = s.id
          cross join lateral (
            select (count(*) filter (where co.status not in ('cancelled', 'rejected')))::integer as orders,
                   coalesce(sum(co.total_paisa) filter (where co.status = 'delivered'), 0) as sales
              from public.customer_orders co
             where co.shop_id = s.id and co.deleted_at is null
               and co.created_at >= now() - interval '30 days'
          ) o
          cross join lateral (
            select round(avg(rv.rating), 1) as rating, count(*)::integer as rating_count
              from public.reviews rv
             where rv.target_type = 'shop' and rv.shop_id = s.id and rv.is_published
          ) r
         where (p_status is null or s.status::text = p_status)
           and (
             v_query is null
             or s.name ilike '%' || v_query || '%'
             or p.full_name ilike '%' || v_query || '%'
             or a.name ilike '%' || v_query || '%'
             or (v_digits is not null and (s.phone like '%' || v_digits || '%' or p.phone like '%' || v_digits || '%'))
           )
         order by s.created_at desc
         limit least(greatest(coalesce(p_limit, 100), 1), 200)
      ) x
  );
end;
$$;

-- Every distributor with its owner and its last 30 days of orders from dukans.
create or replace function public.admin_organizations(
  p_status text default null,
  p_query text default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := private.phone_digits(p_query);
begin
  perform private.require_staff();
  return (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (
        select g.id, g.name, g.slug, g.status::text as status, g.phone, g.address_line,
               a.name as area, g.created_at, g.rejection_reason,
               ow.full_name as owner_name, ow.phone as owner_phone,
               (select count(*)::integer from public.distributor_products dp where dp.org_id = g.id) as products,
               o.orders as orders_30d, o.sales as sales_30d, o.dukans as dukans_30d
          from public.organizations g
          left join public.service_areas a on a.id = g.area_id
          left join lateral (
            select pr.full_name, coalesce(m.phone, pr.phone) as phone
              from public.org_members m
              left join public.profiles pr on pr.id = m.user_id
             where m.org_id = g.id and m.role = 'owner'
             order by m.created_at
             limit 1
          ) ow on true
          cross join lateral (
            select (count(*) filter (where bo.status <> 'cancelled'))::integer as orders,
                   coalesce(sum(bo.total_paisa) filter (where bo.status in ('delivered', 'partially_delivered')), 0) as sales,
                   count(distinct bo.shop_id)::integer as dukans
              from public.orders bo
             where bo.org_id = g.id and bo.deleted_at is null
               and bo.created_at >= now() - interval '30 days'
          ) o
         where (p_status is null or g.status::text = p_status)
           and (
             v_query is null
             or g.name ilike '%' || v_query || '%'
             or ow.full_name ilike '%' || v_query || '%'
             or (v_digits is not null and (g.phone like '%' || v_digits || '%' or ow.phone like '%' || v_digits || '%'))
           )
         order by g.created_at desc
         limit least(greatest(coalesce(p_limit, 100), 1), 200)
      ) x
  );
end;
$$;

-- People: name, phone, when they joined and were last seen, their dukans, distributors and
-- platform roles, and how many orders they placed as customers.
create or replace function public.admin_users(p_query text default null, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := private.phone_digits(p_query);
begin
  perform private.require_staff();
  return (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (
        select p.id, p.full_name, p.phone, p.created_at, p.last_seen_at, p.active_role::text as active_role,
               (select coalesce(jsonb_agg(ur.role::text order by ur.role), '[]'::jsonb)
                  from public.user_roles ur where ur.user_id = p.id) as platform_roles,
               (select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb)
                  from public.shop_staff st join public.shops s on s.id = st.shop_id
                 where st.user_id = p.id and st.status = 'active') as shops,
               (select coalesce(jsonb_agg(g.name order by g.name), '[]'::jsonb)
                  from public.org_members m join public.organizations g on g.id = m.org_id
                 where m.user_id = p.id and m.status = 'active') as orgs,
               (select count(*)::integer from public.customer_orders co
                 where co.customer_id = p.id and co.deleted_at is null) as orders
          from public.profiles p
         where p.deleted_at is null
           and (
             v_query is null
             or p.full_name ilike '%' || v_query || '%'
             or (v_digits is not null and p.phone like '%' || v_digits || '%')
           )
         order by p.created_at desc
         limit least(greatest(coalesce(p_limit, 100), 1), 200)
      ) x
  );
end;
$$;

-- Customer and dukan orders in one list, newest first, with filters.
create or replace function public.admin_orders(
  p_kind text default 'all',
  p_status text default null,
  p_query text default null,
  p_limit integer default 60
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(btrim(coalesce(p_query, '')), '');
  v_digits text := private.phone_digits(p_query);
begin
  perform private.require_staff();
  if coalesce(p_kind, '') not in ('all', 'customer', 'b2b') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  return (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (
        select *
          from (
            select 'customer'::text as kind, o.id, o.order_number as number, o.status::text as status,
                   o.total_paisa, o.items_count, o.created_at, o.shop_name as seller,
                   o.customer_name as buyer, o.customer_phone as phone
              from public.customer_orders o
             where o.deleted_at is null and p_kind in ('all', 'customer')
               and (p_status is null or o.status::text = p_status)
               and (
                 v_query is null
                 or o.order_number ilike '%' || v_query || '%'
                 or o.shop_name ilike '%' || v_query || '%'
                 or o.customer_name ilike '%' || v_query || '%'
                 or (v_digits is not null and o.customer_phone like '%' || v_digits || '%')
               )
            union all
            select 'b2b'::text, o.id, o.order_number, o.status::text, o.total_paisa,
                   (select count(*)::integer from public.order_items oi where oi.order_id = o.id),
                   o.created_at, g.name, s.name, s.phone
              from public.orders o
              join public.organizations g on g.id = o.org_id
              join public.shops s on s.id = o.shop_id
             where o.deleted_at is null and p_kind in ('all', 'b2b')
               and (p_status is null or o.status::text = p_status)
               and (
                 v_query is null
                 or o.order_number ilike '%' || v_query || '%'
                 or g.name ilike '%' || v_query || '%'
                 or s.name ilike '%' || v_query || '%'
                 or (v_digits is not null and s.phone like '%' || v_digits || '%')
               )
          ) u
         order by u.created_at desc
         limit least(greatest(coalesce(p_limit, 60), 1), 200)
      ) x
  );
end;
$$;

-- Pause a dukan (it disappears for customers and stops taking online orders) or start it again.
-- Pending dukans go through approve_shop / reject_shop instead.
create or replace function public.admin_set_shop_status(p_shop_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.shops%rowtype;
  v_shop public.shops%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.require_admin();
  if coalesce(p_status, '') not in ('approved', 'suspended') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select * into v_before from public.shops where id = p_shop_id for update;
  if v_before.id is null then
    raise exception 'shop_not_found' using errcode = 'P0002';
  end if;
  if (p_status = 'suspended' and v_before.status <> 'approved')
     or (p_status = 'approved' and v_before.status <> 'suspended') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_status = 'suspended' and char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  update public.shops
     set status = p_status::public.approval_status,
         rejection_reason = case when p_status = 'suspended' then v_reason end
   where id = p_shop_id
  returning * into v_shop;
  if p_status = 'suspended' then
    update public.storefront_settings set is_live = false where shop_id = p_shop_id;
  end if;

  perform private.audit(
    case when p_status = 'suspended' then 'shop.suspended' else 'shop.reactivated' end,
    'shop', v_shop.id, null, v_shop.id,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_shop.status, 'reason', v_reason)
  );
  perform private.notify_shop(
    v_shop.id, array['settings'], 'approval',
    case when p_status = 'suspended' then 'Your dukan is paused' else 'Your dukan is active again' end,
    coalesce(v_reason, v_shop.name),
    jsonb_build_object('event', 'shop.' || p_status, 'shop_id', v_shop.id), '/dukan'
  );
  return jsonb_build_object('id', v_shop.id, 'status', v_shop.status);
end;
$$;

-- The same for a distributor.
create or replace function public.admin_set_org_status(p_org_id uuid, p_status text, p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_before public.organizations%rowtype;
  v_org public.organizations%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.require_admin();
  if coalesce(p_status, '') not in ('approved', 'suspended') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select * into v_before from public.organizations where id = p_org_id for update;
  if v_before.id is null then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;
  if (p_status = 'suspended' and v_before.status <> 'approved')
     or (p_status = 'approved' and v_before.status <> 'suspended') then
    raise exception 'invalid_status' using errcode = '55000';
  end if;
  if p_status = 'suspended' and char_length(coalesce(v_reason, '')) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;

  update public.organizations
     set status = p_status::public.approval_status,
         rejection_reason = case when p_status = 'suspended' then v_reason end
   where id = p_org_id
  returning * into v_org;

  perform private.audit(
    case when p_status = 'suspended' then 'organization.suspended' else 'organization.reactivated' end,
    'organization', v_org.id, v_org.id, null,
    jsonb_build_object('status', v_before.status),
    jsonb_build_object('status', v_org.status, 'reason', v_reason)
  );
  perform private.notify_org(
    v_org.id, array['settings.manage'], 'approval',
    case when p_status = 'suspended' then 'Your distributor account is paused' else 'Your distributor account is active again' end,
    coalesce(v_reason, v_org.name),
    jsonb_build_object('event', 'organization.' || p_status, 'org_id', v_org.id), '/distributor'
  );
  return jsonb_build_object('id', v_org.id, 'status', v_org.status);
end;
$$;

-- The app's switches (feature flags). Changing one is recorded by the feature_flags audit trigger.
create or replace function public.admin_flags()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'key', f.key, 'description', f.description, 'enabled', f.enabled, 'updated_at', f.updated_at
           ) order by f.key), '[]'::jsonb)
      from public.feature_flags f
  );
end;
$$;

create or replace function public.admin_set_flag(p_key text, p_enabled boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_enabled is null then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.feature_flags set enabled = p_enabled where key = p_key;
  if not found then
    raise exception 'flag_not_found' using errcode = 'P0002';
  end if;
  return jsonb_build_object('key', p_key, 'enabled', p_enabled);
end;
$$;

-- Who changed what and when, newest first. Admins only: entries can hold before/after values.
create or replace function public.admin_audit(p_limit integer default 60, p_before timestamptz default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return (
    select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb)
      from (
        select l.id, l.action, l.entity_type, l.entity_id, l.created_at, l.before, l.after,
               p.full_name as actor_name, p.phone as actor_phone,
               s.name as shop_name, g.name as org_name
          from public.audit_logs l
          left join public.profiles p on p.id = l.actor_id
          left join public.shops s on s.id = l.shop_id
          left join public.organizations g on g.id = l.org_id
         where p_before is null or l.created_at < p_before
         order by l.created_at desc
         limit least(greatest(coalesce(p_limit, 60), 1), 200)
      ) x
  );
end;
$$;

revoke execute on function private.require_staff() from public, anon;
revoke execute on function private.require_admin() from public, anon;
revoke execute on function private.admin_kpis(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_overview(text) from public, anon;
revoke execute on function public.admin_approvals() from public, anon;
revoke execute on function public.admin_shops(text, text, integer) from public, anon;
revoke execute on function public.admin_organizations(text, text, integer) from public, anon;
revoke execute on function public.admin_users(text, integer) from public, anon;
revoke execute on function public.admin_orders(text, text, text, integer) from public, anon;
revoke execute on function public.admin_set_shop_status(uuid, text, text) from public, anon;
revoke execute on function public.admin_set_org_status(uuid, text, text) from public, anon;
revoke execute on function public.admin_flags() from public, anon;
revoke execute on function public.admin_set_flag(text, boolean) from public, anon;
revoke execute on function public.admin_audit(integer, timestamptz) from public, anon;
grant execute on function public.admin_overview(text) to authenticated;
grant execute on function public.admin_approvals() to authenticated;
grant execute on function public.admin_shops(text, text, integer) to authenticated;
grant execute on function public.admin_organizations(text, text, integer) to authenticated;
grant execute on function public.admin_users(text, integer) to authenticated;
grant execute on function public.admin_orders(text, text, text, integer) to authenticated;
grant execute on function public.admin_set_shop_status(uuid, text, text) to authenticated;
grant execute on function public.admin_set_org_status(uuid, text, text) to authenticated;
grant execute on function public.admin_flags() to authenticated;
grant execute on function public.admin_set_flag(text, boolean) to authenticated;
grant execute on function public.admin_audit(integer, timestamptz) to authenticated;
