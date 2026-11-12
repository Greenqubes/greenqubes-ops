-- 0071_chat_open_to_office_roles.sql
-- The job chat is open to every office role (Nic, 2026-11-12: "chat rule
-- should just be open for everyone. non relevant personel wont enter the job
-- form anyways ... installer only can see the job chat they are assigned on
-- anyways so its fine").
--
-- Number claimed 2026-11-12: live DB (migration list) at 0070, every branch
-- tops out at 0070 or below.
--
-- Why: the chat rule was last set in 0019/0024, before the designer,
-- coordinator, production (0033) and hr (0057) roles existed. The files rule
-- had the same gap and was widened in 0049/0050/0058; the chat never was.
-- Checked on the live DB before this file (as one real account per role,
-- rolled back): designer read 0 of 18 messages, production 0, hr 0,
-- coordinator 2; none of them could send a text.
--
-- After this file, office roles (sales, scheduler, admin, designer,
-- coordinator, production, hr) read and send in every job's chat. Installers
-- are UNCHANGED: their own jobs (0024 by assignment) plus completed jobs
-- (0053). Drafts stay private (0062's restrictive "pending private" still
-- applies on top of everything here). HR's job page still hides the chat box
-- (isReadOnlyOfficeRole) — this only stops the database being the reason.
--
-- Additive only: new permissive policies; nothing existing is dropped. The
-- older, narrower policies are now covered by these and harmless.
-- Policies use the auth.uid() EXISTS form, not get_my_*(): 0008/0023 record
-- that get_my_*() policies dropped realtime events here, and the chat is live.
-- No new table, so the 2026-10-30 grants rule does not apply.

-- ── Read every job's chat ───────────────────────────────────────────────────
drop policy if exists "messages: office roles read" on public.messages;
create policy "messages: office roles read"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_id = auth.uid()
        and u.role::text in ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production', 'hr')
    )
  );

-- ── Send in every job's chat (as yourself only) ─────────────────────────────
drop policy if exists "messages: office roles post" on public.messages;
create policy "messages: office roles post"
  on public.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.users u
      where u.auth_id = auth.uid()
        and u.id = messages.author_id
        and u.role::text in ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production', 'hr')
    )
  );

-- ── The grey "deleted by" lines follow the chat (0070) ──────────────────────
drop policy if exists "chat deletions: office roles read" on public.chat_deletions;
create policy "chat deletions: office roles read"
  on public.chat_deletions for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.auth_id = auth.uid()
        and u.role::text in ('sales', 'scheduler', 'admin', 'designer', 'coordinator', 'production', 'hr')
    )
  );

-- ── Photos and files sent IN THE CHAT ───────────────────────────────────────
-- Sales, scheduler, admin, coordinator and production already add files on
-- any job (0050). Designers and hr could only add on Ongoing/Scheduled jobs
-- (0067), so a photo sent in a completed job's chat (open 7 days after
-- completion) failed for them. A chat photo is a files row of kind
-- 'attachment' with no folder (bucket_id null) — the Files tab's folders go
-- through their own server routes — so this opens the chat and nothing else.
drop policy if exists "files: chat photos by designer and hr" on public.files;
create policy "files: chat photos by designer and hr"
  on public.files for insert to authenticated
  with check (
    kind = 'attachment'
    and bucket_id is null
    and job_id is not null
    and exists (
      select 1 from public.users u
      where u.auth_id = auth.uid()
        and u.role::text in ('designer', 'hr')
    )
  );
