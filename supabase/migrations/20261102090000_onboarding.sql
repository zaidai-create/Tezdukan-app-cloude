-- Onboarding: new dukans and distributors register themselves from the app (register_shop /
-- register_organization). While testing, a feature flag approves them on the spot so a new
-- shopkeeper can order straight away; in production admins approve. Customers see nearby
-- approved dukans through a definer function, since RLS only shows a shop to its own people.

insert into public.feature_flags (key, description, enabled)
values (
  'auto_approve_registrations',
  'Approve new dukans and distributors as soon as they register. Testing only.',
  false
)
on conflict (key) do nothing;

create or replace function private.feature_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select f.enabled from public.feature_flags f where f.key = p_key), false)
$$;

create or replace function private.tg_auto_approve_registration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    if private.feature_enabled('auto_approve_registrations') then
      new.status := 'approved';
      new.approved_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Seeds and admin tools insert shops and distributors as the service role.
grant execute on function private.feature_enabled(text) to authenticated, service_role;
grant execute on function private.tg_auto_approve_registration() to authenticated, service_role;

create trigger auto_approve_registration
  before insert on public.shops
  for each row execute function private.tg_auto_approve_registration();

create trigger auto_approve_registration
  before insert on public.organizations
  for each row execute function private.tg_auto_approve_registration();

-- Approved dukans, nearest first when a location is given. Only what a shop shows on its
-- signboard: name, area, address and contact numbers.
create or replace function public.nearby_dukans(
  p_lat numeric default null,
  p_lng numeric default null,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.distance_m nulls last, x.name), '[]'::jsonb)
    from (
      select s.id, s.name, s.slug, s.kind, s.address_line, s.phone, s.whatsapp, s.photo_path,
             a.name as area_name, a.name_ur as area_name_ur,
             case
               when p_lat is null or p_lng is null then null
               else round(extensions.st_distance(s.location, private.make_point(p_lat, p_lng)))::integer
             end as distance_m
        from public.shops s
        left join public.service_areas a on a.id = s.area_id
       where s.status = 'approved'
       order by distance_m nulls last, s.name
       limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) x
$$;

revoke execute on function public.nearby_dukans(numeric, numeric, integer) from public, anon;
grant execute on function public.nearby_dukans(numeric, numeric, integer) to authenticated;
