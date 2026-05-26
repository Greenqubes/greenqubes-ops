-- In-app notifications (e.g. "sent back" events shown in the bell drawer)
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null default 'sent_back',
  job_id     uuid references public.jobs(id) on delete cascade,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- Users can only see their own notifications
create policy "users can select own notifications" on public.notifications
  for select using (
    user_id = (select id from public.users where auth_id = auth.uid())
  );

-- Server-side routes insert notifications for other users (e.g. scheduler sending back)
create policy "authenticated can insert notifications" on public.notifications
  for insert with check (auth.uid() is not null);

-- Users can mark their own notifications as read
create policy "users can update own notifications" on public.notifications
  for update using (
    user_id = (select id from public.users where auth_id = auth.uid())
  );

-- Users can delete their own notifications
create policy "users can delete own notifications" on public.notifications
  for delete using (
    user_id = (select id from public.users where auth_id = auth.uid())
  );

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
