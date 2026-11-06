-- InvoicePilot AI — core schema
-- Tables: projects, documents, invoices, change_plans, processing_jobs, messages
-- Storage buckets: 'originals' (uploads) and 'outputs' (generated).
-- Row-Level Security: owner-only access, enforced on every table and on storage.

create extension if not exists "pgcrypto";

create type public.project_status as enum (
  'WAITING_FOR_PDF',
  'PDF_RECEIVED',
  'WAITING_FOR_IMAGES',
  'IMAGES_RECEIVED',
  'COLLECTING_CHANGES',
  'CHANGE_SUMMARY',
  'APPROVED',
  'PROCESSING',
  'QUALITY_CHECK',
  'COMPLETED',
  'CANCELLED'
);

create type public.document_kind as enum ('pdf', 'image');

create type public.change_plan_status as enum ('draft', 'awaiting_approval', 'approved', 'rejected');

create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed');

create type public.chat_role as enum ('system', 'assistant', 'user');

-- Projects -------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_name  text not null,
  status        public.project_status not null default 'WAITING_FOR_PDF',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index projects_user_idx on public.projects(user_id, created_at desc);

-- Documents (uploads) --------------------------------------------------------
create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  original_filename  text not null,
  storage_path       text not null,
  document_type      public.document_kind not null,
  mime_type          text not null,
  size_bytes         bigint not null,
  page_count         int,
  created_at         timestamptz not null default now()
);
create index documents_project_idx on public.documents(project_id);

-- Invoices (extracted from uploads) -----------------------------------------
create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  document_id     uuid references public.documents(id) on delete set null,
  invoice_number  text,
  source_page     int,
  extracted_data  jsonb not null default '{}'::jsonb,
  confidence      numeric(4,3),
  created_at      timestamptz not null default now()
);
create index invoices_project_idx on public.invoices(project_id);

-- Change plans ---------------------------------------------------------------
create table public.change_plans (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  changes_json  jsonb not null,
  status        public.change_plan_status not null default 'awaiting_approval',
  created_at    timestamptz not null default now(),
  approved_at   timestamptz
);
create index change_plans_project_idx on public.change_plans(project_id, created_at desc);

-- Processing jobs ------------------------------------------------------------
create table public.processing_jobs (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  change_plan_id  uuid references public.change_plans(id) on delete set null,
  status          public.job_status not null default 'queued',
  output_path     text,
  quality_report  jsonb,
  error           text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index processing_jobs_project_idx on public.processing_jobs(project_id, created_at desc);

-- Conversation messages ------------------------------------------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  role        public.chat_role not null,
  content     text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index messages_project_idx on public.messages(project_id, created_at asc);

-- Updated-at trigger ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- RLS ------------------------------------------------------------------------
alter table public.projects         enable row level security;
alter table public.documents        enable row level security;
alter table public.invoices         enable row level security;
alter table public.change_plans     enable row level security;
alter table public.processing_jobs  enable row level security;
alter table public.messages         enable row level security;

create policy projects_owner on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy documents_owner on public.documents
  for all using (
    exists (select 1 from public.projects p where p.id = documents.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = documents.project_id and p.user_id = auth.uid())
  );

create policy invoices_owner on public.invoices
  for all using (
    exists (select 1 from public.projects p where p.id = invoices.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = invoices.project_id and p.user_id = auth.uid())
  );

create policy change_plans_owner on public.change_plans
  for all using (
    exists (select 1 from public.projects p where p.id = change_plans.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = change_plans.project_id and p.user_id = auth.uid())
  );

create policy processing_jobs_owner on public.processing_jobs
  for all using (
    exists (select 1 from public.projects p where p.id = processing_jobs.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = processing_jobs.project_id and p.user_id = auth.uid())
  );

create policy messages_owner on public.messages
  for all using (
    exists (select 1 from public.projects p where p.id = messages.project_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = messages.project_id and p.user_id = auth.uid())
  );

-- Storage buckets ------------------------------------------------------------
-- Private buckets; access is granted by RLS policies that require the first
-- path segment to equal the authenticated user's id.
insert into storage.buckets (id, name, public)
  values ('originals', 'originals', false)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('outputs', 'outputs', false)
  on conflict (id) do nothing;

create policy "originals read own"
  on storage.objects for select
  using (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "originals write own"
  on storage.objects for insert
  with check (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "originals update own"
  on storage.objects for update
  using (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "originals delete own"
  on storage.objects for delete
  using (bucket_id = 'originals' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "outputs read own"
  on storage.objects for select
  using (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "outputs write own"
  on storage.objects for insert
  with check (bucket_id = 'outputs' and (storage.foldername(name))[1] = auth.uid()::text);
