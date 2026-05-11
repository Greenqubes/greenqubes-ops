# Greenqubes — Build Plan

> Updated after each session. Read this alongside CONTEXT.md at the start of every session.

_Last updated: 2026-05-11 (feat-assistant-2 — assistant history sidebar implemented; delete button bug noted)_

---

## Table of Contents

- [Current State](#current-state)
- [Completed Sessions](#completed-sessions)
- [Session 19 — Pre-Alpha Testing (planned)](#session-19)
- [Session 20 — Pre-Alpha Feedback (planned)](#session-20)
- [Session 21 — Alpha Testing (planned)](#session-21)
- [Session 22 — Beta Testing (planned)](#session-22)
- [Session 23 — Launch (planned)](#session-23)
- [Session 24 — Post-Launch (planned)](#session-24)
- [Environment Status](#environment-status)

---

## Current State

App is feature-complete for pre-alpha. All core flows built and deployed to Vercel preview (`https://greenqubes-ops.vercel.app`). Full design pass done (Sessions 18–18.3). Next milestone: Session 19 pre-alpha testing by Nic.

**Known bug (do not touch):** React hydration error #418 on `/schedule` in production — non-blocking, page works after refresh. Multiple fix attempts failed and were force-reverted. Leave it alone without a new specific hypothesis.

**Pending DB migrations:** Run `npx supabase db push` to apply migrations 0012 (project_title), 0013 (date_end), 0014 (bug_reports).

---

## Completed Sessions

| Session | Name | Key additions | Note |
|---|---|---|---|
| 1 | Scaffold | Next.js 15 + TS + Tailwind, design tokens, fonts, Supabase client, i18n stubs, feature folders | archived |
| 2 | DB Schema + RLS | 9 tables, enums, triggers, pgvector, RLS policies, seed data | archived |
| 3 | Auth | Google OAuth, login page, callback route, middleware, home page | archived |
| 4 | Shared Components | Card, Pill, Btn, Field, Input, Select, Toast, Modal, cn() | archived |
| 5 | Schedule (read-only) | List/week/month views, search, filter chips | archived |
| 6 | Job Detail | Full edit form, assignees, financials, file gallery, status transitions, live chat | archived |
| 7 | Approvals | Workload preview, scheduler approvals queue, approve/send-back, badge | archived |
| 8 | Notifications + Telegram | Bot utility, templates, approve/send-back API routes, overdue cron, bell drawer | archived |
| 9 | Installer Dashboard | Today/Up next/This week tabs, InstallerJobCard, role redirect | archived |
| 10 | Chat Thread + Voice Notes | Voice record/playback, back-nav, realtime approvals badge, submit API route | archived |
| 11 | AI Assistant | Streaming chat (Claude + web search + RAG), auto-tagger, pgvector retrieval | archived |
| 12 | Obsidian Sync + Monday Digest | Nightly vault sync, digest with Telegram majority voting, promote-to-Obsidian link | archived |
| 13–13.8 | Design Audit | Btn variants, colour tokens, page headers, installer Now card, WeekView/MonthView, BottomNav, UserMenu, New Job form | archived |
| 14 | Admin Page | Users tab, Digest tab, Health tab, API usage logging | archived |
| 15 | Crash Log | ErrorBoundary, /api/crash, crash_logs table, Admin Crashes tab | archived |
| 16 | R2 Helpers + Backup | Signed-URL upload helpers, CF Images binding, backup.sh rclone cold-archive | archived |
| 17 | Vercel Deploy | GitHub → Vercel, env vars, preview URL, Telegram webhook re-pointed | archived |
| 17.1 | Live Chat Fix | Simplified RLS on messages + files, favicon | archived |
| 17.2 | Calendar Nav + Live Schedule | UTC→local timezone fix, router.refresh() realtime, migration 0010, Vercel–GitHub wired | archived |
| 17.3 | Polling Fallback | Migration 0011 (REPLICA IDENTITY FULL), 2-min polling; hydration #418 fix attempts force-reverted | archived |
| 17.4 | Role Switcher | ai@greenqubes.com can preview as any role, cookie-based, amber chip | archived |
| 17.5 | Floating AI Chatbot | Persistent chat bubble on all pages, RAG + web search, sessionStorage handoff | archived |
| 17.6 | New Job Form + Schedule Filters | Pending tab (sales only), 15-min time picker, production instructions, chat handoff, pre-schedule locks, financials removed | archived |
| 17.7 | Required Fields + End Date | Custom TimeSelect, date_end + multi-day calendar, migration 0013, reactive header | archived |
| 17.8 | Installer Redesign | Completed tab, My Jobs redesign, list/week/month view toggle | archived |
| 17.9 | Bug Report Feature | Floating button, modal, R2 upload, bug_reports table (migration 0014), Telegram bug bot, Admin Bugs tab | archived |
| 17.10 | Nightly Bug Sync | sync-bugs.ts, nightly bat auto-commit + push | archived |
| 17.11 | Git Cleanup + Security | Hardcoded URI removed, DB password rotated, git history rebased 94→24 commits | archived |
| 18 | Full Design Review | 17 of 19 findings fixed, --bad/--bad-soft tokens added | archived |
| 18.1 | Design Edits | Company bar, notification bell, overdue styling, language switcher, Completed/Pending pages | archived |
| 18.2 | Design Edits | Pill casing, completed jobs hidden from Schedule tab, strict on-time legend colour | archived |
| 18.3 | Design Edits + Features | Label renames, Push for Approval flow, schedule filter, financials gate, Job Chat live indicator, whole-job lock, PendingFilesSection, Project Title (migration 0012) | archived |
| chore-docs | Docs Cleanup + Workflow Reset | Archived session notes, rewrote checklist, squashed plan/context, new session naming convention | [chore/chore-docs-20260509-1-note.md](chore/chore-docs-20260509-1-note.md) |
| chore-assistant | Permissions Audit + Assistant Codebase Review | Fewer-permission-prompts audit, deleted 11 orphaned .gitkeep files, traced chat thread + assistant full flow, identified 5 bugs/cleanup items for next session | [chore/chore-assistant-20260509-1-note.md](chore/chore-assistant-20260509-1-note.md) |
| feat-assistant | Assistant Fixes + History Sidebar Spec | Fixed duplicate asst_chats saves, streaming expand bug, added expand button to floating panel, deleted empty feature folders, tightened settings.json, designed + specced history sidebar | [feat/feat-assistant-20260511-1-note.md](feat/feat-assistant-20260511-1-note.md) |
| feat-assistant-2 | Assistant History Sidebar Implementation | Migrations 0015+0016, 3 new API routes, HistoryList + HistorySidebar components, mobile /assistant/history route, AssistantShell sidebar layout. Delete conversation button not working in preview — investigate next session | [feat/feat-assistant-20260511-2-note.md](feat/feat-assistant-20260511-2-note.md) |

> Archived notes are in `docs/pre-rebase-notes/`.

---

## Session 19

**Pre-Alpha Testing (Myself)** _(planned)_

Solo end-to-end run through every flow (sales → scheduler → installer → completion) on the Vercel preview. Test on mobile. Versioning starts at **V.0.0.0.1** — each fix increments the last digit.

---

## Session 20

**Pre-Alpha Feedback** _(planned)_

Review findings from Session 19, apply hotfixes, and iterate until green light to bring in the scheduler. Version continues at **V.0.0.0.X** (X increments per change). No Session 21 until satisfied.

---

## Session 21

**Alpha Testing (Scheduler)** _(planned)_

Real-team test with Me + Scheduler on the Vercel preview using live-ish data. Versioning moves to **V.0.0.X.0** (X increments per change). Hotfix loop until green light to proceed to Beta.

---

## Session 22

**Beta Testing (Management)** _(planned)_

Expanded test with Me + Scheduler + Sales. Full approval workflow, financials, Telegram notifications tested with all three roles simultaneously. Versioning at **V.0.X.0.0** (X increments per change). Hotfix loop until green light to launch.

---

## Session 23

**Launch** _(planned)_

Production cutover: Supabase project promoted to prod tier (or new org), Vercel deployment promoted, Telegram webhook pointed at prod URL, custom domain (if any) wired. Version becomes **V.1.0.0.0**. Hotfix window open.

---

## Session 24

**Post-Launch** _(planned)_

New features to be defined after launch feedback. Versioning continues at **V.1.X.0.0** for minor additions.

---

## Environment Status

| Key | Status |
|---|---|
| Supabase URL + anon key + service role | ✓ in `.env.local` |
| Cloudflare R2 | ✓ in `.env.local` |
| Cloudflare Images | ✓ API token in `.env.local` — delivery URL pending |
| Anthropic | ✓ in `.env.local` |
| Voyage AI | ✓ in `.env.local` |
| Telegram bot | ✓ in `.env.local` |
| Vercel | ✓ connected to GitHub, auto-deploy live — preview at https://greenqubes-ops.vercel.app |
| Server PC (backup) | ✓ rclone + Task Scheduler configured, nightly running |
