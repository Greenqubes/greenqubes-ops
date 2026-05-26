create table public.attachment_buckets (
  id         uuid primary key default gen_random_uuid(),
  job_id     uuid not null references public.jobs(id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.attachment_buckets enable row level security;

create policy "authenticated read attachment_buckets"
  on public.attachment_buckets for select
  to authenticated using (true);

create policy "authenticated insert attachment_buckets"
  on public.attachment_buckets for insert
  to authenticated with check (true);

create policy "authenticated update attachment_buckets"
  on public.attachment_buckets for update
  to authenticated using (true);

create policy "authenticated delete attachment_buckets"
  on public.attachment_buckets for delete
  to authenticated using (true);

alter table public.files
  add column if not exists bucket_id uuid references public.attachment_buckets(id) on delete set null;

alter table public.files
  add column if not exists url_text text;
