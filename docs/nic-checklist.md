# Nic's Checklist — Things Only You Can Do

> Claude handles the coding. This file tracks every manual action, setup step, or decision that needs a human. Read this at the start of every session.

_Last updated: 2026-08-25 (feat-assistant-2 — assistant upgrade Phase 2 SHIPPED to production same day as Phase 1; migration 0046 applied. Phase 3 is next — no migration needed; Phase 4 needs 0047)_

---

## Pending — Next Session

### Assistant upgrade (from 2026-08-24, chore-assistant — spec approved)

- [x] **[Nic] Phase 1 build session — SHIPPED 2026-08-25** — Sonnet 5 + thinking, Claude-grade sidebar/composer/mobile drawer, smooth streaming, Stop button, web sources; built, smoke-tested by you on the preview (incl. your phone feedback round) and merged to main same day. No migration was needed. Plan: [superpowers/plans/2026-08-24-assistant-upgrade-phase1.md](superpowers/plans/2026-08-24-assistant-upgrade-phase1.md).
- [x] **[Nic] Phase 2 build session — SHIPPED 2026-08-25** — live schedule/job/team lookups (always under the asker's own permissions), the assistant searches the knowledge base itself, real memory with the Memory view. You ran `npx supabase db push` (migration 0046) BEFORE the code deployed; preview smoke test passed and merged to main same day. Plan: [superpowers/plans/2026-08-25-assistant-upgrade-phase2.md](superpowers/plans/2026-08-25-assistant-upgrade-phase2.md).
- [ ] **Phase 3 build session (next)** — say the word: chat attachments (PDF/photos) → quick confirm → pending job with auto-filed buckets, plus a Move-to-bucket control on the job form. **No database migration needed.** **Phase 4 needs migration 0047** — Claude will remind you at that build session.
- [ ] **(Later) Scratch-file cleanup** — chat attachments live in a scratch area in Cloudflare; a periodic cleanup for old scratch files is deferred out of the build (noted in the spec).
- [ ] **Deferred Phase 2 security checks — run on PRODUCTION after all phases ship** (your call, 2026-08-25): (1) **real installer login** asks the assistant about a job they are NOT assigned to → it must find nothing and say so (preview-as doesn't test this — the database permission check needs a real login); (2) **two accounts** — nothing from account A's chats or Memory view may ever surface for account B. Both were points 4 and 5 of the Phase 2 preview smoke checklist.

### Mobile app (from 2026-08-18, chore-mobile — the new roadmap)

- [ ] **Review the mobile app spec** — read [superpowers/specs/2026-08-18-mobile-app-design.md](superpowers/specs/2026-08-18-mobile-app-design.md) and give the go-ahead (or changes). Nothing gets built until you approve it; the implementation plan is written right after.
- [ ] **Ask the directors for the Apple Developer greenlight** — US$99/year, one company account, covers the whole team; installing is free for everyone. Without it the iPhone half of the team stays on the webapp and **Telegram cannot be retired**. If they say yes: request a **D-U-N-S number** for GreenQubes first (free, takes days–weeks — the longest lead-time item in the project), then enroll in the Apple Developer Program **as an organization**, set to auto-renew. A lapsed subscription stops iPhone notifications and new installs (installed apps keep working; nothing is lost permanently).
- [ ] **Create a free Expo account when the build starts** — Expo is the build service that produces the .apk and handles updates. Free tier; needs an email. Claude will tell you exactly when it's needed.
- [ ] **(Optional, anytime) Google Play account — US$25 once** — only if you ever want store auto-updates instead of sending .apk links. Skippable for a 10-person team.

### Team onboarding (was "alpha testing prep" — Sessions 21–23 closed, webapp launched v1.0.0)

_The whole-company rollout pack is ready (built 2026-08-18). Follow the runbook: [rollout/rollout-runbook.md](rollout/rollout-runbook.md) — deck + printable role cheat sheets are linked at the top of it._

- [ ] **Collect everyone's exact Google email** — one group-chat message (template in the runbook). Copy-pasted, not typed: an email typo = "account not set up" on the day.
- [ ] **Fill the roster + pre-provision everyone** — Admin → Users → Provision (email + name + role), tick digest where wanted. No one needs to have signed in first.
- [ ] **Rollout meeting** — present the deck, everyone signs in with Google + taps **Connect Telegram** (self-service now — no more chat-ID pasting); digest subscribers also press START on @Greenqubes_digest_bot once. Fallbacks for every failure mode are in the runbook.
- [ ] **After: verify every user row has a Telegram chat ID** (Admin → Users) and chase gaps while it's fresh.

### Backup — fixed 2026-08-12, two follow-ups

- [x] **[Nic] Nightly backup now working end to end** — R2 files **and** database dump both verified. `SUPABASE_DB_URL` switched from the direct host (`db.<ref>.supabase.co`, now **IPv6-only** and unreachable from this PC) to the **IPv4 session pooler** on port 5432. Set in **machine** scope; the user-scope copy was deleted so there's one source of truth.
- [x] **[Nic] Database password rotated** — done 2026-08-12, machine env var updated to the new pooler URI and verified. Note: a Supabase password reset takes ~15–30 seconds to reach the pooler; an immediate connection attempt after resetting will fail with "password authentication failed" even when the new password is correct. Wait before assuming it's wrong.
- [x] **[Nic] Both scheduled tasks now run whether logged in or not** — done 2026-08-12 via `Set-ScheduledTask` with stored credentials (the Task Scheduler GUI dialog silently reverts if the password prompt is cancelled). `Greenqubes Nightly Backup` and `Greenqubes Obsidian Sync` are both `LogonType: Password`, `RunLevel: Highest`; both test-run clean. **If the `GQAdmin` Windows password ever changes, both tasks stop working with no warning** — the stored credential must be re-entered.
- [ ] **[Nic] Check whether the old DB password is used anywhere else** — anything still holding the pre-2026-08-12 password is now broken: Vercel environment variables, Bryan's `.env.local`, any other script on the server PC. Do before go-live.
- [ ] **Nothing alerts you if the backup stops** — this is exactly how it went unnoticed for three months. The Obsidian sync and overdue cron both write a row to the `events` table, which the Admin → Health tab reads to show "last run". The backup writes nothing. Small piece of work: have `backup.sh` log an event on success, and show it on the Health tab alongside the others.
- [ ] **Decision — Telegram watchdog for silent failures** (offered 2026-08-12, infra-config) — the vault sync died for 57 days and nobody noticed because the Health tab only shows the problem if someone looks. Proposal: a small addition to an existing Vercel cron that Telegrams you when no vault-sync (and, once it logs events, backup) row has appeared for ~2 days. Runs on Vercel so it works even when the server PC is down. Say the word and it gets built in a session.
- [ ] **The R2 backup is a mirror, not history** — `rclone sync` makes the local copy match the bucket exactly, so a file deleted in R2 disappears from the local copy on the next run. It protects against Cloudflare being unavailable, not against someone deleting a file. If you want to recover deleted files, that needs dated snapshots or R2 object versioning — a separate decision.


### Future planning notes (from 2026-08-18, rollout session)

- [ ] **Instant promotion to the assistant's brain** — when a digest vote promotes a note to the vault, also feed it into the assistant's knowledge base immediately (embed + upsert at promotion time). Today the assistant only learns it after the server's 2:30 AM sync. Small build — needs a session. (Nic requested 2026-08-18.)

### Future planning notes (from 2026-07-22, Phase 3 session)

- [x] **[Nic] Schedule tab: list view scrolling UX** — DONE 2026-08-05, live on production. Windowed week↔month strip, jump calendar, Today button, Monday-start weeks, chips removed. Smoke test passed desktop + mobile ([schedule-list-ux-smoke-test.md](schedule-list-ux-smoke-test.md)). See [ux/ux-schedule-20260805-1-note.md](ux/ux-schedule-20260805-1-note.md).
- [x] **[Nic] Port to mobile apps — Android (.apk) + iOS (.ipa) — PLANNING DONE 2026-08-18.** Full design session held: React Native + Expo, one codebase, same backend, 3 build stages, Android-first, iPhone gated on the Apple Developer greenlight. Spec: [superpowers/specs/2026-08-18-mobile-app-design.md](superpowers/specs/2026-08-18-mobile-app-design.md). Build sessions follow once you approve the spec (see "Mobile app" section at the top).
- [ ] **Desktop apps — Windows (.exe) + macOS (.dmg)** — once live, package the system as installable desktop apps if possible. Explicitly deferred in the 2026-08-18 mobile spec — separate decision after the mobile app ships.
- [x] **[Nic] Full security + integrity audit — code/access-control portion DONE 2026-08-13.** Full-app review of access control (RLS), auth, all API routes, exposed secrets, file storage, webhooks/crons and injection surfaces. Found **4 real holes and fixed all of them live on production** — headline: any logged-in user could make themselves admin. Full write-up in [security-audit-20260813.md](security-audit-20260813.md); session note [fix/fix-auth-20260813-1-note.md](fix/fix-auth-20260813-1-note.md).
- [ ] **Security audit — remaining piece: service-outage resilience** — the code/access-control audit is done (above). Still not exercised: what actually happens if each service (Vercel / Supabase / R2 / Telegram) goes down mid-operations, and the recovery drill for each. Worth a dedicated session before go-live. (Backup/recovery itself was covered in the 2026-08-12 infra sessions.)

### Security hardening — lower priority (from the 2026-08-13 audit, fix whenever)

_None of these are blockers; the 4 real findings are already fixed. Details in [security-audit-20260813.md](security-audit-20260813.md)._

- [ ] **Make webhook/cron secret checks fail-closed** — the Telegram webhooks and the cron routes only enforce their secret *if* the secret env var is set (`if (secret) { check }`). If one were ever left unset, that endpoint would be wide open (e.g. someone could forge digest votes → auto-promote a note to the vault, or trigger Telegram blasts). Assuming the secrets are set in Vercel this is inert today — but it should refuse when the secret is missing rather than allow.
- [ ] **Stop notification-insert spoofing** — the in-app notifications table lets any logged-in user insert a notification into anyone's bell drawer (no owner check on insert). Nuisance-level only; reads/deletes are already locked to the owner.
- [ ] **Escape user text in Telegram messages** — notifications are sent with HTML formatting and drop in user text (project titles, chat text) unescaped. Not an app security hole, but a crafted title could inject a fake link/formatting inside a Telegram message.
- [ ] **Telegram notification tracker on the job form** (noted 2026-08-05, ux-jobs) — build the real notification tracker behind the "Notifications — coming soon" placeholder card (bottom of the Team tab in the new job-form layout): show which Telegram notifications were sent for the job (assignments, clash alerts, chat batches), to whom, and when. Needs its own design session.
- [ ] **Sub-jobs under a main job** (noted 2026-08-05, ux-jobs) — a job should be able to belong to a parent job (picked via a "parent job" dropdown), so one big project can hold several sub-jobs. Big piece: touches the data model, schedule/FCFS display, installer views, and possibly duplication. Needs its own design session before any build.

### Workflow V2 (from 2026-06-05, chore-jobs)

- [x] **[Nic] Workflow V2 implementation — Phase 1 (roles + workflow simplification)** — implemented 2026-06-12 on `feat-workflow-v2` (migrations 0033–0036 applied; approval workflow removed; Push to Schedule live; FCFS tab in nav for all roles). See [feat/feat-jobs-20260612-1-note.md](feat/feat-jobs-20260612-1-note.md).
- [x] **[Nic] Finish Phase 1 smoke test — sections 3–5** — PASSED 2026-06-24. Found + fixed 4 things: New Job screen wasn't running the clash check on push; clash modal now clears when you shift the time + button reworded to "Push to Schedule"; chat photo attachments showed "Unknown" sender (fixed); installer My Jobs cards weren't showing the project title (fixed). See [fix/fix-jobs-20260624-1-note.md](fix/fix-jobs-20260624-1-note.md).
- [x] **[DEFERRED to Phase 3] Clash check when editing an already-scheduled job** — moving a scheduled job's time/installer onto another scheduled job currently shows NO clash warning (the check only fires when first pushing a pending job to the schedule). This is the FCFS board's job (Phase 3) — leave it for now.
- [x] **[Nic] Clean-cut switchover (strategy reminder)** — executed 2026-08-03; see the regression test → switchover item below.
- [x] **[Nic] (Optional, for testing) See push notifications yourself** — resolved by 2026-08-18: a data check during the digest debugging confirmed **no other user row carries a Telegram chat ID anymore** (only your own account has one), so there's nothing to remove before go-live. Going forward everyone links their own via the Connect Telegram button.
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

- [x] **[Nic] Delete the test jobs** — DONE 2026-08-13, went further than planned: **all 46 jobs wiped** (every test job plus the stale backlog), together with all attachments, chats, buckets, tasks and assignments, plus all job files in R2. Verified zero remaining.
- [x] **[Nic] Remove the test installer account** — KEPT (your call 2026-08-13): the wipe preserved every user account for logins.
- [ ] **Delete the test external contacts** created during Phase 4 testing — remove them from the External installers bucket on any job form (delete + their links die with them). _Note (2026-08-13): the wipe removed their job links but kept the contact pool, so their lifetime links still open (showing no jobs). Delete them from any job form's External installers bucket if you want the links dead._

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

## Done This Session ✓ (2026-08-25, feat-assistant-2 — Assistant Upgrade Phase 2 SHIPPED)

- [x] **[Nic] Phase 2 live on production** — the assistant now looks up the real schedule, jobs, team availability and clashes when you ask ("who's free Friday?"), searches the knowledge base itself (retrying with different wording), and remembers meaningful conversations properly. Merged to main the same day Phase 1 shipped.
- [x] **[Nic] Ran `npx supabase db push` for migration 0046** — the memory-summary column, applied BEFORE the code went out (no crash window — the feat-files lesson followed).
- [x] **[Nic] Privacy built in as designed** — every lookup runs under the asking person's own permissions (an installer's assistant cannot see jobs they aren't assigned to), money figures are never available to the assistant at all, and memories never cross accounts.
- [x] **[Nic] Memory view live** — the Memory button (sidebar and phone drawer) shows everything the assistant remembers about you; you can correct a memory or make it forget one. Throwaway chats ("hello") stay out of memory automatically.
- [x] **[Nic] Decision — two security checks deferred to production** — the real-installer-login test and the two-account isolation test will be run on production once ALL phases are complete (tracked as a pending item above).
- [x] **[Nic] Preview smoke test passed → merged dev → main** — schedule/workload/clash questions, job lookup, knowledge-base search, Memory view, and the Phase 1 regression pass all green.
- Note: this folder's installed packages were still on the old Anthropic SDK (the Phase 1 session ran in a parallel window; `npm install` had never run here) — fixed during the session, no code impact.

---

## Done This Session ✓ (2026-08-25, feat-assistant — Assistant Upgrade Phase 1 SHIPPED)

- [x] **[Nic] Phase 1 live on production** — the assistant now runs on Sonnet 5, thinks before answering, gives much longer answers, shows "Thinking…"/"Searching the web…" status lines, has a Stop button, and shows web source chips under answers. Repeat messages in a chat are cheaper thanks to prompt caching.
- [x] **[Nic] New look verified by you** — smoother streaming (no more choppy scroll-fighting), two-row composer with mic dictation (browser feature — appears in Chrome/Safari, quietly absent in Firefox), no model picker; desktop sidebar with New chat on top; phone gets the app-like chat screen with the slide-in drawer.
- [x] **[Nic] Your phone feedback folded in same day** — hamburger moved to the LEFT (matches the drawer side), assistant icon + title removed from the top bar, Home icon added on the right (goes to Schedule; installers to My Jobs). Bottom nav staying visible under the drawer accepted as-is (your call).
- [x] **[Nic] API usage question answered** — it lives at Admin → Health → "API Usage Tracker" (30-day totals per service, not per-message rows). The amber "cost estimate drift" warning you spotted was a stale sanity check that can't work now that costs mix models, cache discounts and search fees — removed for the Anthropic card only; the real check (comparing against the Anthropic billing dashboard) stays.
- [x] **[Nic] Phase 3 scratch-file question answered** — chat attachments will live in a per-person scratch area in Cloudflare (`asst-chat/…`), never in job files, whether or not a job gets created; the deferred scratch-cleanup checklist item covers the leftover files. Offer on the table: build a simple 30-day auto-cleanup during the Phase 3 session instead of deferring.
- [x] **[Nic] AI importance tagger** — skipped, no changes (your call at session start).
- [x] **[Nic] Smoke test passed → merged dev → main** — live on production same day.

---

## Done This Session ✓ (2026-08-24, chore-assistant — Assistant Upgrade Design Spec)

- [x] **[Nic] Full assistant upgrade designed and approved** — four phases: smarter brain + Claude-grade look and feel, live-data lookups + memory, attachments → pending job, Projects. Spec committed and pushed to dev; no code written yet.
- [x] **[Nic] Decisions made this session** — model: **Sonnet 5** (same price tier as today, currently cheaper on intro pricing); phased build (Option 1); **privacy rule: assistant memory never crosses users** — the digest vote → vault stays the only bridge; job creation is the **only** action the assistant may take, saved as pending with a **quick confirm in chat** first; **Move to…** on bucket files so wrong filings need no re-upload; Projects at full depth (folders + shared files + instructions + linked memory); composer mic = free browser dictation; **no model picker** in the UI; mobile gets the app-like drawer layout (3-line button top-right); **only meaningful chats** enter memory, with a Memory view to edit/remove; **incognito mode skipped** (your call after discussion).
- [x] **Vault submodule bookmark updated** — the repo now records the vault at its 18 Aug state (the digest promotions); the `M vault` git noise is gone.

---

## Done This Session ✓ (2026-08-24, feat-schedule — Revert Completed Jobs + Bulk Actions + Card Team Lines)

- [x] **[Nic] Decision — who can revert a completed job** — every role except installer (your call, incl. designer/production), and no Telegram message fires on a revert (quiet undo).
- [x] **[Nic] Revert to Scheduled live** — button + confirm popup in the completed job's bottom bar; the job goes back to the schedule, unlocks on the spot, and keeps its original FCFS queue position instead of dropping to the back.
- [x] **[Nic] Bulk buttons on the selection bars** — Completed tab: Revert N; Schedule tab: Complete N (green) — both scheduler-only with the same inline confirm step as Delete.
- [x] **[Nic] Team lines on list cards** — schedule/pending/completed cards now show `Installer:` bottom-left and a left-aligned `Sales:`/`Coordinator:` box bottom-right, with NIL when empty (your mockup); installer screens deliberately unchanged.
- [x] **[Nic] Bell overdue cards show Sales + Coordinator** — under the address, NIL when empty.
- [x] **[Nic] Telegram header matches what happened** — assigning to an empty job says ✅ Installer Assigned; modifying an existing team says ❗ Installer Changed; removing the last installer says ❌ Installer Removed (your screenshots drove this).
- [x] **[Nic] Verified everything on the dev preview, merged dev → main** — all live on production same day.

---

## Done This Session ✓ (2026-08-19, fix-files — Attachment Delete Fix)

- [x] **[Nic] "Deleted attachments come back" root-caused and fixed** — your Cloudflare theory was half right: the app never deleted anything from Cloudflare, but the reason files reappeared was the database silently refusing the delete (no delete permission rule was ever written for the files table, and the app never checked). Deletes now go through the server, which checks who's asking, deletes the Cloudflare copy first, then the database row.
- [x] **[Nic] Decision — who can delete attachments** — matches the screen as it already was: every office role (sales, scheduler, coordinator, designer, production, admin) on non-completed jobs; installers never; completed jobs locked for everyone.
- [x] **[Nic] Bucket delete no longer leaks files into job chat** — deleting a bucket used to quietly unhook its files (which then showed up in the job chat) and strand their Cloudflare copies; it now truly deletes the files with the bucket.
- [x] **[Nic] Real error messages on failed deletes** — a failed delete now shows a red error instead of the file pretending to vanish; successful deletes show a green confirmation.
- [x] **[Nic] Verified on preview, merged dev → main** — fix live on production (confirmed the new delete route is serving).
- [x] **[Nic] Stale-tab leak caught right after the merge and cleaned up** — you deleted the DESIGNER JO bucket from a tab still running the old code (an open tab keeps the old version until refreshed), which leaked its two PDFs into the job chat one last time. Both leaked files were fully removed with a one-off script you approved (Cloudflare copy + database row); verified zero leaked attachments remain on any job. Lesson: after a production deploy, refresh open tabs before testing.
- Note: files deleted from the app also disappear from the server-PC archive at the next 02:00 sync — the archive is a mirror, not history (existing checklist item covers the snapshot decision).

---

## Done This Session ✓ (2026-08-18, feat-rollout — Rollout Pack + Connect Telegram + Digest Fixes)

- [x] **[Nic] Rollout materials approved + built** — 10-slide deck, 6 printable role cheat sheets, and your step-by-step runbook (all in `docs/rollout/` and published as private artifact pages; links at the top of the runbook). Your decisions: deck + cheat sheets format, English only, collect emails before the meeting (Option A).
- [x] **[Nic] Connect Telegram self-link chosen and live on production** — everyone links their own Telegram with two taps (profile picture → Connect Telegram → START); no chat-ID pasting, no database migration, no new Vercel settings. You verified the button on the preview.
- [x] **[Nic] Digest mis-route caught and fixed** — your test exposed that the Admin → Digest tab still sent via the ops bot (leftover from before the digest bot existed). Now routes via @Greenqubes_digest_bot; you verified the send arrives from the right bot.
- [x] **[Nic] Digest voting fixed** — "your account is not registered" was your deleted old account sharing your Telegram ID; deleted accounts are now ignored everywhere in the digest (votes, majority count, broadcasts, D-Promote) and the ghost row's Telegram ID + digest tick were cleared from the data (your call).
- [x] **[Nic] Vanishing vault notes root-caused and fixed** — Vercel kills background work once a response is sent, so the vault write was dying mid-flight. Now awaited; you verified live: vote at 20:24:09 → note on GitHub at 20:24:17 (8 seconds).
- [x] **[Nic] Promoted notes follow your reorganised vault** — they now land in `Table of Content/Digest/` (your call), matching where you moved the May note. Your stranded "Plywood" promotion was rescued there, then all three test notes deleted at your request before the 2:30 AM sync could teach them to the assistant.
- [x] **[Nic] D-Promote smirk reply added** — the assistant answers any message containing `D-Promote` with "I see what you did there 😏" instead of a normal AI reply (your request; no API cost).
- [x] **[Nic] Four dev → main merges, each verified by you on production.**
- Your Obsidian already auto-pulls every 11 minutes + on startup (Git plugin) — promoted notes appear in Obsidian within minutes, no setup needed.

---

## Done This Session ✓ (2026-08-18, chore-mobile — Webapp Launched v1.0.0 + Mobile App Design)

- [x] **[Nic] Webapp declared LAUNCHED at v1.0.0** — your call: all necessary testing already done, so the planned alpha/beta/launch rounds (Sessions 21–23) are closed without being run. The current production site is the launched product; the webapp continues as the desktop/office tool.
- [x] **[Nic] Mobile app fully designed and specced** — Android + iPhone app, one codebase, same data as the webapp, built in 3 stages with per-job chat as the make-or-break feature. Your decisions recorded: Android first (free .apk installs), iPhone waits for the directors' Apple Developer greenlight, Telegram retires only when both halves of the team have the app, chat stays per-job only, email sign-in link added as the second login method (webapp + app).
- [x] **[Nic] Scope decisions** — app v1 covers everything except the admin screens and FCFS board (desktop-only); external installers keep their web links; chat extras (read receipts, replies, reactions) deliberately deferred.
- [x] **Spec committed** — [superpowers/specs/2026-08-18-mobile-app-design.md](superpowers/specs/2026-08-18-mobile-app-design.md); your read-through is the next step before any code.

---

## Done This Session ✓ (2026-08-18, visual-design — Logo Palette Rebrand + Clickable Logo)

- [x] **[Nic] Top-bar logo made clickable** — tapping the GreenQubes logo anywhere in the app now goes to the Schedule page; installers get sent to their My Jobs page instead. Verified on preview, merged to main.
- [x] **[Nic] Decision — rebrand scope: accents only** — backgrounds, text and borders stay; the five accent colors moved to the logo palette (lime `#91C740` + slate `#6C747C` anchors, plus teal/sand from the palette strip).
- [x] **[Nic] Decision — buttons use a darker lime with white text** — the true logo lime stays for small highlights only (chat live dot, browser-tab icon), since white text on bright lime is unreadable.
- [x] **[Nic] Decision — installer/success color is teal, not a second green** — the company green stays the only green in the app.
- [x] **[Nic] Caught on preview: punctuality colors must not rebrand** — strict = red / flexible = blue is a company scheduling signal. Now locked in dedicated `--punct-*` tokens that no future palette change can touch; rule recorded in CONTEXT.md.
- [x] **[Nic] Verified both rounds on preview + merged to main** — rebrand live on production same day.

---

## Done This Session ✓ (2026-08-17, ux-notifications — Overdue Bell Alerts + Pre-Alpha Green Light)

- [x] **[Nic] Session 19 pre-alpha testing PASSED clean** — your solo run found no issues, so the Session 20 hotfix round was skipped entirely. Green light to bring in the scheduler for Session 21 alpha testing.
- [x] **[Nic] Overdue bell alerts made informative** — the cards now show project title, company ("Untitled" when the job has none), the date with its day (`13/08/2026 (Thu)`, your pick), and location — no more bare-date cards.
- [x] **[Nic] Mark as read added to the drawer** — greys every red alert and returns the bell to normal; remembered on the device you pressed it (your pick over a database version). A job rescheduled to a new overdue date turns red again.
- [x] **[Nic] Decision — alerts are team-scoped** — only a job's Person-in-Charge, coordinators and formally assigned installers get its overdue alert (suggested installers never do); scheduler + admin keep the company-wide view (your pick).
- [x] **[Nic] Verified on preview, merged dev → main** — all three notification changes live on production and spot-checked there.
- [x] **[Nic] Decision — Bryan's old settings change skipped permanently** — his 28 May commit (which would have untracked the shared Claude settings file you edit) is recorded as merged without taking effect; the session-start check stays quiet from now on and his future work merges normally.

---

## Done This Session ✓ (2026-08-13, chore-db — Brand Logo + Test-Data Wipe)

- [x] **[Nic] Brand logo live on production** — your GreenQubes logo PNG now replaces the text wordmark in the top bar (every page) and on the login card. Pre-Alpha tag removed (your call); in dark mode the grey half gets a small brightness lift so it stays readable. Preview checked, then merged `dev` → `main`.
- [x] **[Nic] Full test-data wipe executed on production** — your call on scope: all jobs + their attachments, bug reports + screenshots, in-app notifications, crash logs. Deleted: 46 jobs (35 scheduled / 10 pending / 1 completed) with all cascaded data, 1 bug report, 27 crash logs, and 44 R2 files (15.6 MB). A dry-run count was shown and approved before anything was deleted; every count verified zero afterwards.
- [x] **[Nic] Kept: everything login- and reference-related** — all user accounts, the client company list, the external installer contact pool, assistant chats, and the knowledge base.
- [x] **One-off wipe script deleted after use** (your call) — it was dry-run-by-default with an explicit `--execute` flag; not kept in the repo.
- ⚠️ **Archive mirror note** — the deleted R2 files still sit in `E:\Greenqubes-Archive\r2` on the server PC until the next 02:00 sync mirrors the deletion. Copy that folder first if you ever want the old test attachments back; this morning's DB dump keeps the pre-wipe database snapshot either way.

---

## Done This Session ✓ (2026-08-13, fix-auth — Security Audit + Fixes)

- [x] **[Nic] Full security + integrity audit run** — whole webapp checked: access control (RLS), login/session, every API route, exposed secrets, file storage, webhooks/crons, injection surfaces. Write-up: [security-audit-20260813.md](security-audit-20260813.md).
- [x] **[Nic] CRITICAL fixed — any logged-in user could make themselves admin** — the database rule that lets you edit your own profile didn't stop you changing your own **role**, so an installer could flip to admin/scheduler from the browser and see all jobs, all money figures, and everyone's private assistant chats. Migration **0044** adds a guard that blocks non-admins from changing their own role (and other sensitive fields). Applied to the shared DB + merged to main.
- [x] **[Nic] MEDIUM fixed — anyone could delete the client list** — client tables + routes now limited to office roles (sales/scheduler/coordinator/admin). Migration **0045**.
- [x] **[Nic] MEDIUM fixed — file download links weren't access-checked** — the app now confirms you're allowed to see a file's job before handing out a download link; bug screenshots limited to scheduler/admin.
- [x] **[Nic] LOW fixed — could rename/overwrite another user's saved AI chat** — chat edits now locked to the owner.
- [x] **[Nic] Ran `npx supabase db push` for migrations 0044 + 0045** — both applied to the shared DB; production covered.
- [x] **[Nic] Verified on preview + merged to main** — the three legitimate flows (add a client, download a job file, rename an assistant chat) confirmed still working; `dev` → `main` merged, all four fixes live on production.
- [x] **[Nic] Stale doc corrected** — the "admin is email-gated / can't be bypassed" note was false since May (admin became a role in migration 0019); rewritten with the correct picture.
- Lower-priority hardening notes captured above under "Security hardening — lower priority" for a future session (fix whenever).

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

- [x] **[Nic] Clean up the ~27 finished-but-still-`scheduled` jobs** — DONE 2026-08-13: gone in the full test-data wipe (all 46 jobs deleted).

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
