# Nic's Checklist — Things Only You Can Do

> Claude handles the coding. This file tracks every manual action, setup step, or decision that needs a human. Read this at the start of every session.

_Last updated: 2026-05-29 (feat-admin-3 — remove user / revoke access)_

---

## Pending — Next Session

### Setup (from 2026-05-29, feat-admin-3)

- [x] **[Nic] Run `npx supabase db push`** — migration 0032 applied. `deleted_at` column + partial index live on remote DB.

### Features (from 2026-05-26, vault-convention)

- [ ] **R2 human-readable folder names** — right now job files are stored under UUID folder names (e.g. `jobs/717c82f7-.../`). Rename to `{date}_{client-slug}_{short-id}` format (e.g. `2026-05-20_Greentech-Plaza_717c82f7`) so rclone backups on local server are browsable by job. Requires migrating existing R2 keys + updating `files` table. Do before go-live while data is still clean. Needs design + plan.

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
- [x] Nightly backup scheduled in Task Scheduler at 02:00 — syncs R2 → `E:\Greenqubes-Archive\r2` and dumps DB → `E:\Greenqubes-Archive\db\`
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

Admin access is hard-gated to `ai@greenqubes.com` only at both the page and API level. No other account — not even other scheduler accounts — can reach `/admin` or any `/api/admin/*` endpoint. The check is against the Google-authenticated email, not a role field, so it cannot be bypassed by editing `public.users`.
