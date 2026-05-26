# Greenqubes — Build Plan

> Updated after each session. Read this alongside CONTEXT.md at the start of every session.

_Last updated: 2026-05-26 (infra-config — Task Scheduler nightly obsidian sync setup)_

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

Admin role fully implemented. `admin` added to `user_role` enum; all RLS policies updated to include admin; hardcoded `ai@greenqubes.com` email gates replaced with `role === 'admin'` checks across all pages and API routes; AdminRoleModal added to UsersTab (confirm + success phases). Vercel cron fixed (overdue was 2-hourly, blocked Hobby plan deployments — changed to daily). Migrations 0018–0020 applied.

**Known bug (do not touch):** React hydration error #418 on `/schedule` in production — non-blocking, page works after refresh. Multiple fix attempts failed and were force-reverted. Leave it alone without a new specific hypothesis.

**Major bug (pending fix):** Save fails on the approvals page when scheduler clicks "Approve & Schedule" or "Schedule". Needs root-cause investigation next session.

**Minor bug (pending fix):** AdminRoleModal in UsersTab — "Yes" button requires two presses to confirm. Needs investigation.

**Minor visual bug (pending fix):** Friday bar missing in WeekWorkloadChart inside ClashResolutionModal. Layout fix was attempted (merged bar+label into single button) but not confirmed resolved on preview.

**DB migrations:** All migrations 0012–0024 applied. No pending migrations. Migrations 0023–0024 fix Supabase Realtime RLS: admin added to auth.uid() policy (0023); policies rewritten to EXISTS pattern for sales/scheduler/admin + separate installer assignment policy (0024).

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
| fix-assistant | Assistant Delete Button Fix + Delete Modal | Fixed mousedown/click race condition in HistoryList outside-click handler; replaced inline confirm with Delete Permanently modal; made deleteChat idempotent | [fix/fix-assistant-20260511-1-note.md](fix/fix-assistant-20260511-1-note.md) |
| feat-notifications | Telegram Templates + Obsidian Sync First Run | Finalised all Telegram notification templates (project title, POC fields, job assigned, bug report redesign); updated all 6 caller routes; wired Obsidian vault as git submodule; UI/UX Pro Max design system generated; pre-alpha testing done — bugs + features logged | [feat/feat-notifications-20260511-1-note.md](feat/feat-notifications-20260511-1-note.md) |
| feat-admin | Pre-Provision Users + Monday Digest Confirmed | Admin can now provision users by email without prior sign-in; migration 0017 (email column + partial unique index); auth callback links auth_id on first sign-in; UserRow shows "Waiting for sign-in" email; Monday digest confirmed working (skips correctly when no important conversations) | [feat/feat-admin-20260512-1-note.md](feat/feat-admin-20260512-1-note.md) |
| fix-prealphabugs | Pre-Alpha Hotfixes | Overdue cron wired in vercel.json; R2 CORS configured; bug report screenshot upload hardened; voice mic stream reused; attachment Telegram notifications; admin back arrow; role labels title-cased; time_end + description optional; form reset after save; NEXT_PUBLIC_APP_URL in Vercel | [fix/fix-bugs-20260513-1-note.md](fix/fix-bugs-20260513-1-note.md) |
| feat-admin-2 | Admin Role + Vercel Cron Fix | `admin` added to user_role enum; RLS policies updated; email gates replaced with role checks; AdminRoleModal in UsersTab; BottomNav admin tab; Vercel overdue cron changed to daily (was blocking Hobby plan deployments); migrations 0018–0020 | [feat/feat-admin-20260514-1-note.md](feat/feat-admin-20260514-1-note.md) |
| feat-jobs | AI Suggest Button | SuggestField component; /api/ai/suggest route (Haiku, SUGGEST_CONFIG); Project Title, Description, Notes, Production Instructions all wired; plain language rule added to CLAUDE.md | [feat/feat-jobs-20260514-1-note.md](feat/feat-jobs-20260514-1-note.md) |
| feat-design | Dark Mode | next-themes; ThemeProvider wrapper; .dark CSS token block (Claude Warm palette); UserMenu Moon/Sun toggle with localStorage + system preference detection; text-white→text-paper contrast fixes across 8 components | [feat/feat-design-20260514-1-note.md](feat/feat-design-20260514-1-note.md) |
| chore-jobs | Git + PR + Bulk Delete Design | Resolved rebase conflict (plan.md, nic-checklist.md, CONTEXT.md); PR opened dev→main; bulk delete feature designed (Design A: always-on checkboxes, bottom delete bar); spec + plan pending next session | [chore/chore-jobs-20260514-1-note.md](chore/chore-jobs-20260514-1-note.md) |
| feat-clash-resolution | Clash Detection + Resolution Modal + Workload Chart | Installer clash detection (proper time-overlap logic, no false positives for non-overlapping times); ClashResolutionModal (substitute selection with free/busy badges, keep-anyway, time shift via TimeSelect); travel-time warning for back-to-back jobs; team workload chart with week navigation (5-level bars, green→red, interactive installer panel); auto-save form before clash check; TimeSelect rolling from current time + HH:MM:SS normalisation; Delete Job button (sales, pending only); migration 0021 (years_experience, skills); major bug: save fails on approval page (approve & schedule); minor: Friday bar missing in chart | [feat/feat-clash-resolution-20260518-1-note.md](feat/feat-clash-resolution-20260518-1-note.md) |
| feat-chat | Chat Redesign + In-App Notifications | WhatsApp-style chat layout (own messages right/terracotta, others left with avatar+name); avatars show initials colour-coded by name; Supabase join key bug fixed (author/uploader→users); voice note live waveform; camera capture button; file auto-rename (voice/camera = `{username} {date} {time}`); in-app notifications for send-back events (migration 0022); bell drawer with mark-all-read + selective delete; sales POC shown on approval cards; grammar suggest button in send-back modal (Haiku); [Sent Back] messages wiped from job chat on approval | [feat/feat-chat-20260519-1-note.md](feat/feat-chat-20260519-1-note.md) |
| fix-chat | Job Chat Realtime Fix | Fixed realtime not delivering messages: createBrowserClient non-singleton → useMemo; admin missing from auth.uid() RLS policy → migration 0023; sales JWT not wired to realtime → explicit realtime.setAuth(); policies rewritten as EXISTS subqueries → migration 0024; avatar/name cache seeded from initialMessages + async fetch for new senders | [fix/fix-chat-20260519-1-note.md](fix/fix-chat-20260519-1-note.md) |
| feat-chat-2 | Chat Attachment Previews | Image files show inline thumbnail with terracotta footer on own messages; documents show compact card with coloured file-type icon (PDF/Word/Spreadsheet/ZIP) + download arrow; voice notes show play-button card with deterministic waveform bars that animate progress during playback (grey before play → terracotta as audio plays) | [feat/feat-chat-20260520-1-note.md](feat/feat-chat-20260520-1-note.md) |
| feat-digest | Dedicated Digest Bot + D-Promote + Voting Polish | Separate TELEGRAM_DIGEST_BOT_TOKEN + digest webhook; D-Promote secret command (force importance=5, immediate send to all digest_subscribers, word stripped from summary); strict >50% majority for both promote and dismiss; live poll count always shown on messages; buttons disabled for voter immediately after vote; 5-day timeout cron auto-resolves pending votes (strict majority yes → promoted, else dismissed); digest_subscriber flag controls all recipient queries; CLAUDE.md updated to ask about importance scoring categories each session | [feat/feat-digest-20260520-1-note.md](feat/feat-digest-20260520-1-note.md) |
| fix-assistant-history | Assistant History Bugs + New Chat Alignment | isDirtyRef prevents re-saving history-loaded chats as duplicates; existingId path updates existing row in place via updateChat() preserving original topic; activeChatIdRef for unmount path; refreshTrigger re-fetches sidebar after save; New Chat button pb-[72px] clears BottomNav overlap; polish item: sidebar refresh delay (optimistic update deferred) | [fix/fix-assistant-20260520-1-note.md](fix/fix-assistant-20260520-1-note.md) |
| feat-jobs | Job Form Redesign | Attachment buckets (upload, URL link, lightbox, rename, delete); SearchableSelect for company/POC/sales with add-new + confirm-delete; InstallerGrid 2-col toggle; ImageLightbox; production instructions always visible; AttachmentBuckets replaces AttachmentSection on edit page; NewJobShell rebuilt with installer grid + 3-button action bar; admin UsersTab: years_experience + skills chip fields for installer role; migrations 0025 (attachment_buckets + bucket_id/url_text on files) + 0026 (clients + client_contacts); feat-job-form-redesign branch → merged to main directly | [feat/feat-jobs-20260520-1-note.md](feat/feat-jobs-20260520-1-note.md) |
| feat-notifications-2 | Chat Notification Throttle | Throttled job chat Telegram notifications — at most once per 1 min per recipient; accurate unseen message count per person via job_chat_state table; new tplJobChatBatch template (count, project title, client, time, location, date); View in app → button opens system browser (InlineKeyboardButton url type); chat-read API route marks last_seen_at on chat open; ChatSection calls chat-read on mount; migration 0027 (job_chat_state); fixed ts column name bug (was created_at); CLAUDE.md branch exception removed — all to dev | [feat/feat-notifications-20260520-1-note.md](feat/feat-notifications-20260520-1-note.md) |
| chore-git-cleanup | Git Branch Cleanup | Merged dev into main (3 fix-assistant code patches + session notes); reset dev to match main; deleted feat-job-form-redesign branch locally and from remote; main, dev, and origin all in sync at same commit | [chore/chore-config-20260520-1-note.md](chore/chore-config-20260520-1-note.md) |
| ux-jobs | Job Form Action Bar Polish | InstallerGrid badge fix; SuggestField "Suggest" rename; upload API production_instructions fix; CoreSection + ProductionReadySection rewrite; NewJobShell Team card; AssigneeSection deleted; GreenqubesAI role dropdown locked; Person-in-Charge + Sub POC labels; X-button revert; sales pending action bar (Save Changes + Push for Approval); scheduler awaiting_approval bar (Send Back + Approve & Notify); Duplicate (WIP) placeholder; sales awaiting_approval: form locked + Recall button; sales scheduled: Push for Approval hidden + Save Changes full width | [ux/ux-jobs-20260521-1-note.md](ux/ux-jobs-20260521-1-note.md) |
| fix-jobs | Job Form + Schedule Fixes | Schedule: filter chips by view; InstallerGrid brand-green card highlight + readOnly; back arrow → router.back(); isInstallerDirty unlocks save buttons; AttachmentBuckets silent failures fixed (migration 0028); notify-assigned route | [fix/fix-jobs-20260521-1-note.md](fix/fix-jobs-20260521-1-note.md) |
| ux-nav | Persistent Company Bar + Global Nav | CompanyBar shared component (GreenQubes + bell + user menu) sticky top-0 across all shells; NotificationDrawer refactored to fetch overdue jobs internally (no jobs prop); BottomNav kept on list/dashboard pages only; all 7 shells updated | [ux/ux-nav-20260521-1-note.md](ux/ux-nav-20260521-1-note.md) |
| feat-assistant-3 | Assistant Polish — Bulk Delete, Live Rename, Markdown, Layout | Per-user history isolation (migration 0030 drops cross-read RLS policy); optimistic "New Conversation" on first send; live auto-rename via Haiku after first response; bulk multi-select delete with confirmation modal; rename from ⋮ dropdown with persistence; message count + star importance hidden from UI; markdown rendering (MarkdownMessage — no new deps); allow typing while AI streams; full-width "← Assistant" sub-header above sidebar + content; New Chat button pb-[72px] clears BottomNav | [feat/feat-assistant-20260525-1-note.md](feat/feat-assistant-20260525-1-note.md) |
| chore-onboarding [Nic] | Bryan Onboarding Setup | docs-bryan/ folder created; assistant-onboarding.md, bryan-checklist.md, CLAUDE-bryan.md written and moved to docs-bryan/; dev-bryan branch created and pushed; CLAUDE.md updated — startup pull + dev-bryan merge/clash check + cross-checklist tagging; CLAUDE-bryan.md — branch rules, session end auto-commit/push, plan.md/context.md tagging, [Bryan] cross-checklist update | [chore/chore-config-20260525-1-note.md](chore/chore-config-20260525-1-note.md) |
| feat-vault [Nic] | Obsidian Vault Convention + Auto-Write | Vault folder scaffolding (clients, suppliers, sops, jobs, templates, contacts, digest) in greenqubes-kb; visibility + tagging convention spec; auto-write on Telegram digest promotion — majority vote → Sonnet generates note → GitHub API commits to vault/digest/; promote route replaced (copy-paste → auto-commit JSON); digest webhook fires auto-promote on majority; GITHUB_VAULT_REPO + GITHUB_VAULT_TOKEN env vars; nightly-obsidian-sync.bat (git pull + obsidian-sync); Task Scheduler setup guide | [feat/feat-vault-20260526-1-note.md](feat/feat-vault-20260526-1-note.md) |
| infra-config [Nic] | Task Scheduler — Nightly Obsidian Sync | Task Scheduler entry created on server PC (E drive) for nightly vault sync; trigger set to 2:30 AM daily; bat file tested and confirmed working; nightly-obsidian-sync.bat (git pull vault + obsidian-sync.ts) executes per schedule | [infra/infra-config-20260526-1-note.md](infra/infra-config-20260526-1-note.md) |

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
