# Greenqubes — Build Plan

> Updated after each session. Read this alongside CONTEXT.md at the start of every session.

_Last updated: 2026-05-07 (Session 17.6 complete — 17.6 items + pending/completed tab fix, pre-schedule locks, financials removed)_

---

## Session 1 — complete ✓

- Moved prototype + docs files into `docs/`
- Scaffolded Next.js 15 + TypeScript strict + Tailwind 3
- Wired design tokens as CSS variables (`--bg`, `--terracotta`, etc.) + Tailwind utilities
- Fraunces (variable, optical sizing) + IBM Plex Sans fonts via `next/font`
- Supabase client (`client.ts`), server (`server.ts`), full DB type stubs (`types.ts`)
- Auth session middleware (`middleware.ts`)
- i18n structure (`en.ts` full keys, `zh.ts` + `bn.ts` stubs with fallback to en)
- All feature folders created and ready (`schedule`, `job-detail`, `installer`, etc.)
- `.env.local` filled with all keys — only two TODOs remain:
  - `CF_IMAGES_DELIVERY_URL` — get from Cloudflare Images dashboard (not needed until image upload feature)
- TypeScript clean, dev server running at `localhost:3000`

---

## Session 2 — DB schema + RLS ✓

- 9 tables live in Supabase (`users`, `jobs`, `job_financials`, `job_assignees`, `files`, `messages`, `asst_chats`, `kb_chunks`, `events`)
- `job_financials` is a separate table (not in original spec) — required to block installer access to commercial data at DB layer, since Postgres RLS is row-level not column-level
- RLS enabled on all tables; helper functions `get_my_id()` + `get_my_role()` use `SECURITY DEFINER` to avoid recursion
- pgvector indexes on `kb_chunks.embedding` + `asst_chats.embedding` (IVFFlat, cosine, lists=100)
- Seed data applied: Sarah/sales, Kai/scheduler, Ravi+Ali/installers, 4 demo jobs across all statuses
- Supabase CLI wired up (`npx supabase db push`) — no manual SQL pasting needed going forward
- `types.ts` updated to match actual schema; regenerate with `npx supabase gen types typescript` once needed
- Note: vector columns use `extensions.vector(1024)` (schema-qualified) — Supabase installs pgvector in the `extensions` schema

---

## Session 3 — Auth ✓

- Google OAuth (not magic links) — team uses mix of @greenqubes.com and @gmail.com accounts
- `src/app/(auth)/login/page.tsx` — Google sign-in button
- `src/app/auth/callback/route.ts` — exchanges OAuth code for session
- `middleware.ts` — redirects unauthenticated users to `/login`, authenticated users away from `/login`
- `src/app/page.tsx` — server component, shows name + role pill + sign out after login
- `src/components/SignOutButton.tsx` — client component
- New users see "Contact your administrator" until provisioned in `public.users`
- Provisioning: insert into `public.users` with `auth_id` matched from `auth.users` by email
- Google Cloud Console: OAuth 2.0 client created, redirect URI pointed at Supabase callback
- GreenqubesAI / scheduler account provisioned and tested ✓

---

## Session 4 — Shared components ✓

- `src/lib/utils/cn.ts` — class-name joiner utility
- `Card` — paper bg, 14px radius, 1px `--line` border
- `Pill` — status + role pills; covers all JobStatus and Role variants + 'overdue'
- `Btn` — primary (terracotta), secondary (line border), ghost; 3 sizes; lowercase weight-500
- `Field` — label + children + hint/error text wrapper (server component)
- `Input` — controlled input with forwardRef, error state, terracotta focus ring
- `Select` — controlled select with forwardRef, same error + focus treatment as Input
- `Toast` — top-center, auto-dismiss (4s), success/warning/error; `ToastProvider` wraps layout, `useToast()` hook for all features
- `Modal` — overlay + card, shadow-xl, Escape-to-close, body scroll lock; no shadow on card border itself
- `ToastProvider` added to `src/app/layout.tsx`

---

## Session 6 — Job detail ✓

- `src/lib/storage/r2.ts` — `getUploadUrl` + `getDownloadUrl` (AWS SDK, presigned URLs)
- `src/app/api/r2/upload-url/route.ts` + `src/app/api/r2/download-url/route.ts` — auth-gated presigned URL endpoints
- `src/app/api/jobs/[id]/messages/route.ts` — POST message with 7-day window enforcement + Session 8 notification stub
- `src/app/jobs/[id]/page.tsx` — server page
- `src/features/job-detail/JobDetailShell.tsx` — react-hook-form client shell
- `src/features/job-detail/CoreSection.tsx` — all core job fields
- `src/features/job-detail/AssigneeSection.tsx` — installer assignment (scheduler only)
- `src/features/job-detail/FinancialSection.tsx` — financials (hidden from installer)
- `src/features/job-detail/AttachmentSection.tsx` — DO/photo/completion file gallery with presigned download
- `src/features/job-detail/StatusSection.tsx` — role-appropriate status transitions
- `src/features/job-detail/ChatSection.tsx` — realtime chat, file upload/download, 7-day post-completion lock
- Queries extended: `getJobById`, `updateJobFields`, `updateJobFinancials`, `updateJobStatus`, `getInstallerUsers`, `addJobAssignee`, `removeJobAssignee`, `getJobMessages`, `insertMessage`, `insertFile`
- i18n: ~30 new keys across en/zh/bn
- Dependencies added: `react-hook-form`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`

---

## Session 5 — Schedule feature (read-only) ✓

- `src/lib/supabase/queries/jobs.ts` — `getScheduleJobs()` + `ScheduleJob` type; query owns its own client (server-only)
- `src/features/schedule/utils.ts` — `fmtTime`, `isOverdue`, `getWeekDays`, `getMonthCells`, `shiftDate`, `shiftMonth`, `langToLocale`
- `src/features/schedule/JobRow.tsx` — job card: punctuality bar, client/time, description, location, assignees, status pill, overdue highlight
- `src/features/schedule/ListView.tsx` — scrollable date strip + job list for selected date
- `src/features/schedule/WeekView.tsx` — 7-day view with per-day job lists
- `src/features/schedule/MonthView.tsx` — calendar grid, tap date to drill down to list view
- `src/features/schedule/ScheduleShell.tsx` — client shell: search, filter chips (all/today/week/upcoming), view toggle (list/week/month), prev/next navigation
- `src/app/schedule/page.tsx` — server page, fetches jobs + user lang, passes to shell
- RLS enforces role access automatically — no role checks needed in app code

---

## Session 7 — Approvals ✓

- `src/lib/supabase/queries/approvals.ts` — `getApprovalQueue()`, `getApprovalCount()`, `getWorkloadByDateRange()`
- `src/app/approvals/page.tsx` — scheduler-only server page
- `src/features/approvals/ApprovalsShell.tsx` — client shell, optimistic queue management
- `src/features/approvals/ApprovalCard.tsx` — job card with approve / send-back actions
- `src/features/approvals/SendBackModal.tsx` — optional note; note posted to job chat thread via existing messages API
- `src/features/approvals/WorkloadPreviewModal.tsx` — 7-day grid, week navigation, inline date reassignment before submit
- `src/features/job-detail/JobDetailShell.tsx` — intercepts "Submit for approval" to show workload preview; patches date + status atomically if date changed
- `src/app/schedule/page.tsx` — passes `role` + `approvalCount` to shell
- `src/features/schedule/ScheduleShell.tsx` — approvals icon with badge for scheduler role
- i18n: 14 new keys across en/zh/bn

---

## Session 8 — Notifications + Telegram ✓

- `src/lib/supabase/service.ts` — service-role client (bypasses RLS)
- `src/lib/telegram/bot.ts` — `sendTelegram()` utility
- `src/lib/telegram/templates.ts` — all message templates (placeholder copy, easy to customise)
- `src/lib/supabase/queries/notifications.ts` — `getJobRecipients()`, `getOverdueJobs()`, dedup helpers
- `src/app/api/telegram/webhook/route.ts` — incoming Telegram updates handler (routing is TODO stub)
- `src/app/api/notifications/overdue/route.ts` — cron handler, fires every 2h via `vercel.json`
- `src/app/api/jobs/[id]/approve/route.ts` — approve + Telegram to sales POC
- `src/app/api/jobs/[id]/send-back/route.ts` — send-back + optional message + Telegram to sales POC
- `src/features/notifications/NotificationDrawer.tsx` — bell icon + overdue jobs drawer (all roles)
- `ApprovalsShell.tsx` refactored to use new API routes (no more direct Supabase from client)
- Messages route wired: `tplJobMessage` fires to all job participants except author
- `vercel.json` cron: `0 */2 * * *` UTC
- i18n: `notificationsNone`, `overdueCount` across en/zh/bn

---

## Session 9 — Installer dashboard ✓

- `src/lib/supabase/queries/installer.ts` — `InstallerJob` type + `getInstallerJobs()`, includes sales POC join for "Call sales"
- `src/app/installer/page.tsx` — server page, role guard (non-installers → `/schedule`)
- `src/features/installer/InstallerShell.tsx` — 4 tabs (Today / Up next / This week / Past), sign-out, client-side tab bucketing
- `src/features/installer/InstallerJobCard.tsx` — status pill, date, client, time, location, optional `tel:` call-sales row
- `src/app/page.tsx` — role-based redirect: installer → `/installer`, sales/scheduler → `/schedule`
- i18n: 8 installer keys added to zh.ts + bn.ts
- Back-nav from `/jobs/[id]` to `/installer` deferred to Session 10

---

## Session 10 — Chat-thread + carried Session 8 TODO ✓

- `src/lib/supabase/queries/notifications.ts` — added `getSchedulers()`: fetches all users with `role = 'scheduler'`
- `src/app/api/jobs/[id]/submit/route.ts` (new) — sales-only POST; sets status to `awaiting_approval` (+ optional date); fires `tplJobSubmittedForApproval` to all schedulers via Telegram
- `src/features/job-detail/JobDetailShell.tsx` — `handleWorkloadConfirm` now calls `/api/jobs/[id]/submit` instead of direct Supabase; accepts `backHref` prop (default `/schedule`)
- `src/lib/supabase/queries/jobs.ts` — added `insertVoiceMessage()`
- `src/lib/telegram/templates.ts` — added `tplJobVoiceNote()`
- `src/app/api/jobs/[id]/messages/route.ts` — extended to handle `kind: 'voice'` with `voice_url`; refactored Telegram logic into `notifyParticipants()` helper
- `src/features/job-detail/ChatSection.tsx` — `VoicePlayer` component (lazy signed-URL fetch, native `<audio>`), `MediaRecorder` recording flow (idle → recording → uploading), mic + stop-circle buttons in input bar; `toItems` extended for voice messages
- `src/features/installer/InstallerJobCard.tsx` — job links now include `?from=installer`
- `src/app/jobs/[id]/page.tsx` — reads `searchParams.from`; passes `backHref` to `JobDetailShell`
- `src/features/schedule/ScheduleShell.tsx` — realtime approvals badge via Supabase Realtime subscription on `jobs` table UPDATEs; re-fetches count from DB on each event
- i18n: added `playVoiceNote` to en/zh/bn

---

## Session 11 — AI assistant ✓

- `supabase/migrations/0004_assistant_search.sql` — `match_kb_chunks` + `match_asst_chats` pgvector RPC functions (SECURITY INVOKER, RLS-filtered)
- `src/lib/ai/embed.ts` — Voyage AI embedding (voyage-3, 1024 dims)
- `src/lib/ai/retrieve.ts` — RAG retrieval: embed question → pgvector query on kb_chunks + asst_chats
- `src/lib/ai/tagger.ts` — conversation auto-classifier (Claude Haiku → topic/entities/tags/importance/visibility)
- `src/lib/supabase/queries/assistant.ts` — `getRecentChats()` + `saveChat()` (service client)
- `src/app/api/assistant/chat/route.ts` — streaming SSE chat (Claude Sonnet + web_search_20250305 tool + RAG context)
- `src/app/api/assistant/save/route.ts` — tag + embed + save conversation to asst_chats
- `src/app/assistant/page.tsx` — server page with role-based backHref
- `src/features/assistant/AssistantShell.tsx` — streaming chat UI, message bubbles, source chips, New Chat button
- `src/lib/supabase/types.ts` — added `Relationships: []` to all tables (fixes GenericTable contract for service client), flat Insert/Update for asst_chats, match_* in Functions
- Bot icon nav link added to ScheduleShell + InstallerShell headers
- i18n: `assistantEmpty`, `assistantSources`, `assistantError`, `newChat` added to en/zh/bn

**Note:** `npx supabase db push` must be run to apply the pgvector RPC migration before retrieval works.

---

## Session 12 — Obsidian sync + Monday digest ✓

- `scripts/obsidian-sync.ts` — walks vault, chunks .md files (~2000 chars ≈ 500 tokens), embeds via Voyage AI, upserts to `kb_chunks` (idempotent on `source_path,chunk_index`), deletes stale chunks
- `scripts/monday-digest.ts` — majority voting system; sends ✅/❌ inline keyboard buttons per item; includes new items + unvoted old items (re-prompt logic)
- `src/app/api/digest/promote/[id]/route.ts` — HMAC-verified GET route, re-summarises conversation, returns HTML page with formatted Obsidian note for copy-paste
- `src/lib/telegram/bot.ts` — extended with `sendTelegramWithKeyboard`, `editTelegramMessage`, `answerCallbackQuery`
- `src/lib/telegram/templates.ts` — added `tplDigestHeader`, `tplDigestItem`, `tplVoteStatus`
- `src/app/api/telegram/webhook/route.ts` — implemented `digest_vote` callback handler: records votes, checks majority, edits message, sends promote link on YES majority
- `supabase/migrations/0005_digest_votes.sql` — `digest_votes` table with RLS
- `src/lib/supabase/types.ts` — added `digest_votes` types
- `tsx` added as devDependency; `npm run obsidian-sync` + `npm run monday-digest` scripts added
- `.env.local.example` — added `OBSIDIAN_VAULT_PATH` + `NEXT_PUBLIC_APP_URL`

---

## Sessions 13–14 — Remaining features (in order)

### Session 13 — Design cleanup (extended, broken into sub-sessions)

Full audit completed against `docs/greenqubes-phase0.jsx`. See `docs/session13(extended)-note.md` for all findings.

| Sub-session | Scope | Files | Status |
|---|---|---|---|
| **13.1** | `Btn`: add `accent` variant (terracotta), fix `primary` → ink-bg; update all call sites | `src/components/Btn.tsx` + feature files | ✓ done |
| **13.2** | Colour token class-name fixes + `Pill` reuse; `InstallerJobCard` radius + display font | `InstallerShell.tsx`, `ApprovalCard.tsx`, `InstallerJobCard.tsx` | ✓ done |
| **13.3** | Page header polish: Approvals h1, AssistantShell avatar, JobDetailShell sticky font | `ApprovalsShell.tsx`, `AssistantShell.tsx`, `JobDetailShell.tsx` | ✓ done |
| **13.4** | Installer "Now" card: active-job detection + big-card visual treatment | `InstallerShell.tsx`, `NowCard.tsx` (new) | ✓ done |
| **13.5** | `WeekView` + `MonthView` audit and fixes | `WeekView.tsx`, `MonthView.tsx` | ✓ done |
| **13.6** | Eyebrow greeting (`Hi, firstName`); `BottomNav` web/mobile full-width fix; `UserMenu` avatar + sign-out dropdown | `InstallerShell.tsx`, `BottomNav.tsx`, `UserMenu.tsx` (new), all shells | ✓ done |
| **13.7** | Bottom tab bar: role-aware fixed nav matching prototype layout | `BottomNav.tsx` (new), all shell files | ✓ done |
| **13.8** | Schedule "+ New job" button + `/jobs/new` creation route | `ScheduleShell.tsx`, `NewJobShell.tsx` (new), `app/jobs/new/page.tsx` (new) | ✓ done |

### Session 14 — `admin` page ✓

| Tab | What it does |
|---|---|
| Users | Provision new user (email → Google auth match → public.users insert), inline role/TG/digest edit |
| Digest | Subscriber toggles; digest queue with per-item "send to…" subscriber picker + Send now |
| Health | Supabase/Telegram/sync/cron checks; API usage tracker (30-day per-service); unusual activity (off-hours); key rotation links |

API usage logging wired into `POST /api/assistant/chat` (tokens + cost). `logApiUsage()` helper in `src/lib/supabase/queries/admin.ts` — extend to Voyage/R2 routes next session.

---

## Session 15 — Crash log feature ✓

| What | Where |
|---|---|
| `crash_logs` DB table + RLS | `supabase/migrations/0007_crash_logs.sql` |
| Public POST crash ingestion + local `.md` write (dev) | `src/app/api/crash/route.ts` |
| React `ErrorBoundary` wrapping entire app | `src/components/ErrorBoundary.tsx`, `src/app/layout.tsx` |
| Shared error fallback UI | `src/components/ErrorPage.tsx` |
| Route-level `error.tsx` for `/schedule`, `/jobs/[id]`, `/installer` | `src/app/*/error.tsx` |
| Admin GET + PATCH (resolve) API | `src/app/api/admin/crashes/route.ts`, `.../[id]/route.ts` |
| Crashes tab (4th tab in AdminShell) | `src/features/admin/CrashLogTab.tsx` |
| Seed script for test data | `scripts/seed-crash.ts` |

Activate: `npx supabase db push` then `npx tsx scripts/seed-crash.ts` to seed test entries.

---

## Session 16 — R2 upload helpers + backup ✓

**R2 signed-URL upload helpers**
- `src/lib/storage/r2.ts` already has `getUploadUrl` / `getDownloadUrl` from Session 6. This session wires proper per-kind signed upload helpers for photos, voice notes, DOs, and completion photos — with correct content-type headers and expiry windows.
- Cloudflare Images binding: `CF_IMAGES_DELIVERY_URL` (pending from Session 1) gets filled; image upload route auto-pushes to Cloudflare Images for resize before storing the R2 key.

**Cold-archive backup**
- `scripts/backup.sh` — rclone sync from Cloudflare R2 to local external drive; also backs up the Supabase DB dump.
- Cron: daily at 3 AM SGT via server PC task scheduler or crontab.

---

## Session 17 — Vercel deploy preview ✓

Connect the GitHub repo to Vercel, set all env vars (Supabase, R2, Anthropic, Voyage, Telegram, Cloudflare Images), confirm the build passes, and get a stable preview URL for testing. Telegram webhook re-pointed to the Vercel URL.

**Known bug (fix in Session 17.1):** Job chat realtime events not delivered — WebSocket connects but Supabase drops events, suspected RLS custom-function incompatibility with the realtime engine. Full diagnosis in `docs/session17(live-chat)-note.md`. Fix options: optimistic updates (quick) + simplified RLS policy (proper). Also add favicon.ico.

---

## Session 17.1 — Live-chat bug ✓

Replaced broken SECURITY DEFINER-based SELECT policies on `messages` + `files` with direct `auth.uid()` subqueries — Supabase Realtime can now evaluate them correctly and delivers events. Added `src/app/icon.tsx` favicon (terracotta "G", 32×32). Notes: `docs/session17.1-note.md`.

> **Naming rule:** Any bug-fix session before the full design review is Session 17.X (X increments per bug). Session 18 is reserved for the full design review only.

---

## Session 17.2 — Calendar navigation + live schedule ✓

Fixed `toISO()` UTC→local rewrite for arrow navigation, `router.refresh()` realtime subscription for live schedule, migration 0010 (jobs in realtime publication + RLS). Root cause of delayed confirmation: Vercel auto-deploy was not connected to GitHub — force-deployed via CLI, GitHub integration then wired via dashboard. Notes: `docs/session17.2-note.md`.

---

## Session 17.3 — Schedule polling + hydration crash attempt (force reverted) ✓

Added migration 0011 (`REPLICA IDENTITY FULL` on jobs) and 2-min polling fallback (`setInterval(() => router.refresh())`). Multiple attempts to fix React hydration error #418 on schedule page — did not resolve in production even after disabling SSR. Force reverted to `a3b365a`. Polling and migration kept; hydration fixes discarded. Error remains in console but is not blocking. Notes: `docs/session17.3-note.md`.

---

## Session 18 — Full design review ✓

Visual pass of the running preview against `docs/greenqubes-phase0.jsx`. 19 findings audited; 17 fixed in-session (F17 kept as harmless, F19 deferred to 17.4). New CSS tokens `--bad` / `--bad-soft` added. New i18n keys: `approvalsSubtitle`, `installerHi`. TypeScript clean. Also fixed Supabase OAuth redirect URLs (added Vercel wildcard + localhost to allowed list; Site URL updated to production). Notes: `docs/session18-note.md`.

---

## Session 18.1 — Additional design edits ✓

Follow-up visual pass based on owner's own design input after reviewing the Session 18 preview. Company bar branding, notification bell redesign, overdue styling (pill, date strip, drawer), language switcher in UserMenu, Completed/Pending pages + bottom nav tabs, JobRow time label. Notes: `docs/session18.1-note.md`.

---

## Session 18.2 — Additional design edits ✓

Visual pass continuing owner review. Job time label 12px → 15px. Pill: removed `lowercase` CSS override, capitalized Pending / Completed / Overdue labels. Schedule tab now hides completed jobs (visible in Completed tab only). Strict on-time legend box colour fixed to `#D14545`. Admin role-switcher feature deferred to Session 17.4. Notes: `docs/session18.2-note.md`.

---

## Session 18.3 — Additional design edits + 17.6 partial pull-forward ✓

Label renames (Client → Customer, Job Description, Location / Address, Client Name, Client Contact No.), button casing (Create Job, Submit for Approval, Push for Approval). Scheduler "Push for Approval" now routes to awaiting_approval (no bypass). Schedule tab hides pending + awaiting_approval. Financials hidden on pending/awaiting_approval jobs. Job Chat Live/Syncing realtime dot indicator; locked title "Job Chat (Locked)" after 7-day window. Whole job locked on completion (including assignees). New PendingFilesSection: multi-file upload + URL links (saved as url_link files, shown in Files/URL section). Files renamed Files/URL. Project Title field above Date on all job forms; schedule shows project_title with client fallback. Migration 0012 (project_title column). **⚠️ Run `npx supabase db push` to apply.** Notes: `docs/session18.3-note.md`.

---

## Session 17.4 — Admin role-switcher view ✓

For `ai@greenqubes.com` (admin account) only: "Preview as" section in UserMenu with Sales / Scheduler / Installer buttons. Cookie-based override (`role_override`), server-side only, no DB writes. Amber chip on avatar when active. Notes: `docs/session17.4-note.md`.

---

## Session 17.5 — Persistent floating AI chatbot ✓

Floating chat bubble (bottom-right, above bottom nav) on all pages except `/assistant`. Full RAG + web search via existing `/api/assistant/chat` SSE endpoint. Chat resets on close; auto-saved to `asst_chats`. Notes: `docs/session17.5-note.md`.

---

## Session 17.6 — New job form + schedule filter improvements ✓

All items complete. Notes: `docs/session17.6-note.md`.

1. ~~**Project title field**~~ ✓ done in Session 18.3
2. ~~**Create Job button + pending filter**~~ ✓ done in Session 18.3
3. ~~**Pending tab — sales only**~~ ✓ done this session
4. ~~**Time picker — 15-min intervals**~~ ✓ `step={900}` on time_start and time_end
5. ~~**Production ready instructions attachment**~~ ✓ `ProductionReadySection` with text + photo/video upload (kind = `production_instructions`)

Also done this session (post-commit fixes):
- Floating chat → `/assistant` conversation handoff via `sessionStorage`
- Pending + Completed tabs showing no jobs — fixed via `pageMode` prop on `ScheduleShell`
- Chat + Production Ready Instructions locked pre-schedule (`preScheduleLocked` prop on `ChatSection`)
- New job form mirrors pending job layout with both sections visible but locked
- `FinancialSection` removed from all pages and all DB save logic stripped

---

## Session 17.7 — TBD _(planned)_

---

## Session 19 — Pre-Alpha Testing (Myself) _(planned)_

Solo end-to-end run through every flow (sales → scheduler → installer → completion) on the Vercel preview. Test on mobile. Versioning starts at **V.0.0.0.1** — each fix increments the last digit.

---

## Session 20 — Pre-Alpha Feedback _(planned)_

Review findings from Session 19, apply hotfixes, and iterate until I give the green light to bring in the scheduler. Version continues at **V.0.0.0.X** (X increments per change). No Session 21 until I'm satisfied.

---

## Session 21 — Alpha Testing (Scheduler) _(planned)_

Real-team test with Me + Scheduler on the Vercel preview using live-ish data. Versioning moves to **V.0.0.X.0** (X increments per change). Hotfix loop until green light to proceed to Beta.

---

## Session 22 — Beta Testing (Management) _(planned)_

Expanded test with Me + Scheduler + Sales. Full approval workflow, financials, Telegram notifications tested with all three roles simultaneously. Versioning at **V.0.X.0.0** (X increments per change). Hotfix loop until green light to launch.

---

## Session 23 — Launch _(planned)_

Production cutover: Supabase project promoted to prod tier (or new org), Vercel deployment promoted, Telegram webhook pointed at prod URL, custom domain (if any) wired. Version becomes **V.1.0.0.0**. Hotfix window open.

---

## Session 24 — Post-Launch _(planned)_

New features to be defined after launch feedback. Versioning continues at **V.1.X.0.0** for minor additions.

---

## Environment status

| Key | Status |
|---|---|
| Supabase URL + anon key + service role | ✓ in `.env.local` |
| Cloudflare R2 | ✓ in `.env.local` |
| Cloudflare Images | ✓ API token in `.env.local` — delivery URL pending |
| Anthropic | ✓ in `.env.local` |
| Voyage AI | ✓ in `.env.local` |
| Telegram bot | ✓ in `.env.local` |
| Vercel | ✓ connected to GitHub, auto-deploy live — preview at https://greenqubes-ops.vercel.app |
| Server PC (backup) | not started — setup guide steps H1 + S1–S9 |
