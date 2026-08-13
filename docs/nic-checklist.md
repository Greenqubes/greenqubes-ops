# Nic's Checklist — Things Only You Can Do

> Claude handles the coding. This file tracks every manual action, setup step, or decision that needs a human. Read this at the start of every session.

_Last updated: 2026-08-12 (feat-realtime — live updates everywhere shipped to production; migration 0043 applied)_

---

## Pending — Next Session

### Backup — fixed 2026-08-12, two follow-ups

- [x] **[Nic] Nightly backup now working end to end** — R2 files **and** database dump both verified. `SUPABASE_DB_URL` switched from the direct host (`db.<ref>.supabase.co`, now **IPv6-only** and unreachable from this PC) to the **IPv4 session pooler** on port 5432. Set in **machine** scope; the user-scope copy was deleted so there's one source of truth.
- [x] **[Nic] Database password rotated** — done 2026-08-12, machine env var updated to the new pooler URI and verified. Note: a Supabase password reset takes ~15–30 seconds to reach the pooler; an immediate connection attempt after resetting will fail with "password authentication failed" even when the new password is correct. Wait before assuming it's wrong.
- [x] **[Nic] Both scheduled tasks now run whether logged in or not** — done 2026-08-12 via `Set-ScheduledTask` with stored credentials (the Task Scheduler GUI dialog silently reverts if the password prompt is cancelled). `Greenqubes Nightly Backup` and `Greenqubes Obsidian Sync` are both `LogonType: Password`, `RunLevel: Highest`; both test-run clean. **If the `GQAdmin` Windows password ever changes, both tasks stop working with no warning** — the stored credential must be re-entered.
- [ ] **[Nic] Check whether the old DB password is used anywhere else** — anything still holding the pre-2026-08-12 password is now broken: Vercel environment variables, Bryan's `.env.local`, any other script on the server PC. Do before go-live.
- [ ] **Nothing alerts you if the backup stops** — this is exactly how it went unnoticed for three months. The Obsidian sync and overdue cron both write a row to the `events` table, which the Admin → Health tab reads to show "last run". The backup writes nothing. Small piece of work: have `backup.sh` log an event on success, and show it on the Health tab alongside the others.
- [ ] **Decision — Telegram watchdog for silent failures** (offered 2026-08-12, infra-config) — the vault sync died for 57 days and nobody noticed because the Health tab only shows the problem if someone looks. Proposal: a small addition to an existing Vercel cron that Telegrams you when no vault-sync (and, once it logs events, backup) row has appeared for ~2 days. Runs on Vercel so it works even when the server PC is down. Say the word and it gets built in a session.
- [ ] **The R2 backup is a mirror, not history** — `rclone sync` makes the local copy match the bucket exactly, so a file deleted in R2 disappears from the local copy on the next run. It protects against Cloudflare being unavailable, not against someone deleting a file. If you want to recover deleted files, that needs dated snapshots or R2 object versioning — a separate decision.


### Future planning notes (from 2026-07-22, Phase 3 session)

- [x] **[Nic] Schedule tab: list view scrolling UX** — DONE 2026-08-05, live on production. Windowed week↔month strip, jump calendar, Today button, Monday-start weeks, chips removed. Smoke test passed desktop + mobile ([schedule-list-ux-smoke-test.md](schedule-list-ux-smoke-test.md)). See [ux/ux-schedule-20260805-1-note.md](ux/ux-schedule-20260805-1-note.md).
- [ ] **Port to mobile apps — Android (.apk) + iOS (.ipa)** — requested by company directors. Big piece of work; needs its own planning session (approach, app store accounts, how it shares code with the web app).
- [ ] **Desktop apps — Windows (.exe) + macOS (.dmg)** — once live, package the system as installable desktop apps if possible. Plan alongside the mobile port since the approach likely overlaps.
- [ ] **Full security + integrity audit before go-live** — check the whole webapp for security loopholes and cyber-attack exposure. Once live this is core operations — downtime means the whole company stops. Must cover: access control (RLS), auth, API routes, exposed secrets, backup/recovery, and what happens if each service (Vercel/Supabase/R2/Telegram) goes down. Has to be bulletproof.
- [ ] **Telegram notification tracker on the job form** (noted 2026-08-05, ux-jobs) — build the real notification tracker behind the "Notifications — coming soon" placeholder card (bottom of the Team tab in the new job-form layout): show which Telegram notifications were sent for the job (assignments, clash alerts, chat batches), to whom, and when. Needs its own design session.
- [ ] **Sub-jobs under a main job** (noted 2026-08-05, ux-jobs) — a job should be able to belong to a parent job (picked via a "parent job" dropdown), so one big project can hold several sub-jobs. Big piece: touches the data model, schedule/FCFS display, installer views, and possibly duplication. Needs its own design session before any build.

### Workflow V2 (from 2026-06-05, chore-jobs)

- [x] **[Nic] Workflow V2 implementation — Phase 1 (roles + workflow simplification)** — implemented 2026-06-12 on `feat-workflow-v2` (migrations 0033–0036 applied; approval workflow removed; Push to Schedule live; FCFS tab in nav for all roles). See [feat/feat-jobs-20260612-1-note.md](feat/feat-jobs-20260612-1-note.md).
- [x] **[Nic] Finish Phase 1 smoke test — sections 3–5** — PASSED 2026-06-24. Found + fixed 4 things: New Job screen wasn't running the clash check on push; clash modal now clears when you shift the time + button reworded to "Push to Schedule"; chat photo attachments showed "Unknown" sender (fixed); installer My Jobs cards weren't showing the project title (fixed). See [fix/fix-jobs-20260624-1-note.md](fix/fix-jobs-20260624-1-note.md).
- [x] **[DEFERRED to Phase 3] Clash check when editing an already-scheduled job** — moving a scheduled job's time/installer onto another scheduled job currently shows NO clash warning (the check only fires when first pushing a pending job to the schedule). This is the FCFS board's job (Phase 3) — leave it for now.
- [x] **[Nic] Clean-cut switchover (strategy reminder)** — executed 2026-08-03; see the regression test → switchover item below.
- [ ] **(Optional, for testing) See push notifications yourself** — paste your Telegram chat ID into scheduler Wei Qing's row (Admin → Users). Currently only Benny Teo (scheduler, TG set) receives the "New Job — Assign Installer" message. **Remove before go-live.**
- [x] **[Nic] Run `npx supabase db push` for migration 0037** — applied 2026-07-22. Installer visibility now ignores suggestions; coordinator + production can save job changes.
- [x] **[Nic] Workflow V2 — Phase 2 (job form role permissions + installer assignment)** — implemented + smoke test PASSED 2026-07-22. All 6 sections green. See [feat/feat-jobs-20260722-1-note.md](feat/feat-jobs-20260722-1-note.md) and the tick-through checklist at [workflow-v2-phase2-smoke-test.md](workflow-v2-phase2-smoke-test.md).
- [x] **[Nic] Decision — FCFS tab for installers** — dropped 2026-07-22. Installers only need their own jobs; FCFS is a scheduler/coordinator planning tool. Still shown to all other roles.
- [x] **[Nic] Workflow V2 — Phase 3 (FCFS board)** — built + smoke test PASSED 2026-07-22, all feedback fixes verified on preview. See [workflow-v2-phase3-smoke-test.md](workflow-v2-phase3-smoke-test.md).
- [x] **[Nic] Run `npx supabase db push` for migration 0038** — applied 2026-07-22. FCFS rank now counts from push-to-schedule (your decision: sales can't see each other's pending jobs, so creation order would be unfair).
- [x] **[Nic] Workflow V2 — Phase 4 (external persistent links + sub-installer + task list + external POC bucket)** — built + smoke test PASSED 2026-07-30, including your feedback fixes (bucket for every office role with sales suggestions; "Supporting Role" sub-installer Telegram). See [workflow-v2-phase4-smoke-test.md](workflow-v2-phase4-smoke-test.md).
- [x] **[Nic] Run `npx supabase db push` for migrations 0039 + 0040** — applied 2026-07-30. External contacts (lifetime links), job task list, sales-suggestion flag.
- [x] **[Nic] Full V2 regression test → clean-cut switchover** — regression test passed (Nic, on the preview); switchover done 2026-08-03: `feat-workflow-v2` → `dev` → `main`, production verified live on V2 (`/ext` + `/fcfs` serving). `feat-workflow-v2` kept for historical record (Nic's call) — no new pushes to it. See [chore/chore-config-20260803-1-note.md](chore/chore-config-20260803-1-note.md).
- [ ] **External page job chat (deferred)** — outside installers currently call the person-in-charge from their link page; live chat there needs its own session if you want it.
- [ ] **FCFS board — extra views (deferred)** — the approved mockup shows Day / Week / Month / By Project / By Installer toggles; only **Day** is built (your call, 2026-07-22). The other four need designs before a build session.

### Test data to wipe before go-live (from Phase 1 + 2 testing)

- [ ] **Delete the test jobs** created during testing — "Test Job" (2026-06-12), "123", "test123smoke345", the Phase 2 ones ("Testing sales suggest installer -> confirm installer -> installer otp"), the Duplicate-testing "… (Copy)" jobs, and the 2026-08-06 feat-files pair ("Test Job R2 Cloudflare Fix" + its Copy). Wipe all test data in one pass right before go-live.
- [ ] **Remove the test installer account** (or keep it — your call) used to verify installers can't see suggestions.
- [ ] **Delete the test external contacts** created during Phase 4 testing — remove them from the External installers bucket on any job form (delete + their links die with them).

### Setup (from 2026-05-29, feat-admin-3)

- [x] **[Nic] Run `npx supabase db push`** — migration 0032 applied. `deleted_at` column + partial index live on remote DB.

### Features (from 2026-05-26, vault-convention)

- [x] **[Nic] R2 human-readable folder names** — DONE 2026-08-06 with a simpler design that supersedes the June plan: new jobs get `{YYYY-MM-DD}_{Project-Title}_{8-char-code}` folders stamped by a DB trigger at creation (migration 0042); no compulsory form fields, no renaming of existing files (your call — old jobs keep code folders), titles stay optional (`Untitled` fallback). See [feat/feat-files-20260806-1-note.md](feat/feat-files-20260806-1-note.md).

### Onboarding (from 2026-05-25, chore-onboarding)

- [x] **[Nic] Add Bryan as GitHub collaborator** — done 2026-05-28
- [x] **[Nic] Send Bryan the `.env.local` file** — done 2026-05-28
- [x] **[Nic] Add Bryan's Google account to Supabase** — done 2026-05-28

### Polish (from 2026-05-20, fix-assistant-history)

- [x] **[POLISH] Assistant history sidebar refresh has a noticeable delay** — fixed: optimistic "New Conversation" entry appears immediately on first send; live title update via Haiku after first reply; `liveOptimisticIdRef` prevents duplicate entries.

### Bugs (from 2026-05-20, feat-digest-bot)

- [x] **[MAJOR] Assistant history sidebar doesn't show latest saved chat** — fixed: `refreshTrigger` prop re-fetches sidebar after save.
- [x] **[MAJOR] Clicking a history item creates duplicate conversation entries** — fixed: `isDirtyRef` + `existingId` path updates existing row in place; original topic preserved.

### Bugs (from 2026-05-18, feat-clash-resolution)

- [x] **[MAJOR] Approval page: Save failed on Approve & Schedule click** — fixed.
- [x] **[MINOR] Friday bar missing in WeekWorkloadChart** — fixed.

### Features (from 2026-05-29)

- [ ] **Scheduler: view-only of all sales jobs (including unconfirmed)** — scheduler currently only sees scheduled jobs and the approvals queue. Add a read-only view of all pending/awaiting_approval jobs so scheduler has full visibility. Placement TBD: either a new tab in the Approvals bottom nav, or a separate section. Spec + placement decision needed before coding.

### Features (from 2026-05-18, feat-clash-resolution)

- [ ] **Schedule page visual overhaul** — Nic to share screenshot of target design. Full visual redesign of the /schedule page. Spec + plan needed before coding.

### Bugs (from 2026-05-14)

- [x] **Notification: submit/approve/send-back don't fire** — not a code bug. Test accounts (seed data) have no `telegram_chat_id`. Routes work correctly; notifications will fire once real users have TG IDs added via Admin → Users tab.
- [x] **Notification: overdue cron doesn't fire** — cron entry was missing from `vercel.json` (fixed). Manual test requires `Authorization: Bearer <CRON_SECRET>` header. To test manually: `curl -H "Authorization: Bearer <CRON_SECRET>" https://greenqubes-ops.vercel.app/api/notifications/overdue`
- [x] **Bug report fails when image attached** — root cause: R2 bucket had no CORS config. Fixed: CORS configured on R2 bucket (PUT + GET from Vercel + localhost). Code hardened: screenshot upload failure no longer blocks the report submission.
- [x] **Voice note requires microphone permission every time** — fixed: stream is now requested once per component lifecycle and reused across recordings. Tracks stopped on unmount.
- [x] **Job chat: attachment doesn't trigger anything** — fixed: R2 CORS was blocking the upload (resolved by CORS config). Added `kind: 'attachment'` handler to messages route so file attachments now send Telegram notifications like voice notes do.

### Bugs (from 2026-05-14)

- [x] **[Nic] AdminRoleModal double-Yes bug** — not a code bug; modal just needed time to load. Confirmed working.

### Features (added 2026-05-14, feat-design)

- [x] **Dark mode** — Claude Warm palette; next-themes; UserMenu Moon/Sun toggle; persists in localStorage; auto-detects system preference on first visit; contrast fixes across 8 components.
- [x] **Installer clash warning** — ClashResolutionModal with substitute selection, travel-time warning, keep-anyway flow (done in feat-clash-resolution).
- [x] **Bulk delete jobs** — fully implemented: checkboxes in list view, delete bar at bottom, confirm step, parallel DELETE calls per job. Already live on dev preview.

### Features (added 2026-05-12)

- [x] **Admin role (4th role)** — `admin` added to DB enum; RLS updated; email gates replaced; AdminRoleModal in UsersTab; migrations 0018–0020 applied.
- [x] **CLAUDE.md: roles rule update** — updated to "never add or remove roles without explicit user confirmation."
- [x] **Role name capitalisation (UI)** — Pill labels, UserMenu override chip, and UsersTab select options all updated to title case. DB enum values unchanged.
- [x] **Session timeout config** — keeping forever (free Supabase tier doesn't allow timebox config). Revisit when upgrading to paid tier.
- [x] **Admin page: back arrow to schedule** — added ArrowLeft link to `/schedule` in AdminShell header.

### Features (from pre-alpha test 2026-05-11)

- [x] **Voice note: live audio waveform while recording** — show an animated audio bar (waveform / level indicator) during recording so the user knows it's capturing.
- [x] **Job creation/edit/pending: time end optional** — removed required validation from `time_end` in CoreSection. Always optional now.
- [x] **Job creation/edit/pending: job description optional** — removed required validation from `description` in CoreSection. Always optional now.
- [x] **Job creation/edit/pending: time fields persist on edit** — fixed: `reset(values)` called after successful save so form baseline syncs with saved data and `isDirty` resets correctly.
- [x] **Job creation/edit/pending: AI "Suggest" button per text column** — SuggestField component added; /api/ai/suggest route (Haiku, SUGGEST_CONFIG for easy style edits); Project Title, Description, Notes, Production Instructions all wired. Preview-first UX with Accept/Dismiss.
- [ ] **Scheduler tab: send scheduled job back to sales** — when editing a scheduled job, add a "Send Back" button (left of Mark Complete). Opens same send-back flow as approvals queue.
- [ ] **Scheduler tab: delete job** — when editing a job, add a "Delete Job" button (left of Send Back). Hard-deletes from DB + removes from site. Confirmation modal required.
- [x] **Sales tab: recall job** — when editing a job in awaiting_approval status, whole form locked + single amber "Recall" button; recalls to pending status, normal pending layout resumes automatically.
- [x] **Sales tab: pre-send popup** — reimagined as full clash resolution system: installer double-booking detection (proper time-overlap logic), ClashResolutionModal with substitute selection (free/busy badges), keep-anyway flow, time-shift picker, travel-time warning for back-to-back jobs, team workload chart with week navigation.
- [x] **`NEXT_PUBLIC_APP_URL` in Vercel** — added to all 3 environments (Production, Preview, Development).

---

## Done This Session ✓ (2026-08-12, feat-realtime — Live Updates Everywhere)

- [x] **[Nic] Ran `npx supabase db push` for migration 0043** — `job_assignees` + `job_tasks` now broadcast changes; applied while production was live (additive, safe).
- [x] **[Nic] Two-window live tests passed on the branch preview AND the dev preview** — schedule, FCFS, job form (silent sync + amber banner protecting unsaved typing). First test round was accidentally on the dev preview, which didn't have the code yet — lesson: each branch has its own preview address.
- [x] **[Nic] Installer live test passed on production** — real installer login: formally assigned job appeared on its own; a suggestion stayed hidden (the security check).
- [x] **[Nic] Decision — admin page stays refresh-on-visit** — no live push for a single-user page; new bug reports already ping via Telegram.
- [x] **[Nic] Decision — `feat-live-updates` kept as an archive branch** — same rule as `feat-workflow-v2`: historical record only, no new pushes. Recorded in CLAUDE.md.

---

## Done This Session ✓ (2026-08-12, infra-config — Obsidian Sync Outage + KB Restore)

- [x] **[Nic] 57-day vault sync outage found and fixed** — sync died 7 June (print-server hang → restart → signed-out PC); revived 7 Aug, verified running unattended 5+ nights straight. Permanent logon fix recorded under infra-backup above.
- [x] **[Nic] Supplier pricelists restored to the assistant** — DAMA, Jacky Printing and Manhour Labor had been silently deleted from the knowledge base since early June; restored with correct role locks (sales/scheduler; Manhour sales-only) and verified row-by-row.
- [x] **[Nic] PTW files locked down (your call)** — COMPANY_PROFILE.md and MALLS.md had no visibility setting and would have been visible to installers; now sales/scheduler/coordinator only.
- [x] **Two sync-script bugs fixed with tests, live on dev + main** — Obsidian's multi-line frontmatter format was misread into garbage visibility tags; Windows line endings made the server produce one giant chunk per note and leave duplicates behind. 20 automated checks now cover both.
- [x] **Server PC diagnosis checklist written** — [server-pc-sync-checklist.md](server-pc-sync-checklist.md), phone-friendly, with a findings decoder.

## Done This Session ✓ (2026-08-12, infra-backup — Nightly Backup Was Never Running)

- [x] **[Nic] Found that there was no backup at all** — not a broken one, none. This checklist had claimed since May that a nightly 02:00 backup was running. The rclone setup and env var were done, and the script was hand-tested once on 7 May, but the Task Scheduler entry was never created. The R2 archive folder held **zero files** — three months of job attachments and photos existed only in Cloudflare.
- [x] **[Nic] Nightly backup created and verified** — `Greenqubes Nightly Backup`, daily 02:00. First run pulled 41 files / 15.3 MiB from R2 and produced a 205 KB database dump (22 tables with data, verified complete, not just a file of the right size).
- [x] **[Nic] Database connection fixed** — the saved address pointed at a server this PC physically cannot reach (IPv6-only, no IPv6 here). Switched to the IPv4 pooler address on port 5432.
- [x] **[Nic] Database password rotated and updated everywhere on the server PC.**
- [x] **[Nic] Both nightly tasks now run when nobody is logged in** — backup (02:00) and Obsidian sync (02:30). Previously they only ran if someone happened to be signed in to the server PC. Both test-run clean afterwards.

---

## Done This Session ✓ (2026-08-06, infra-notifications — Overdue Alert Scope + Schedule)

- [x] **[Nic] Overdue alerts scoped to the last 3 days** — jobs dated more than 3 days ago no longer alert at all. They're treated as abandoned data rather than work to chase.
- [x] **[Nic] Cron settled at twice daily, 9am + 6pm SGT** — went daily → every 2 hours → your call to make it just twice a day. Confirmed showing correctly in the Vercel dashboard.
- [x] **[Nic] Manual production blast run** — sent 27 real Telegram alerts, which is what exposed the problem: the check had no lower date limit, so every old unfinished job re-fired on every run, forever.
- [x] **[Nic] Merged to production** — `dev` → `main` pushed 2026-08-06.

- [ ] **Clean up the ~27 finished-but-still-`scheduled` jobs** — those alerts weren't false alarms exactly; they're real jobs that were completed in real life but never marked complete in the app. With the 3-day cutoff they've gone quiet, but the data is still wrong and it will distort the FCFS board and any reporting. Worth a pass before go-live — fold into the test-data wipe below.

---

## Done This Session ✓ (2026-08-06, feat-files — File Names + Readable R2 Folders)

- [x] **[Nic] Scope + design decisions made** — fix names inside the app (store original name in DB, Cloudflare keys stay coded); folder pattern `{date}_{title}_{code}`; only NEW jobs get readable folders; folder frozen when the job is created (title edits never move files).
- [x] **[Nic] Ran `npx supabase db push` for migrations 0041 + 0042** — from the session's isolated copy of dev (your usual folder was on the other session's branch). This also cured the preview crash: the new code asked for the file-name column before it existed.
- [x] **[Nic] Smoke test passed on the preview** — real names in buckets/chat/camera uploads verified in the DB; duplicate carried names; readable folder `2026-08-06_Test-Job-R2-Cloudflare-Fix-Copy_0cd037cb` visible in the R2 dashboard.
- [x] **[Nic] Approved merge to production** — `dev` → `main` pushed 2026-08-06; DB was migrated before the deploy so production had no crash window.
- [x] **Old June R2-folder plan retired** — superseded by the simpler trigger design (see the ticked item above).

---

## Done This Session ✓ (2026-08-06, ux-jobs — Job Form Tabs + Duplicate)

- [x] **[Nic] Design decisions made** — phone gets 4 tabs (Details/Team/Files/Chat, "cleaner the better"); PC gets a two-column view (Details+Team left, Files+Chat right) with every card collapsible except Job Chat; New job shows the same 4 tabs with Files/Chat locked until saved.
- [x] **[Nic] Smoke test passed — phone AND PC** — tabs, columns, collapse memory, locked tabs all green on the preview.
- [x] **[Nic] Duplicate button scoped + tested** — copies Details-tab fields, attachment buckets and production photos into a new pending job; only location clears; title gets " (Copy)"; signed DO / completion photos / team / chat / tasks never copy.
- [x] **[Nic] Bug found during testing: bucket uploads appeared in job chat** — pre-existing production bug (chat and buckets share the same internal file tag); fixed and verified on the preview.
- [x] **[Nic] Approved merge to production** — `dev` → `main` pushed 2026-08-06; tabs redesign + Duplicate + chat fix all live.
- [x] **Future planning notes added** — Telegram notification tracker (behind the Team-tab placeholder card) and sub-jobs under a parent job (dropdown); both need their own design session.

---

## Done This Session ✓ (2026-08-05, ux-schedule — Schedule List Scrolling UX)

- [x] **[Nic] Smoke test passed — desktop AND mobile** — all 7 sections green after two feedback rounds (fixed heading arrows wider, month label centred, Today button moved left).
- [x] **[Nic] Approved merge to production** — `dev` → `main` pushed 2026-08-05; new schedule navigation live.
- [x] **[Nic] Design decisions made** — week↔month strip toggle (icon-only, shows target layout); filter chips removed; Monday-start weeks everywhere; jump calendar list-view-only for now.
- [x] **[Nic] Boss decision relayed — no new Bengali translations** — new UI text gets English + Chinese only; Bengali shows English automatically. Recorded in CONTEXT.md.
- [x] **Interactive mockup approved before build** — `public/mockups/schedule-list-ux/index.html` (kept for record).

---

## Done This Session ✓ (2026-07-30, feat-jobs — Workflow V2 Phase 4)

- [x] **Phase 4 built + smoke test PASSED — the Workflow V2 build is COMPLETE.** External installer lifetime links (public page: accept/decline, job detail, task ticking), external installers bucket, sub-installer bucket, job task list.
- [x] **Migrations 0039 + 0040 applied** — you ran `npx supabase db push` twice (0039 needed one fix: its random-link generator wanted a database add-on we don't have; swapped to the built-in one).
- [x] **Your feedback built in** — external bucket now visible to every office role: sales suggests (amber, invisible to the contact until confirmed), scheduler/coordinator confirms, designer/production view-only. Sub-installer Telegram reads "Job Assigned — Supporting Role" with the main team's names.
- [x] **Bugs found + fixed during your test** — copied external links pointed at the production site instead of the preview (now they use whichever site you're on); the sub-installer Telegram was silently rejected by Telegram (a formatting typo).
- [x] **Deferred by plan** — live chat on the external page; externals call the person-in-charge instead.

---

## Done This Session ✓ (2026-07-22, feat-jobs — Workflow V2 Phase 3)

- [x] **Phase 3 built + smoke test PASSED** — FCFS Board live at `/fcfs`: day timeline ranked first-come-first-served, colour-coded installer bars, clash chips + drawer, slide-in assignment panel. All 6 sections green after fixes.
- [x] **Migration 0038 applied** — you ran `npx supabase db push`. FCFS rank counts from when a job is **pushed to the schedule**, not when it was created (your call — sales can't see each other's pending jobs).
- [x] **Your smoke-test feedback fixed + verified** — 9am–6pm bar drift on wide screens; overlays no longer hidden behind the bottom nav; bolder "Created first (priority)" labels; scrollable clash chips; "All day" shown on the schedule tab for untimed jobs.
- [x] **New hard rule recorded in CLAUDE.md** — overlays (modals, drawers, panels) must always layer above the bottom nav.
- [x] **Bug: dropdowns hid newly provisioned users** — Person-in-Charge only listed sales; Sub POC only sales/scheduler/admin on the new-job form. Both now list every office role on both forms.
- [x] **Clash-on-edit gap closed** — editing a scheduled job's time/installer onto another booking now warns first (scheduler: Save Anyway / Go Back; coordinator: Alert Scheduler & Save / Re-assign).
- [x] **Future planning noted** — schedule list scroll UX, Android/iOS ports (directors' request), Windows/Mac desktop apps, full security audit before go-live.

---

## Done This Session ✓ (2026-07-22, feat-jobs — Workflow V2 Phase 2)

- [x] **Phase 2 built + smoke test PASSED** — all 6 sections green. Role-locked job form + installer suggestion → assignment flow.
- [x] **Migration 0037 applied** — you ran `npx supabase db push`.
- [x] **Suggestion flow works end-to-end** — sales suggests (yellow) → hidden from the installer → scheduler assigns (green) → Telegram fires → installer now sees it. Verified with a **real installer login**.
- [x] **Bug: attachment buckets wouldn't upload** — "upload failed" on Permit-to-Work / BCA / Designer JO / Others. Was tagging files with the wrong user id. **This was broken in production too**, not just the preview.
- [x] **Bug: installer's job list showed a blank title** — a fragile database join. Fixed; also added "Untitled job" for genuinely empty jobs.
- [x] **Bug: new-job form used your real role, not the previewed one** — sales suggestions were being saved as real assignments.
- [x] **Clash modal — Notify Scheduler / Push Anyways** added, plus a soft (non-blocking) heads-up when the clash is only because an installer has an all-day job with no fixed time.
- [x] **Preview-as now covers all 6 roles** (Coordinator, Designer, Production added).
- [x] **FCFS tab dropped from the installer view** (your decision).

---

## Done This Session ✓ (2026-06-11, fix-schedule)

- [x] **Mockup 404 fixed** — Workflow V2 HTML mockups moved to `public/mockups/workflow-v2/`; now accessible on Vercel preview at `/mockups/workflow-v2/index.html`.
- [x] **Schedule date strip shows all dates** — list view carousel now shows every day from earliest job to latest (filling gaps between jobs), not just days with assigned jobs.
- [x] **feat-workflow-v2 branch pushed** — merged up to date with dev and pushed to remote; Vercel generates a separate preview URL for this branch automatically.

## Done This Session ✓ (2026-06-05, infra-config)

- [x] **[Nic] Overdue cron moved to 8am SGT** — `vercel.json` updated from `0 10 * * *` (6pm SGT) to `0 0 * * *` (midnight UTC = 8am SGT).
- [x] **R2 folder naming pattern agreed** — new format: `{YYYY-MM-DD}_{Company}_{Client-Name}_{Project-Title}`; 4 sub-tasks captured in checklist for next coding session.
- [x] **plan.md session note link fixed** — last session note was linked to a non-existent file; corrected to `fix/fix-assistant-20260603-1-note.md`.

## Done This Session ✓ (2026-06-03, fix-rag)

- [x] **[Nic] Supplier pricing added to Obsidian vault** — DAMA acrylic pricelist + Jacky Printing pricelist created in vault/suppliers/; synced to Supabase kb_chunks; assistant can now answer supplier pricing questions.
- [x] **RAG retrieval fixed** — Voyage AI input_type (query/document) added; kb_chunks match threshold tuned to 0.35; filename prepended to embeddings for supplier name searchability.
- [x] **Table rendering in assistant chat** — MarkdownMessage now renders markdown tables with headers, borders, and alternating row shading.
- [x] **Merged dev → main** — all fixes live on production.

## Done This Session ✓ (2026-05-29, feat-admin-3)

- [x] **[Nic] Remove User feature — tested on preview** — removed a user via Admin → Users tab; modal confirmed correct. Feature live on Vercel preview. DB migration still needs applying (see pending above).

## Done Last Session ✓ (2026-05-28, feat-admin)

- [x] **[Nic] TELEGRAM_BUG_BOT_TOKEN + TELEGRAM_BUG_CHAT_ID added to Vercel** — bug report Telegram notifications now fire.
- [x] **Admin Bugs tab forbidden error fixed** — admin role now allowed in GET/PATCH /api/bugs routes.
- [x] **Screenshot modal** — bug report screenshots open in an inline modal instead of a new tab.
- [x] **Health tab: three Telegram bots** — ops, digest, and bugs bots all shown in system checks.
- [x] **Health tab: obsidian sync + overdue cron last-run time** — both now write events table rows; health tab shows last run instead of "unknown".
- [x] **API usage logging for Voyage, Telegram, R2** — all three now appear in the usage tracker.
- [x] **Unusual activity: non-Singapore IP rule + geolocation** — non-SG calls flagged with city/country/ISP.
- [x] **Bug tab: delete fixed bugs** — single delete button per card + multi-select bulk delete.
- [x] **Bug tab: sort controls** — open bugs sortable by received date; fixed bugs sortable by fixed or received date.

## Done This Session ✓ (2026-05-28, fix-bugs)

- [x] Bryan's Vercel build error resolved — migration conflict (0015 → 0031) fixed, TypeScript types updated; Bryan needs to pull dev into dev-bryan to pick up the fix.

## Done Last Session ✓ (2026-05-26, infra-config)

- [x] **[Nic] Task Scheduler entry created** — server PC (E drive) configured for daily 2:30 AM nightly obsidian sync; bat file tested and confirmed working.

## Done Last Session ✓ (2026-05-26, feat-vault)

- [x] **[Nic] Vault folder scaffolding** — created clients, suppliers, sops, jobs, templates, contacts, digest folders in greenqubes-kb; committed + pushed to vault repo; submodule pointer updated in main repo.
- [x] **[Nic] GitHub vault token** — fine-grained PAT created for greenqubes-kb (Contents: Read+Write); GITHUB_VAULT_REPO + GITHUB_VAULT_TOKEN added to .env.local and Vercel dashboard.
- [x] **Obsidian vault convention** — naming, tagging, visibility rules specced and documented at docs/superpowers/specs/2026-05-26-obsidian-vault-convention-design.md.
- [x] **Auto-write on digest promotion** — majority Telegram vote now auto-commits a Sonnet-generated .md note to vault/digest/ via GitHub API; promote route replaced (copy-paste HTML → JSON auto-commit); digest webhook fires auto-promote on majority; tested end-to-end on production.
- [x] **Nightly obsidian sync script** — scripts/nightly-obsidian-sync.bat created (git pull vault + obsidian-sync.ts); Task Scheduler setup guide at docs/setup-task-scheduler-obsidian-sync.md.

## Done This Session ✓ (2026-05-25, feat-assistant-3)

- [x] **Per-user history isolation** — migration 0030 drops the cross-read RLS policy on `asst_chats`; each user now only sees their own conversations.
- [x] **Optimistic "New Conversation" on first send** — sidebar shows new entry immediately when user sends first message; no waiting for save to complete.
- [x] **Live auto-rename via Haiku** — after AI's first reply, Haiku generates a 3–5 word title and updates the sidebar entry live; manual rename persists and blocks auto-rename.
- [x] **Rename from ⋮ dropdown** — rename modal with text input; optimistic update + PATCH `/api/assistant/rename`; persists on next load.
- [x] **Bulk multi-select delete** — "Select" mode with checkboxes on each row; terracotta delete bar at bottom; confirmation modal; parallel DELETE calls.
- [x] **Message count + star importance hidden** — removed from sidebar and history list UI; still stored in DB for backend use.
- [x] **Markdown rendering** — `MarkdownMessage` component renders `##/###`, `**bold**`, `*italic*`, `---`, `> blockquote`, `- lists` cleanly; no new npm dependencies; replaces raw `whitespace-pre-wrap` in both AssistantShell and FloatingChatPanel.
- [x] **Type while AI streams** — textarea no longer disabled during streaming; send button still blocked until reply finishes.
- [x] **Full-width "← Assistant" sub-header** — moved above sidebar + content row so it spans the full width; sidebar history list starts below it.
- [x] **New Chat button clears BottomNav** — restored `pb-[72px]` on sidebar footer so New Chat button is not covered by the fixed BottomNav.

## Done This Session ✓ (2026-05-21, ux-nav)

- [x] **CompanyBar shared component** — new `src/components/CompanyBar.tsx`; renders GreenQubes wordmark + Pre-Alpha + bell + user menu; sticky `top-0 z-30`; used in all 7 shells.
- [x] **NotificationDrawer decoupled from jobs prop** — now fetches overdue jobs internally via Supabase client on mount and on open; no longer needs `jobs: ScheduleJob[]` passed from parent.
- [x] **Company bar persistent across whole app** — ScheduleShell, ApprovalsShell, InstallerShell, AssistantShell, AdminShell, JobDetailShell, NewJobShell all use CompanyBar at the top.
- [x] **AdminShell stacking fixed** — existing admin header moved to `sticky top-[45px]` so it stacks below CompanyBar without overlap.
- [x] **BottomNav kept on list/dashboard pages only** — removed from job form shells after review (cramped with action bar); remains on Schedule, Approvals, Installer, Assistant, Admin.

## Done This Session ✓ (2026-05-21, ux-jobs)

- [x] **GreenqubesAI role dropdown locked** — Admin → Users tab hides role dropdown for GreenqubesAI user; shows a read-only label instead so it can't be accidentally changed.
- [x] **Person-in-Charge + Sub POC / Coordinators labels** — Team card renamed from "Main Sales / POC" and "Sales / POC" to clearer labels.
- [x] **Person-in-Charge X button** — shown only when the selected POC differs from the original job creator; pressing it reverts back to the original. Original creator never shows the X.
- [x] **Sales pending action bar** — two buttons: "Save Changes" (amber, saves all fields) + "Push for Approval" (terracotta, runs clash check then submits to scheduler).
- [x] **Scheduler awaiting_approval action bar** — "Send Back to Sales" (amber, opens SendBackModal) + "Approve & Notify" (terracotta, saves + approves + redirects to schedule).
- [x] **Duplicate (WIP) placeholder** — disabled dashed-border button between Delete and Cancel; implementation deferred.
- [x] **Sales awaiting_approval: form lock + Recall** — whole form read-only; Duplicate (WIP) hidden; single amber "Recall" button sets status back to pending; once recalled, normal pending layout (Delete, Duplicate WIP, Cancel | Save Changes + Push for Approval) resumes automatically.
- [x] **Sales scheduled state** — "Push for Approval" hidden; "Save Changes" expands to full width.
- [x] **InstallerGrid badge fix** — tick badge now overlays correctly (moved outside `rounded-full` div).
- [x] **SuggestField renamed** — "Improve" → "Suggest" throughout component.
- [x] **Upload API fix** — `production_instructions` added to valid upload kinds (was returning 400).

## Done Last Session ✓ (2026-05-20, feat-notifications-2)

- [x] **Chat notification throttle** — job chat Telegram notifications fire at most once per 1 minute per recipient; no more per-message spam.
- [x] **Accurate unseen message count** — new `job_chat_state` table tracks `last_seen_at` and `last_notified_at` per (job, user); notification shows real count of messages missed since last open.
- [x] **New chat batch template** — `tplJobChatBatch`: "💬 You have X New Messages / Project Title / Client / Time / Location / Date".
- [x] **View in app → opens system browser** — uses InlineKeyboardButton `url` type, not callback; opens Safari/Chrome instead of Telegram's built-in WebView.
- [x] **chat-read API route** — `POST /api/jobs/[id]/chat-read` upserts `last_seen_at = now()` for current user; called on ChatSection mount so unseen count resets when chat is opened.
- [x] **Migration 0027** — `job_chat_state` table applied to remote DB via `npx supabase db push`.
- [x] **CLAUDE.md branch exception removed** — feat-job-form-redesign branch exception removed; all changes go to `dev` branch as normal.

## Done Last Session ✓ (2026-05-20, feat-jobs)

- [x] **Attachment buckets** — jobs now have named file buckets (default: PERMIT-TO-WORK, BCA, DESIGNER JO, OTHERS); upload images/files, add URL links, rename buckets, delete buckets; images open in lightbox.
- [x] **Company/POC dropdowns** — SearchableSelect for client company and POC name on job form; add new company/contact inline; delete with confirm modal.
- [x] **Sales POC dropdown** — sales POC field on new job form uses SearchableSelect; defaults to current user.
- [x] **Installer grid** — 2-column toggle grid on new job form; shows role, years experience, skills; green ring + tick when selected.
- [x] **Admin: installer fields** — when editing an installer in Admin → Users, new fields: Years of experience (number) and Skills (chip input with Enter/comma add + × remove).
- [x] **Migrations 0025 + 0026** — `attachment_buckets` table + `bucket_id`/`url_text` columns on `files`; `clients` + `client_contacts` tables.
- [x] **AttachmentBuckets replaces AttachmentSection** — edit job page now uses the full bucket UI instead of the old flat file list.
- [x] **feat-job-form-redesign branch** — was set as the permanent branch for job form edits, but CLAUDE.md was subsequently updated (feat-notifications-2) to remove this exception; all branches now go to `dev` as normal.

## Done ✓ (2026-05-20, feat-digest)

- [x] **Dedicated digest Telegram bot** — separate `TELEGRAM_DIGEST_BOT_TOKEN` + `TELEGRAM_DIGEST_WEBHOOK_SECRET`; all digest sends and votes use the digest bot, completely isolated from the main ops bot.
- [x] **D-Promote secret command** — typing `D-Promote` in any assistant conversation forces `importance = 5` and immediately sends the conversation to all `digest_subscriber` users via the digest bot; word stripped from Telegram summary so recipients don't see it.
- [x] **Voting — strict majority both ways** — both Promote and Dismiss require >50% of digest subscribers; 1 vote out of 2 people now correctly shows pending, not immediate result.
- [x] **Live poll count on messages** — every vote edit now always shows `📊 X Yes · Y No · Z Pending`; outcome line appended below when resolved (`Information Promoted to Vault!` / `Information Dismissed!`).
- [x] **Buttons disabled after voting** — voter's copy of the message has Promote/Skip removed immediately after they tap; other subscribers' copies keep their buttons until they vote.
- [x] **5-day timeout cron** — `/api/cron/digest-timeout` runs daily at 00:00 UTC; auto-resolves stalled votes after 5 days (strict majority yes → promoted, else dismissed); fills remaining votes in DB to prevent re-trigger.
- [x] **digest_subscriber flag respected everywhere** — all digest recipient queries (vote count, D-Promote send, Monday digest, timeout) now filter by `digest_subscriber = true`; unchecking the box in Admin instantly removes the user from all counts.
- [x] **CLAUDE.md — importance scoring check** — added step 5 to session start: ask Nic about any updates to the 1–5 importance scoring categories in the tagger.

## Done ✓ (2026-05-20, feat-chat-2)

- [x] **Chat: attachment thumbnails** — image files show inline thumbnail (220×160px) with terracotta footer strip on own messages + download arrow on right; documents show compact card with coloured file-type icon box (PDF/Word/Spreadsheet/ZIP) + filename + type label + download arrow; voice notes show play-button card with deterministic waveform bars (grey before play, sweep terracotta left-to-right as audio plays, pause/resume supported).

## Done Last Session ✓ (2026-05-19, fix-chat)

- [x] **Job chat realtime fixed for all roles** — `createBrowserClient` non-singleton caused constant subscription churn (fixed: `useMemo`); admin not in auth.uid() RLS policy (fixed: migration 0023); `@supabase/ssr` browser client doesn't auto-wire JWT to realtime (fixed: explicit `realtime.setAuth()` before subscribe); RLS policies rewritten as `EXISTS` subqueries for reliability (migration 0024); avatar/name for incoming messages now resolved via name cache + async fetch.

## Done ✓ (2026-05-19, feat-chat)

- [x] **In-app notifications for send-back events** — bell drawer shows send-back reason; mark all read button in header; selective delete with checkboxes in drawer footer; migration 0022 applied.
- [x] **Sales POC shown on approval cards** — "Requested by [name]" with icon on each approval card.
- [x] **Grammar suggest in send-back modal** — Suggest button calls `/api/suggest-grammar` (Haiku); replaces textarea with corrected text.
- [x] **Wipe [Sent Back] messages on approval** — `/api/jobs/[id]/approve` deletes all messages starting with `[Sent back]` from job chat when job is approved/scheduled.
- [x] **Chat: WhatsApp-style layout** — own messages right-aligned in terracotta bubble; others left-aligned with avatar + name above.
- [x] **Chat: avatars with initials** — colour-coded by name hash (same logic as UserMenu); fixed Supabase join key bug (`author`/`uploader` → `users`) that was causing all avatars to show `?`.
- [x] **Chat: camera capture button** — separate camera input with `capture="environment"`; auto-renames to `{username} {date} {time}`.
- [x] **Chat: file auto-rename** — voice notes and camera captures renamed to `{username} {date} {time}`; regular file attachments keep their original filename.
- [x] **Chat: bigger avatars** — increased from `w-7` to `w-9`.

## Done This Session ✓ (2026-05-12, feat-admin)

- [x] **Pre-provision users without prior sign-in** — admin can now provision by email before user signs in; migration 0017 (`email` column + partial unique index on `users`); `provisionUser()` rewritten; auth callback links `auth_id` on first sign-in; UserRow shows "Waiting for sign-in: {email}" for unlinked rows.
- [x] **Monday digest confirmed working** — ran `npm run monday-digest`; skips correctly when no `importance >= 4` conversations exist.

## Done Last Session ✓ (2026-05-11, feat-notifications)

- [x] **Finalised all Telegram notification templates** — removed all `[PLACEHOLDER]` markers; added project title, POC name/phone, time ranges, job URLs, `sentAt` timestamps, `tplJobAssigned` (new); redesigned bug report template (removed screen/ip).
- [x] **Updated all 6 notification caller routes** — approve, send-back, submit, messages, overdue, bugs all pass new params via `getJobNotifData` helper.
- [x] **Obsidian sync — first run confirmed** — `greenqubes-kb` added as git submodule at `vault/`; `--use-system-ca` fix applied to all npm scripts; sync confirmed working.
- [x] **Added `NEXT_PUBLIC_APP_URL` to `.env.local`** — set to `https://greenqubes-ops.vercel.app`. Still needs adding to Vercel dashboard (see pending).
- [x] **Pre-alpha testing done** — bugs and feature requests logged above.
- [x] **UI/UX Pro Max design system generated** — `design-system/greenqubes-ops/MASTER.md` created (Trust & Authority style).

## Done Last Session ✓ (2026-05-11, session 1)

- [x] **Fixed duplicate `asst_chats` saves** — removed `saveConversation` from `sendMessage` in both AssistantShell and FloatingChatPanel; added unmount cleanup to AssistantShell.
- [x] **Deleted `features/chat-thread/`** — empty folder removed; chat stays in `job-detail/ChatSection.tsx`.
- [x] **Deleted `features/completion/`** — empty folder removed; completion logic confirmed in `job-detail/StatusSection.tsx`.
- [x] **Empty `docs/` prefix folders** — already gone (`.gitkeep` files deleted last session).
- [x] **Tightened `settings.local.json`** — `git push` scoped to `origin dev`, ~12 stale one-off entries removed.

---

## Before Pre-Alpha Testing (Session 19) — Must Complete First

- [x] **Run pending DB migrations** — `npx supabase db push` confirmed all migrations (0012–0016) already applied; remote database up to date.
- [x] **Test Monday digest manually** — ran `npm run monday-digest`; skipped correctly (no `importance >= 4` conversations yet). Script works.
- [x] **Obsidian sync — first run** — `greenqubes-kb` added as git submodule at `vault/`; `OBSIDIAN_VAULT_PATH` set in `.env.local`; `--use-system-ca` added to all script commands (Node TLS fix); sync confirmed working (`✓ Welcome.md (1 chunk)`).
- [x] **Add production OAuth redirect URI** — added `https://greenqubes-ops.vercel.app/auth/callback` to Supabase Auth → URL Configuration → Redirect URLs. Google Cloud Console only needs the Supabase callback URI (already present).

---

## Before Go-Live (Session 23) — Set Up With Team

- [ ] **Provision team accounts** — Admin → Users tab → Provision new user. Each person must sign in via Google at least once first before you can provision them.
- [ ] **Collect Telegram chat IDs** — each team member messages your bot once; copy their chat ID into their user row from Admin → Users tab → Edit.
- [ ] **Set digest subscribers** — Admin → Digest tab → Subscriber panel → check the box for each person who should receive the Monday digest.
- [x] **[Nic] Schedule Obsidian nightly sync** — once manual sync is confirmed working, set up Windows Task Scheduler on the server PC:
  - Program: `node`
  - Arguments: `--env-file=.env.local node_modules/.bin/tsx scripts/obsidian-sync.ts`
  - Start in: `C:\Greenqubes_GitHub\greenqubes-ops`
  - Trigger: daily at 2 AM

---

## Security — Do Before Bringing in Any Team Members

- [ ] **Turn on 2FA** on every service account — GitHub, Vercel, Supabase, Anthropic, Cloudflare. Takes 10 minutes. Do this before any team member gets access.

---

## Ongoing — After Go-Live

- [ ] **Review first few Monday digests manually** — confirm what surfaces is worth promoting to Obsidian before trusting the process.

---

## Server PC — Already Set Up ✓

- [x] rclone installed and `greenqubes-r2` remote configured
- [x] `SUPABASE_DB_URL` set as system environment variable (using Supabase Connection Pooler — IPv4)
- [x] **Nightly backup scheduled in Task Scheduler at 02:00** — task "Greenqubes Nightly Backup" runs `scripts/nightly-backup.bat` → `scripts/backup.sh`. **Created 2026-08-12** — it was never actually scheduled before that date despite this line previously claiming otherwise; nothing had been backed up since 7 May 2026.
- [x] **R2 → `E:\Greenqubes-Archive\r2` sync working** — verified 2026-08-12, first successful run: 41 files, 15.3 MiB. Before this, the R2 archive folder was completely empty.
- [x] **DB dump → `E:\Greenqubes-Archive\db\` working** — verified 2026-08-12: 205 KB gzipped, 22 tables with data, clean `dump complete` marker. Connects via the IPv4 session pooler, port 5432 (the direct host is IPv6-only and unreachable from this PC; port 6543 is transaction mode and cannot dump).
- [x] Git Bash path confirmed: `C:\Git\bin\bash.exe`

---

## Done ✓

- [x] Supabase project created + env keys in `.env.local`
- [x] Cloudflare R2 bucket created + keys in `.env.local`
- [x] Cloudflare Images API token added
- [x] Anthropic API key added
- [x] Voyage AI API key added
- [x] Telegram bot created + token added
- [x] Google OAuth client created + Supabase callback wired
- [x] All DB migrations applied (0001–0011; 0012–0014 pending — see above)
- [x] Seed data applied (Sarah/Kai/Ravi/Ali + 4 demo jobs)
- [x] Vercel deployed — https://greenqubes-ops.vercel.app
- [x] All env vars set in Vercel dashboard
- [x] Telegram webhook pointed at Vercel URL
- [x] Supabase auth callback URL added for Vercel preview + production
- [x] Your Telegram Chat ID added to your user record
- [x] `messages` + `files` + `jobs` tables added to `supabase_realtime` publication
- [x] `REPLICA IDENTITY FULL` set on `messages`, `files`, `jobs`
- [x] GreenqubesAI scheduler account provisioned + tested
- [x] Supabase project linked via CLI (`npx supabase link`)
- [x] Job chat realtime fixed (Session 17.1 — simplified RLS policies)
- [x] DB password rotated (Session 17.11 — old password invalidated)

---

## Admin Security Note

Admin access is granted by the `role = 'admin'` field on the user's `public.users` row (changed from an email gate to a DB role in migration 0019, feat-admin 2026-05-14). The page (`/admin`) and every `/api/admin/*` route check `role === 'admin'` server-side. Only `ai@greenqubes.com` currently holds that role.

> **Correction (security audit 2026-08-13):** the earlier wording here claimed admin was email-gated and "cannot be bypassed by editing `public.users`." That has been false since migration 0019 — admin is now purely a role. Until migration **0044** (2026-08-13), any logged-in user could change their own `role` to `admin`/`scheduler` directly via the browser because the users update RLS rule had no column restriction. Migration 0044 adds a trigger that blocks non-admins from changing `role` (and other privileged columns) on their own row. See `docs/security-audit-20260813.md` finding #1.
