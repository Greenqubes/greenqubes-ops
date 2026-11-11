-- 0070_gallery_hides_and_chat_deletions.sql
-- The job Gallery (Nic, 2026-11-11; spec 2026-11-11-gallery-groups-bulk-sheet-design.md
-- Part 3; plan 2026-11-11-job-gallery.md Task 3). Additive only: two new tables
-- and one index; nothing existing changes.
--
-- Number claimed 2026-11-11: live DB (migration list --linked) and every branch
-- top out at 0069.
--
--   job_item_hides  — WhatsApp's "Delete for me": a person hides a file or a
--                     voice note from THEIR OWN gallery and chat. Everyone else
--                     is unaffected. Each person sees and writes only their rows.
--   chat_deletions  — the grey "Photo deleted by <name>" line left in the chat
--                     when a chat photo, file or voice note is deleted for
--                     everyone. The item itself is removed as before (row + R2
--                     object), so every existing reader of files/messages is
--                     untouched. Written only by the server (service key).
--
-- Policies use the auth.uid() EXISTS form, not get_my_*(): 0008/0023 record
-- that get_my_*() policies dropped realtime events in this project, and both
-- tables are watched live (final review, 2026-11-11).

-- ── Delete for me ────────────────────────────────────────────────────────────
create table public.job_item_hides (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  -- Scoped to a job so a job page loads only that job's hides (review I7).
  job_id      uuid not null references public.jobs(id) on delete cascade,
  file_id     uuid references public.files(id) on delete cascade,
  message_id  uuid references public.messages(id) on delete cascade,
  created_at  timestamptz not null default now(),
  check ((file_id is null) <> (message_id is null)),
  unique (user_id, file_id),
  unique (user_id, message_id)
);

create index job_item_hides_user_job_idx on public.job_item_hides (user_id, job_id);
-- The cascades from files/messages look rows up by these.
create index job_item_hides_file_idx    on public.job_item_hides (file_id)    where file_id is not null;
create index job_item_hides_message_idx on public.job_item_hides (message_id) where message_id is not null;

alter table public.job_item_hides enable row level security;

create policy "item hides: own rows read"
  on public.job_item_hides for select to authenticated
  using (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.id = job_item_hides.user_id));

create policy "item hides: own rows add"
  on public.job_item_hides for insert to authenticated
  with check (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.id = job_item_hides.user_id));

create policy "item hides: own rows remove"
  on public.job_item_hides for delete to authenticated
  using (exists (select 1 from public.users u where u.auth_id = auth.uid() and u.id = job_item_hides.user_id));

grant select, insert, update, delete on public.job_item_hides to authenticated;
grant select, insert, update, delete on public.job_item_hides to service_role;

-- ── Deleted-for-everyone lines in the chat ──────────────────────────────────
create table public.chat_deletions (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.jobs(id) on delete cascade,
  item_kind        text not null check (item_kind in ('photo', 'video', 'file', 'voice')),
  -- When the deleted item was SENT, so the line sits where it was.
  item_ts          timestamptz not null,
  deleted_by       uuid references public.users(id) on delete set null,
  deleted_by_name  text not null,
  created_at       timestamptz not null default now()
);

create index chat_deletions_job_ts_idx on public.chat_deletions (job_id, item_ts);

alter table public.chat_deletions enable row level security;

-- Read exactly as the chat's own messages are read TODAY — 0024's two
-- policies (sales / scheduler / admin, or assigned to the job) and 0053's
-- installers on completed jobs — so no one sees a line in a chat they could
-- not see. No insert/update/delete policy: the server writes these with the
-- service key after its own checks.
create policy "chat deletions: select by role"
  on public.chat_deletions for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_id = auth.uid()
        and u.role::text in ('sales', 'scheduler', 'admin')
    )
  );

create policy "chat deletions: select by assignment"
  on public.chat_deletions for select to authenticated
  using (
    exists (
      select 1 from public.users u
      join public.job_assignees ja on ja.user_id = u.id
      where u.auth_id = auth.uid()
        and ja.job_id = chat_deletions.job_id
    )
  );

create policy "chat deletions: installer reads completed jobs"
  on public.chat_deletions for select to authenticated
  using (get_my_role() = 'installer' and job_is_completed(job_id));

-- Pending privacy (0062): a draft's chat lines follow the draft.
create policy "pending private"
  on public.chat_deletions as restrictive for all to authenticated
  using (not job_hidden_from_me(job_id))
  with check (not job_hidden_from_me(job_id));

grant select, insert, update, delete on public.chat_deletions to authenticated;
grant select, insert, update, delete on public.chat_deletions to service_role;

-- Live updates, as messages/files have (0009): a deleted line appears in an
-- open chat without a refresh. Full rows so job_id is in every event.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chat_deletions'
  ) then
    alter publication supabase_realtime add table public.chat_deletions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'job_item_hides'
  ) then
    alter publication supabase_realtime add table public.job_item_hides;
  end if;
end $$;

alter table public.chat_deletions replica identity full;
alter table public.job_item_hides replica identity full;

-- ── Voice notes can now be signed and deleted by their key ──────────────────
-- /api/r2/download-url and the voice delete route look a message up by
-- voice_url; without this every lookup scans the messages table.
create index if not exists messages_voice_url_idx on public.messages (voice_url) where voice_url is not null;
