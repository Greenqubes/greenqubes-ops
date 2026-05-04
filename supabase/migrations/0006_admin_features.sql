-- =============================================================
-- 0006_admin_features.sql
-- · digest_subscriber flag on users
-- · api_usage_logs — every outbound AI/storage/Telegram call
-- =============================================================

-- Digest subscriber flag: which users receive the Monday digest
alter table users add column if not exists
  digest_subscriber boolean not null default false;

-- ── api_usage_logs ─────────────────────────────────────────────────────────────
-- Logs every outbound API call made through our system so we can:
--   • Track cost per user and service
--   • Compare our records against provider billing for anomaly detection
--   • Detect off-hours or unusual-IP activity

create table if not exists api_usage_logs (
  id             uuid        primary key default gen_random_uuid(),
  service        text        not null,   -- 'anthropic' | 'voyage' | 'r2' | 'telegram'
  endpoint       text        not null,   -- e.g. 'messages.stream', 'embed', 'putObject'
  called_by      uuid        references users(id) on delete set null,
  job_id         uuid        references jobs(id)  on delete set null,
  tokens_in      integer,
  tokens_out     integer,
  estimated_cost numeric(10, 6),
  ip_address     text,
  user_agent     text,
  ts             timestamptz not null default now()
);

alter table api_usage_logs enable row level security;

-- Schedulers can read the full log; service role writes
create policy "scheduler reads usage logs" on api_usage_logs
  for select using (get_my_role() = 'scheduler');

create policy "service inserts usage logs" on api_usage_logs
  for insert with check (true);

-- Indexes for the dashboard queries
create index if not exists api_usage_logs_ts_idx
  on api_usage_logs (ts desc);

create index if not exists api_usage_logs_service_ts_idx
  on api_usage_logs (service, ts desc);

create index if not exists api_usage_logs_called_by_idx
  on api_usage_logs (called_by, ts desc);
