# Nic's Checklist — Things Only You Can Do

> Claude handles the coding. This file tracks every manual action, setup step, or decision that needs a human. Read this at the start of every session.

_Last updated: 2026-05-12 (feat-admin — pre-provision users done; Monday digest confirmed)_

---

## Pending — Next Session (Pre-Alpha Hotfixes)

### Bugs (from pre-alpha test 2026-05-11)

- [ ] **Notification: submit for approval doesn't fire** — job submission doesn't send Telegram to scheduler. Investigate `submit/route.ts`.
- [ ] **Notification: approve job doesn't fire** — scheduler approving a job sends nothing to sales or installers. Investigate `approve/route.ts`.
- [ ] **Notification: send back doesn't fire** — scheduler sending job back sends nothing to sales. Investigate `send-back/route.ts`.
- [ ] **Notification: overdue cron doesn't fire** — manual `GET /api/notifications/overdue` triggers no Telegram. Check cron route + `getOverdueJobs` query.
- [ ] **Bug report fails when image attached** — submitting a bug report with a screenshot returns "Failed to submit bug report. Please try again." — investigate R2 upload path in `bugs/route.ts`.
- [ ] **Voice note requires microphone permission every time** — browser asks for mic access on every recording. Fix: request permission once and cache the stream / MediaStream handle across recordings.
- [ ] **Job chat: attachment doesn't trigger anything** — sending a file attachment in job chat has no handler / no visible response. Investigate messages/route.ts + ChatSection attachment flow.

### Features (added 2026-05-12)

- [ ] **Admin role** — add a 4th role `admin` (scoped to `ai@greenqubes.com` only) for admin control and testing. Admin should be able to access all pages and act as any role without the amber role-switcher cookie workaround. Discuss scope at start of next session before implementing.
- [ ] **Admin page: back arrow to schedule** — add a back arrow / "← Schedule" link at the top of the admin page (`/admin`) so there's a way to navigate back to `/schedule` without using the browser back button.

### Features (from pre-alpha test 2026-05-11)

- [ ] **Voice note: live audio waveform while recording** — show an animated audio bar (waveform / level indicator) during recording so the user knows it's capturing.
- [ ] **Job creation/edit/pending: time end optional** — `time_end` should not be a required field. Some jobs don't need an end time.
- [ ] **Job creation/edit/pending: job description optional** — `description` field should not be required. Simple jobs don't always need one.
- [ ] **Job creation/edit/pending: time fields persist on edit** — editing a job auto-clears the time fields. Make them persist / pre-fill with saved values.
- [ ] **Job creation/edit/pending: AI "Suggest" button per text column** — add a small "Suggest" button (top-right of each field) for Project Title, Job Description, Note, and Production Instructions. Calls Claude to polish/correct English grammar. Like the existing smart textarea but per-field inline.
- [ ] **Scheduler tab: send scheduled job back to sales** — when editing a scheduled job, add a "Send Back" button (left of Mark Complete). Opens same send-back flow as approvals queue.
- [ ] **Scheduler tab: delete job** — when editing a job, add a "Delete Job" button (left of Send Back). Hard-deletes from DB + removes from site. Confirmation modal required.
- [ ] **Sales tab: recall job** — when editing a job in awaiting_approval status, replace "Send Back" label with "Recall Job" (same mechanic, clearer copy for sales).
- [ ] **Sales tab: pre-send popup** — before sales pushes job for approval, show a popup displaying: assigned scheduler's name + a "busier than usual" indicator if the scheduler has high load that day. Confirm to proceed.
- [ ] **`NEXT_PUBLIC_APP_URL` in Vercel** — add `NEXT_PUBLIC_APP_URL=https://greenqubes-ops.vercel.app` to Vercel Environment Variables so "View in app →" links work in production Telegram notifications.

---

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
- [ ] **Schedule Obsidian nightly sync** — once manual sync is confirmed working, set up Windows Task Scheduler on the server PC:
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
