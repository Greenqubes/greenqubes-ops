# Greenqubes — Build Plan

> Updated after each session. Read this alongside CONTEXT.md at the start of every session.

_Last updated: 2026-05-02 (Session 7)_

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

## Sessions 9–12 — Remaining features (in order)

| Session | Feature |
|---|---|
| 9 | `installer` — dashboard, history, job view |
| 10 | `chat-thread` — live messages + voice notes |
| 11 | `assistant` — AI chatbot + retrieval + auto-tagger |
| 12 | `obsidian-sync` + `monday-digest` cron scripts |

---

## Final stretch

- `scripts/backup.sh` — rclone cold-archive (server PC setup)
- R2 signed-URL upload helpers (`src/lib/storage/`)
- Cloudflare Images binding for photo resize
- Deploy preview to Vercel → internal testing → production cutover

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
| Vercel | account created, repo connection pending |
| Server PC (backup) | not started — setup guide steps H1 + S1–S9 |
