-- =============================================================
-- 0007_crash_logs.sql
-- · crash_logs — records every React render crash and API exception
-- =============================================================

create table if not exists crash_logs (
  id              uuid        primary key default gen_random_uuid(),
  occurred_at     timestamptz not null default now(),
  route           text        not null,
  error_message   text        not null,
  stack_trace     text,
  component_stack text,
  user_id         uuid        references users(id) on delete set null,
  user_email      text,
  user_agent      text,
  markdown_body   text        not null,
  resolved        boolean     not null default false
);

alter table crash_logs enable row level security;

create policy "scheduler reads crash logs" on crash_logs
  for select using (get_my_role() = 'scheduler');

create policy "service inserts crash logs" on crash_logs
  for insert with check (true);

create policy "service updates crash logs" on crash_logs
  for update using (true);

create index if not exists crash_logs_occurred_at_idx
  on crash_logs (occurred_at desc);

create index if not exists crash_logs_resolved_idx
  on crash_logs (resolved, occurred_at desc);
