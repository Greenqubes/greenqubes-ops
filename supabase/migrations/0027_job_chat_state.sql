-- Tracks per-user read state and notification throttle for job chat.
-- One row per (job, user). Used by the chat notification throttle logic.
create table public.job_chat_state (
  job_id           uuid not null references public.jobs(id)  on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  last_seen_at     timestamptz,
  last_notified_at timestamptz,
  primary key (job_id, user_id)
);

alter table public.job_chat_state enable row level security;

-- Users can read and upsert their own row (used by the chat-read route)
create policy "users can manage own chat state" on public.job_chat_state
  for all
  using (
    user_id = (select id from public.users where auth_id = auth.uid())
  )
  with check (
    user_id = (select id from public.users where auth_id = auth.uid())
  );
