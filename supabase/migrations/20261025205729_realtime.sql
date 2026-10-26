-- =============================================================================================
-- Realtime: tables later phases subscribe to with postgres_changes. Delivery respects RLS, so a
-- subscriber only receives rows it may read. Scheduled jobs (pg_cron) ship with their features.
--   orders                B2B order board / live tracking
--   order_status_history  order events timeline
--   notifications         in-app notification centre
-- =============================================================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.orders, public.order_status_history, public.notifications;
