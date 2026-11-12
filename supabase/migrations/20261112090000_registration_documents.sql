-- Registering a dukan or a distributor now takes the owner's CNIC (number and both sides) and a
-- photo of the shop or warehouse, and the TezDukan team approves it from the admin panel. The
-- photos sit in the private kyc-documents bucket under the sender's own folder; only the sender
-- and platform staff can open them. Auto-approval (a testing switch) is turned off.

-- ---------------------------------------------------------------------------------------------
-- The documents of one registration.
-- ---------------------------------------------------------------------------------------------
create table public.registration_documents (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid unique references public.shops (id) on delete cascade,
  org_id uuid unique references public.organizations (id) on delete cascade,
  cnic_number text not null check (cnic_number ~ '^[0-9]{13}$'),
  cnic_front_path text not null,
  cnic_back_path text not null,
  place_photo_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  check (num_nonnulls(shop_id, org_id) = 1)
);
comment on table public.registration_documents is
  'CNIC and a shop/warehouse photo sent with a registration. Written only by apply_for_dukan / apply_for_distributor.';
comment on column public.registration_documents.place_photo_path is
  'Photo of the shop front (dukan) or the warehouse or office (distributor), in kyc-documents.';
create index registration_documents_created_by_idx on public.registration_documents (created_by);

create trigger set_row_metadata before insert or update on public.registration_documents
  for each row execute function private.set_row_metadata();

alter table public.registration_documents enable row level security;
create policy registration_documents_select on public.registration_documents for select to authenticated
  using (created_by = (select auth.uid()) or (select private.is_platform_staff()));
grant select on public.registration_documents to authenticated;
grant all on public.registration_documents to service_role;

-- A document path must be in the sender's own folder of kyc-documents and really uploaded.
create or replace function private.own_kyc_upload(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(btrim(p_path), '') <> ''
     and split_part(p_path, '/', 1) = (select auth.uid())::text
     and exists (
       select 1 from storage.objects o
        where o.bucket_id = 'kyc-documents' and o.name = p_path
     )
$$;

create or replace function private.check_registration_documents(
  p_cnic text,
  p_front text,
  p_back text,
  p_photo text
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(p_cnic, '') !~ '^[0-9]{13}$' then
    raise exception 'invalid_cnic' using errcode = '22023';
  end if;
  if not (private.own_kyc_upload(p_front) and private.own_kyc_upload(p_back) and private.own_kyc_upload(p_photo))
     or p_front = p_back or p_front = p_photo or p_back = p_photo then
    raise exception 'documents_required' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function private.own_kyc_upload(text) from public, anon;
revoke execute on function private.check_registration_documents(text, text, text, text) from public, anon;
grant execute on function private.own_kyc_upload(text) to authenticated, service_role;
grant execute on function private.check_registration_documents(text, text, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Applying: the business and its documents in one step, so a registration never waits for
-- review without them.
-- ---------------------------------------------------------------------------------------------
create or replace function public.apply_for_dukan(
  p_name text,
  p_phone text,
  p_address_line text,
  p_area_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_cnic_number text,
  p_cnic_front_path text,
  p_cnic_back_path text,
  p_shop_photo_path text,
  p_ntn text default null,
  p_strn text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cnic text := regexp_replace(coalesce(p_cnic_number, ''), '[^0-9]', '', 'g');
  v_shop public.shops%rowtype;
begin
  perform private.require_user();
  perform private.check_registration_documents(v_cnic, p_cnic_front_path, p_cnic_back_path, p_shop_photo_path);
  v_shop := public.register_shop(
    p_name, p_phone, p_address_line, p_area_id, p_lat, p_lng,
    p_whatsapp => p_phone,
    p_ntn => left(nullif(btrim(p_ntn), ''), 20),
    p_strn => left(nullif(btrim(p_strn), ''), 20)
  );
  insert into public.registration_documents (shop_id, cnic_number, cnic_front_path, cnic_back_path, place_photo_path)
  values (v_shop.id, v_cnic, p_cnic_front_path, p_cnic_back_path, p_shop_photo_path);
  return jsonb_build_object('id', v_shop.id, 'status', v_shop.status);
end;
$$;

create or replace function public.apply_for_distributor(
  p_name text,
  p_phone text,
  p_address_line text,
  p_area_id uuid,
  p_lat numeric,
  p_lng numeric,
  p_served_area_ids uuid[],
  p_cnic_number text,
  p_cnic_front_path text,
  p_cnic_back_path text,
  p_place_photo_path text,
  p_ntn text default null,
  p_strn text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cnic text := regexp_replace(coalesce(p_cnic_number, ''), '[^0-9]', '', 'g');
  v_org public.organizations%rowtype;
begin
  perform private.require_user();
  perform private.check_registration_documents(v_cnic, p_cnic_front_path, p_cnic_back_path, p_place_photo_path);
  v_org := public.register_organization(
    p_name, p_phone, p_address_line, p_area_id, p_lat, p_lng,
    p_ntn => left(nullif(btrim(p_ntn), ''), 20),
    p_strn => left(nullif(btrim(p_strn), ''), 20),
    p_served_area_ids => p_served_area_ids
  );
  insert into public.registration_documents (org_id, cnic_number, cnic_front_path, cnic_back_path, place_photo_path)
  values (v_org.id, v_cnic, p_cnic_front_path, p_cnic_back_path, p_place_photo_path);
  return jsonb_build_object('id', v_org.id, 'status', v_org.status);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The applicant's view: their dukans and distributor businesses, with where each one stands.
-- ---------------------------------------------------------------------------------------------
create or replace function public.my_applications()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.submitted_at desc nulls last), '[]'::jsonb)
    from (
      select 'dukan' as kind, s.id, s.name, s.status::text as status, s.rejection_reason,
             coalesce(s.submitted_at, s.created_at) as submitted_at, s.approved_at,
             exists (select 1 from public.registration_documents d where d.shop_id = s.id) as has_documents
        from public.shops s
       where s.owner_id = (select auth.uid())
      union all
      select 'distributor', g.id, g.name, g.status::text, g.rejection_reason,
             coalesce(g.submitted_at, g.created_at), g.approved_at,
             exists (select 1 from public.registration_documents d where d.org_id = g.id)
        from public.organizations g
       where exists (
         select 1 from public.org_members m
          where m.org_id = g.id and m.user_id = (select auth.uid()) and m.role = 'owner'
       )
    ) x
$$;

revoke execute on function public.apply_for_dukan(text, text, text, uuid, numeric, numeric, text, text, text, text, text, text) from public, anon;
revoke execute on function public.apply_for_distributor(text, text, text, uuid, numeric, numeric, uuid[], text, text, text, text, text, text) from public, anon;
revoke execute on function public.my_applications() from public, anon;
grant execute on function public.apply_for_dukan(text, text, text, uuid, numeric, numeric, text, text, text, text, text, text) to authenticated;
grant execute on function public.apply_for_distributor(text, text, text, uuid, numeric, numeric, uuid[], text, text, text, text, text, text) to authenticated;
grant execute on function public.my_applications() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The approvals queue shows the documents (paths; the admin page signs them) and tax numbers.
-- ---------------------------------------------------------------------------------------------
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
                 p.full_name as owner_name, p.phone as owner_phone, s.ntn, s.strn,
                 (select jsonb_build_object(
                           'cnic_number', d.cnic_number, 'cnic_front_path', d.cnic_front_path,
                           'cnic_back_path', d.cnic_back_path, 'place_photo_path', d.place_photo_path)
                    from public.registration_documents d where d.shop_id = s.id) as documents
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
                 g.submitted_at, g.created_at, ow.full_name as owner_name, ow.phone as owner_phone,
                 g.ntn, g.strn,
                 (select jsonb_build_object(
                           'cnic_number', d.cnic_number, 'cnic_front_path', d.cnic_front_path,
                           'cnic_back_path', d.cnic_back_path, 'place_photo_path', d.place_photo_path)
                    from public.registration_documents d where d.org_id = g.id) as documents
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

-- Real people register now: the TezDukan team approves each one (the switch stays in the admin
-- panel for testing).
update public.feature_flags set enabled = false where key = 'auto_approve_registrations';
