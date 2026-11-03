-- Account deletion, as Google Play requires: a signed-in person can ask for their account and
-- data to be deleted from inside the app or from the /data-deletion web page. The team finishes
-- it within 30 days; records the law requires (orders, invoices, payments, khata) are kept,
-- detached from the person.

create or replace function public.request_account_deletion(p_reason text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_row public.data_deletion_requests;
begin
  -- One open request per person: asking again returns the one already in progress.
  select * into v_row
    from public.data_deletion_requests r
   where r.user_id = v_uid and r.status in ('requested', 'in_review')
   order by r.created_at desc
   limit 1;

  if not found then
    insert into public.data_deletion_requests (user_id, phone, full_name, reason)
    select v_uid, p.phone, p.full_name, nullif(left(btrim(coalesce(p_reason, '')), 1000), '')
      from public.profiles p
     where p.id = v_uid
    returning * into v_row;
  end if;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status, 'created_at', v_row.created_at);
end;
$$;

-- The person's open request, for the page to show "received on ..." instead of the form.
create or replace function public.my_account_deletion()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', r.id, 'status', r.status, 'created_at', r.created_at)
    from public.data_deletion_requests r
   where r.user_id = (select auth.uid()) and r.status in ('requested', 'in_review')
   order by r.created_at desc
   limit 1
$$;

revoke execute on function public.request_account_deletion(text) from public, anon;
revoke execute on function public.my_account_deletion() from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.my_account_deletion() to authenticated;
