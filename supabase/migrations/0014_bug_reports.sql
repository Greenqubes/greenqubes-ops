create table bug_reports (
  id             uuid primary key default gen_random_uuid(),
  user_email     text,
  user_role      text,
  route          text,
  message        text not null,
  priority       text not null check (priority in ('low', 'medium', 'high', 'urgent')),
  status         text not null default 'open' check (status in ('open', 'fixed')),
  screenshot_key text,
  markdown_file  text,
  ip_address     text,
  platform       text,
  browser        text,
  os             text,
  screen         text,
  created_at     timestamptz default now(),
  resolved_at    timestamptz
);

alter table bug_reports enable row level security;
-- All access via service-role API routes only — no direct client access
