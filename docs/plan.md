# Greenqubes — Build Plan

> Updated after each session. Read this alongside CONTEXT.md at the start of every session.

_Last updated: 2026-08-06 (ux-jobs — job form reorganised: phone tabs + PC two-column layout, working Duplicate button, chat bucket-leak fix; live on production)_

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

**Workflow V2 is LIVE on production — clean-cut switchover completed 2026-08-03.** All four phases were built and smoke-tested on `feat-workflow-v2`, Nic's full regression test passed, and the branch was merged `feat-workflow-v2` → `dev` → `main` in one shot. Next milestone: Session 19 pre-alpha testing on V2.

**Schedule list navigation redesigned (2026-08-05, live on production):** the endless date strip is gone — the list view now shows a windowed strip (week Mon–Sun ↔ full month, icon toggle remembered per device), paging arrows that peek without changing the selection, a persistent centred month label, a jump calendar off the heading, and an amber Today button. Filter chips (All/Today/This week/Upcoming) were **removed** — superseded by the strip + Today button; the List/Week/Month view toggle stays. **Weeks are Monday-start app-wide** (Week tab, Month tab, installer views, strip) and **date labels are always English** (`langToLocale` deleted per the CLAUDE.md hard rule). **No new Bengali translations** (boss decision 2026-08-03 via Nic): new i18n keys get en + zh only; bn falls back to English automatically.

**Job form reorganised (2026-08-06, live on production):** the New/Edit job pages share one responsive shell — **phone: 4 tabs** (Details / Team / Files / Chat; lossless switching, sticky action bar on every tab, opens on Details, chat Telegram links deep-link to the Chat tab via `?tab=chat`); **PC (lg+): two columns** (Details+Team left, Files+Chat right) with every card collapsible except Job Chat (chevron, per-device localStorage memory, read after mount only). New job uses the same shell with Files/Chat locked pre-save + a sticky action bar; production instructions unified into the Production card on both pages. The **Duplicate button** is live (was WIP): sales/scheduler/coordinator/admin, any status incl. completed → new pending job copying Details-tab fields (+" (Copy)" title), attachment buckets and production photos as **true R2 copies** (`/api/jobs/[id]/duplicate`); location blank, POC = duplicator, team/chat/tasks empty. **Bug fixed (was live on production):** bucket uploads share kind `attachment` with chat uploads and leaked into job chat — chat now excludes rows with a `bucket_id` on load + realtime.

- **Phase 1** (passed 2026-06-24): designer/coordinator/production roles live in DB + admin UI; approval workflow removed — sales pushes pending jobs directly to scheduled ("Push to Schedule"), all schedulers get a Telegram "New Job — Assign Installer" notification; /approvals redirects to /schedule.
- **Phase 2** (passed 2026-07-22): role-locked job form (designer view-only; production edits production-ready/DO/instructions/photos only; per-role action bars) and the **installer suggestion → assignment flow** — sales *suggests* (yellow, hidden from the installer until confirmed), coordinator/scheduler *formally assigns* (green, clears suggestions) and Telegram fires to the installer + sales POC + coordinators. Clash modal gained **Notify Scheduler** (holds job pending) / **Push Anyways**, plus a non-blocking amber heads-up for no-fixed-time "floater" installers. Preview-as now covers all 6 roles.

- **Phase 3** (passed 2026-07-22): the **FCFS Board** at `/fcfs`, built to the approved `fcfs-timeline-v2` mockup — day-view timeline (job rows ranked first-come-first-served, installer bars coloured by punctuality: blue flexible / red strict / bright-red hard clash / blue+amber-dashed soft warning / amber suggestion), AM/PM/AM-PM/9–6 zoom, clash chips + drawer, slide-in assignment panel (confirm/remove suggestions, add installers, Save & Notify via the Phase 2 assign-installers route). Clash-on-edit of a scheduled job closed (checkOnly + EditClashModal: scheduler gets Save Anyway/Go Back, coordinator gets Alert Scheduler & Save / Re-assign). **Rank counts from push-to-schedule** (`scheduled_at`, migration 0038 trigger) — Nic's call, since sales can't see each other's pending jobs. `/approvals` → `/fcfs`. **Day view only** — the mockup's Week / Month / By-Project / By-Installer toggles are deferred until designed.

**FCFS tab: NOT shown to installers** (Nic, 2026-07-22) — the board is a scheduler/coordinator planning tool; installers only need their own jobs. This overrides the Phase 1 "FCFS for every role" decision. It remains in the nav for scheduler / sales / coordinator / designer / production / admin; installers hitting `/fcfs` are bounced to `/installer`.

**⚠ Standing rule — overlays above the bottom nav** (Nic, 2026-07-22, in CLAUDE.md hard rules): every modal / drawer / bottom sheet / slide-in panel layers **above** BottomNav (`z-50`) — use `z-[60]`+. Nothing interactive may be hidden behind the nav.

- **Phase 4** (passed 2026-07-30): **external installer persistent links** — one lifetime token per outside person; public mobile page at `/ext/[token]` (accept/decline, upcoming/past, detail with attachments + interactive task list + person-in-charge call card — live chat for externals deferred). Managed from the **external installers bucket** in the Team card: every office role sees it, sales *suggests* externals (amber, invisible on the contact's page until a scheduler/coordinator confirms), managers add/copy-link/delete/restore — delete invalidates the link instantly, restore revives the **same token** with all history. **Sub-installer bucket** — same pool + suggestion rules as the main grid, excluded from clash detection (still counts in workload), own "Job Assigned — Supporting Role" Telegram. **Task list** — office builds it (drag-reorder, works on touch), installers/subs/externals tick with a progress bar. Copied links compose from the current site origin (preview vs production).

**Switchover verification (2026-08-03):** merged `dev` and `main` trees confirmed byte-identical to the regression-tested branch; type-check + production build green before each push; production confirmed live on V2 (`/ext` and `/fcfs` routes serving, old-code 404s gone).

**Branching strategy — clean cut EXECUTED (2026-08-03):** the clean-cut rule (decided 2026-06-24) is complete — V2 replaced the old workflow on dev/main in one shot. `feat-workflow-v2` is kept for historical record only (Nic) — do not push new changes to it. Normal deployment workflow resumes: all changes → `dev` first, Vercel preview, then `main`.

**Known bug (do not touch):** React hydration error #418 on `/schedule` in production — non-blocking, page works after refresh. Multiple fix attempts failed and were force-reverted. Leave it alone without a new specific hypothesis.

**DB migrations:** 0001–0040 all applied to the shared remote DB (prod/dev/v2 previews share it). 0033–0036 are the Workflow V2 Phase 1 set — incl. two hotfixes: 0035 (suggested_by FK dropped — second FK to users broke every `job_assignees(users(...))` embed with PGRST201) and 0036 (sales may transition own pending job to scheduled). **0037** is the Phase 2 migration: installer job-visibility RLS ignores suggestions (a suggested installer must not see the job), and coordinator + production gain `jobs` UPDATE. **0038** is the Phase 3 migration: `jobs.scheduled_at` + a trigger stamping every transition into `scheduled` — FCFS rank counts from push-to-schedule. **0039–0040** are the Phase 4 set: `external_contacts` (lifetime token — built-in `gen_random_uuid`, NOT `gen_random_bytes`: pgcrypto is not enabled on this DB), `job_external_contacts` (+ `is_suggestion`/`suggested_by` in 0040 — plain uuid, no users FK, the 0035 lesson), `job_tasks`, and `external_verification` on file_kind. Any new migration must stay backward-compatible with the code deployed on dev/main.

**⚠️ Standing rule — never embed `users` directly onto `jobs`** in a PostgREST select. `jobs` has several FKs to `users` (sales_poc_id, approved_by), and this has now broken twice: PGRST201 crashes (fixed by migration 0035) and the Phase 2 bug where `getInstallerJobs`' `sales_poc:users!jobs_sales_poc_id_fkey` embed made the installer's job list come back with empty `project_title`/`client`. Fetch the user in a follow-up query instead.

**Obsolete bugs removed:** "Save fails on approvals page" — approvals page no longer exists. AdminRoleModal double-Yes — confirmed not a bug (chore-config 2026-05-29). Friday bar in WeekWorkloadChart — fixed per checklist.

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
| fix-jobs | Job Form + Schedule Fixes | Schedule: filter chips hidden in week (All only) / month (none) views; InstallerGrid: card highlights brand-green on select (no tick), readOnly prop, isInstallerDirty unlocks Save Changes (sales) + Save & notify (scheduler); back arrow → router.back() + "Back to Schedule"; installer locked for sales on scheduled jobs; AttachmentBuckets: fixed silent failures (url_link + production_instructions missing from file_kind DB enum — migration 0028), added success/error toasts, contentType fallback; new /api/jobs/[id]/notify-assigned route sends tplJobAssigned to newly added installers on scheduler save | [fix/fix-jobs-20260521-1-note.md](fix/fix-jobs-20260521-1-note.md) |
| ux-nav | Persistent Company Bar + Global Nav | CompanyBar shared component (GreenQubes + bell + user menu) sticky top-0 across all shells; NotificationDrawer refactored to fetch overdue jobs internally (no jobs prop); BottomNav kept on list/dashboard pages only; all 7 shells updated | [ux/ux-nav-20260521-1-note.md](ux/ux-nav-20260521-1-note.md) |
| feat-assistant-3 | Assistant Polish — Bulk Delete, Live Rename, Markdown, Layout | Per-user history isolation (migration 0030 drops cross-read RLS policy); optimistic "New Conversation" on first send; live auto-rename via Haiku after first response; bulk multi-select delete with confirmation modal; rename from ⋮ dropdown with persistence; message count + star importance hidden from UI; markdown rendering (MarkdownMessage — no new deps); allow typing while AI streams; full-width "← Assistant" sub-header above sidebar + content; New Chat button pb-[72px] clears BottomNav | [feat/feat-assistant-20260525-1-note.md](feat/feat-assistant-20260525-1-note.md) |
| chore-onboarding [Nic] | Bryan Onboarding Setup | docs-bryan/ folder created; assistant-onboarding.md, bryan-checklist.md, CLAUDE-bryan.md written and moved to docs-bryan/; dev-bryan branch created and pushed; CLAUDE.md updated — startup pull + dev-bryan merge/clash check + cross-checklist tagging; CLAUDE-bryan.md — branch rules, session end auto-commit/push, plan.md/context.md tagging, [Bryan] cross-checklist update | [chore/chore-config-20260525-1-note.md](chore/chore-config-20260525-1-note.md) |
| feat-vault [Nic] | Obsidian Vault Convention + Auto-Write | Vault folder scaffolding (clients, suppliers, sops, jobs, templates, contacts, digest) in greenqubes-kb; visibility + tagging convention spec; auto-write on Telegram digest promotion — majority vote → Sonnet generates note → GitHub API commits to vault/digest/; promote route replaced (copy-paste → auto-commit JSON); digest webhook fires auto-promote on majority; GITHUB_VAULT_REPO + GITHUB_VAULT_TOKEN env vars; nightly-obsidian-sync.bat (git pull + obsidian-sync); Task Scheduler setup guide | [feat/feat-vault-20260526-1-note.md](feat/feat-vault-20260526-1-note.md) |
| infra-config [Nic] | Task Scheduler — Nightly Obsidian Sync | Task Scheduler entry created on server PC (E drive) for nightly vault sync; trigger set to 2:30 AM daily; bat file tested and confirmed working; nightly-obsidian-sync.bat (git pull vault + obsidian-sync.ts) executes per schedule | [infra/infra-config-20260526-1-note.md](infra/infra-config-20260526-1-note.md) |
| fix-bugs | Bryan Migration Conflict + TS Build Fix | Renamed Bryan's 0015_bug_github_issue.sql → 0031 (0015 was taken); added github_issue_url to bug_reports Row type in types.ts; made it optional in Insert type and insertBugReport signature; DB already up to date (Bryan's agent had run db push) | [fix/fix-bugs-20260528-1-note.md](fix/fix-bugs-20260528-1-note.md) |
| feat-admin [Nic] | Admin Panel Improvements | Bugs tab forbidden fix (admin role); screenshot modal; three-bot health checks; obsidian sync + overdue cron event logging; Voyage/Telegram/R2 API usage logging; IP geolocation + non-SG anomaly rule; bug delete + multi-select + sort controls | [feat/feat-admin-20260528-1-note.md](feat/feat-admin-20260528-1-note.md) |
| feat-admin-3 [Nic] | Remove User / Revoke Access | Soft delete for active employees (deleted_at + Supabase Auth revocation); hard delete for provisioned users; migration 0032 (deleted_at column + partial index); removeUserAccess() with UserRemovalValidationError; DELETE /api/admin/users/[id]; auth callback blocks deleted re-login; middleware blocks deleted sessions; deleted_at IS NULL filters across all user queries; DeleteUserModal (two variants) + Remove button in UsersTab; pushed to dev preview; DB migration pending (npx supabase db push) | [feat/feat-admin-20260529-1-note.md](feat/feat-admin-20260529-1-note.md) |
| chore-config [Nic] | Checklist Cleanup | AdminRoleModal double-Yes confirmed not a bug (just load time); bulk delete jobs confirmed already fully implemented (checkboxes + delete bar + confirm step + parallel DELETE calls); checklist updated | [chore/chore-config-20260529-1-note.md](chore/chore-config-20260529-1-note.md) |
| fix-rag [Nic] | RAG + Knowledge Base Fixes | Voyage AI input_type fix (query/document); kb_chunks match threshold tuned to 0.35 for tabular price data; filename prepended to chunk embeddings for supplier name searchability; table rendering added to MarkdownMessage; supplier-template.md + DAMA.md + Jacky Printing pricelist added to vault; obsidian-sync workflow documented | [fix/fix-assistant-20260603-1-note.md](fix/fix-assistant-20260603-1-note.md) |
| infra-config [Nic] | Cron Schedule + R2 Folder Design | Overdue cron moved from 6pm SGT to 8am SGT (vercel.json); plan.md session note link discrepancy fixed; R2 human-readable folder pattern agreed: `{YYYY-MM-DD}_{Company}_{Client-Name}_{Project-Title}`; 4 sub-tasks noted in checklist for next session | [infra/infra-config-20260605-1-note.md](infra/infra-config-20260605-1-note.md) |
| chore-jobs [Nic] | Workflow V2 — Design + Plan | Full workflow redesign: 7 roles (+ designer, coordinator, production), approval workflow removed (sales pushes directly to scheduled), FCFS board replaces approvals tab, installer suggestion (yellow) vs formal assignment (green), external installer temp links (48hr), sub-installer relationship, task list bucket, external installer POC bucket (multi-team placeholder card). Branch `feat-workflow-v2` created. 25-task implementation plan written across 4 phases. No code written this session. | [chore/chore-jobs-20260605-1-note.md](chore/chore-jobs-20260605-1-note.md) |
| fix-schedule [Nic] | Vercel 404 Fix + Schedule Date Strip | Moved Workflow V2 mockups from `docs/superpowers/mockups/` → `public/mockups/workflow-v2/` so Vercel serves them as static assets (Next.js only serves `public/`). Schedule list view date strip now shows all dates in the full range (earliest job → latest job), not just dates with assigned jobs. `feat-workflow-v2` branch merged up to date with dev and pushed to remote — Vercel generates a separate preview for it. | [fix/fix-schedule-20260611-1-note.md](fix/fix-schedule-20260611-1-note.md) |
| feat-jobs [Nic] | Workflow V2 Phase 1 — Roles + Approval Removal | Migrations 0033–0036: designer/coordinator/production roles, installer-suggestion columns, RLS widening, suggested_by FK hotfix (PGRST201 had crashed /schedule on all deployments), sales pending→scheduled RLS fix. Approval workflow removed: approve/send-back routes + ApprovalCard/SendBackModal/ApprovalsShell deleted; "Push to Schedule" replaces "Push for Approval"; submit sets scheduled directly + tplNewJobCreated Telegram to all schedulers; /approvals → /schedule redirect; BottomNav FCFS tab for every role; new-job form success modal + failure surfacing. **Smoke test mid-way — sections 3–5 pending, see note** | [feat/feat-jobs-20260612-1-note.md](feat/feat-jobs-20260612-1-note.md) |
| fix-jobs [Nic] | Workflow V2 Phase 1 — Smoke Test Fixes (PASSED) | Finished Phase 1 smoke test (all 5 sections pass). Fixes: (1) New Job screen now runs the clash check before Push to Schedule (was pushing straight to /submit with no double-booking check); (2) clash modal — shifting the job time to a non-overlapping slot now auto-resolves the clash (reuses server overlap logic) + "Send to scheduler" renamed to V2's "Push to Schedule"; (3) chat attachment realtime now resolves uploader name (live photos showed "Unknown"/"?"); (4) installer My Jobs card now shows project_title (was client-only, so titled jobs looked blank). Clean-cut strategy agreed — no incremental merge to dev. Clash-on-edit-of-scheduled-job deferred to Phase 3. | [fix/fix-jobs-20260624-1-note.md](fix/fix-jobs-20260624-1-note.md) |
| feat-jobs [Nic] | Workflow V2 Phase 2 — Role-Locked Form + Installer Suggestion/Assignment (PASSED) | Tasks 9–15. Role-locked job form: designer view-only (no Save bar), production edits production-ready/DO/instructions/photos only, per-role action bars; Team card (POC/coordinators/notes) gated too. Installer **suggestion → assignment** flow: sales suggests (yellow, saves instantly via new `/suggest-installer`), coordinator/scheduler formally assigns (green) via new `/assign-installers` which clears suggestions and Telegrams the installer (`tplJobAssigned`) + sales POC/coordinators (`tplInstallerAssigned`). InstallerGrid rewritten as a 3-state presentation grid. **Migration 0037** — installer visibility RLS ignores suggestions; coordinator+production gain jobs UPDATE. Suggestions stripped from schedule/installer/overdue/workload/chat-recipient queries. Clash modal: **Notify Scheduler** (holds job pending, new `/notify-clash` + `tplClashNeedsReview`) + **Push Anyways**, and soft non-blocking heads-up for no-fixed-time floaters. Preview-as extended to all 6 roles. Bugs fixed: new-job form used real not effective role (suggestions saved as assignments); attachment buckets used auth id as `uploader_id` (FK violation — **production bug too**); installer list blank title (jobs→users embed). FCFS dropped from installer nav. | [feat/feat-jobs-20260722-1-note.md](feat/feat-jobs-20260722-1-note.md) |
| feat-jobs [Nic] | Workflow V2 Phase 3 — FCFS Board (PASSED) | Tasks 16–19 + smoke-test fixes. FCFS day-timeline board at `/fcfs` per the approved mockup: job rows ranked FCFS, punctuality-coloured installer bars, AM/PM/9–6 zoom, clash chips + drawer, slide-in assignment panel (confirm/remove suggestions, add, Save & Notify). Clash-on-edit of scheduled jobs closed (checkOnly + EditClashModal — scheduler: Save Anyway/Go Back; coordinator: Alert Scheduler & Save). **Migration 0038**: `scheduled_at` trigger — rank counts from push-to-schedule (sales can't see each other's pending jobs). Smoke-test fixes: wide-view bar alignment (flex hour columns), **overlays above BottomNav** (new hard rule in CLAUDE.md, z-[60]), scrollable clash chips, bolder priority labels, "All day" on schedule list + board, Person-in-Charge/Sub-POC dropdowns now list **all office roles** (sales-only / sales-scheduler-admin filters hid newly provisioned coordinators/designers/production). `/approvals`→`/fcfs`. Day view only — other view toggles deferred. | [feat/feat-jobs-20260722-2-note.md](feat/feat-jobs-20260722-2-note.md) |
| feat-jobs [Nic] | Workflow V2 Phase 4 — External Links + Sub-installers + Task List (PASSED) | Tasks 20–25 + smoke-test feedback. Migrations 0039 + 0040. Public `/ext/[token]` page (accept/decline, detail, task ticking — chat deferred); external POC bucket for every office role (sales suggest → manager confirm, delete/restore with same-token revival); sub-installer bucket + "Supporting Role" Telegram; task list with touch drag-reorder. Fixes: copied links pointed at production (now current origin); sub Telegram silently rejected (unclosed bold tag); 0039 pgcrypto dependency removed; `jobs` Row types gained `project_title`/`date_end`. **V2 build complete — regression test + clean-cut switchover next.** | [feat/feat-jobs-20260730-1-note.md](feat/feat-jobs-20260730-1-note.md) |
| chore-config [Nic] | Workflow V2 Clean-Cut Switchover | Full V2 regression test passed (Nic, on the preview) → `feat-workflow-v2` merged into `dev` (3 doc-file conflicts resolved to the newer branch versions) → `dev` merged into `main`; both pushed. Merged trees verified byte-identical to the tested branch; type-check + production build green; production verified live on V2 (`/ext` + `/fcfs` serving). `feat-workflow-v2` kept for historical record — no new pushes to it. Normal dev-first deploy workflow resumes. | [chore/chore-config-20260803-1-note.md](chore/chore-config-20260803-1-note.md) |
| ux-schedule [Nic] | Schedule List Scrolling UX | Windowed date strip (week Mon–Sun ↔ month, icon toggle persisted per device), peek paging arrows, persistent centred month label, jump calendar from the heading, amber Today button (left side); filter chips removed; Monday-start weeks app-wide (Week/Month tabs + installer views); date labels always English (`langToLocale` deleted); `scrollbar-none` utility finally defined; page spacing + legend tightened; interactive mockup at `public/mockups/schedule-list-ux/`; smoke test passed desktop + mobile (2 feedback rounds); merged dev→main, live on production. Bryan's obsidian-sync frontmatter tidy-up rode along. | [ux/ux-schedule-20260805-1-note.md](ux/ux-schedule-20260805-1-note.md) |
| ux-jobs [Nic] | Job Form Tabs + Duplicate + Chat Leak Fix | New/Edit job pages share one responsive shell: phone = 4 tabs (Details/Team/Files/Chat, all groups stay mounted so switching never loses typing, sticky action bar everywhere, `?tab=chat` deep link wired to chat Telegram notifications); PC = two columns (Details+Team \| Files+Chat) with collapsible cards except chat (`CollapseCard` + `useCardCollapse`, per-device localStorage, hydration-safe); New job: same shell, Files/Chat locked pre-save, sticky bar, production instructions moved to Production card (matches Edit). Duplicate button live: `/api/jobs/[id]/duplicate` copies Details fields (+" (Copy)" title), buckets + production photos as true R2 copies (`copyObject`); location blank, POC = duplicator, team/chat/tasks fresh, status pending. Fix (pre-existing prod bug): bucket uploads (kind `attachment` + `bucket_id`) leaked into job chat on load + realtime. Merged dev→main same day. Future notes: Telegram notification tracker, sub-jobs under a parent job. | [ux/ux-jobs-20260806-1-note.md](ux/ux-jobs-20260806-1-note.md) |

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
