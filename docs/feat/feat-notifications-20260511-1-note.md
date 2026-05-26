# feat-notifications — Session Note
_2026-05-11_

---

## What was done

### Telegram notification templates — fully finalised

Rewrote `src/lib/telegram/templates.ts` from scratch. Removed all `[PLACEHOLDER]` markers and replaced with professional, structured copy across all 10 template functions.

**Changes per template:**
- All job notifications: added `projectTitle` (bold, below heading), `pocName`, `pocPhone` (shows `(NIL)` if empty), `jobUrl` ("View in app →" deep link)
- `tplJobSubmittedForApproval`, `tplJobApproved`, `tplJobAssigned`: added `timeStart`/`timeEnd` shown as `Date: 14 May 2026, 9:00 AM – 5:00 PM`
- `tplJobSentBack`, `tplJobMessage`, `tplJobVoiceNote`: added `sentAt` (SGT timestamp of action)
- `tplJobSentBack`: added `schedulerName`
- `tplJobAssigned`: **new function** — notifies assigned installers when a job is approved
- `tplBugReport`: removed `screen` and `ip` params; redesigned with dividers, `Reported by: email (role)`, Platform · OS format, italic quoted message
- `tplDigestHeader`, `tplDigestItem`, `tplVoteStatus`: redesigned with `——————————————————` dividers; vote status shows pending/promoted/dismissed outcomes clearly

**New helpers:** `formatDate`, `formatTime`, `pocLines`, `dateLine` — internal, not exported.

### New query helper

Added `getJobNotifData(jobId)` to `src/lib/supabase/queries/notifications.ts`:
- Fetches `project_title, client, client_poc_name, client_poc_phone, date, time_start, time_end, location` from `jobs` table in one call
- All 6 notification caller routes now use this instead of inline queries
- `OverdueJob` type updated to include the 4 new fields; `getOverdueJobs` select updated to match

### Caller routes updated

| Route | Change |
|---|---|
| `api/jobs/[id]/approve/route.ts` | Uses `getJobNotifData`; sends `tplJobApproved` to sales + `tplJobAssigned` to each installer in parallel |
| `api/jobs/[id]/send-back/route.ts` | Uses `getJobNotifData`; adds `schedulerName`, `sentAt` via `sgtTimeNow()` |
| `api/jobs/[id]/submit/route.ts` | Uses `getJobNotifData` called AFTER DB update (so `date` reflects any change) |
| `api/jobs/[id]/messages/route.ts` | Adds `getJobNotifData` call alongside existing `getJobById` (needed for chat lock check); adds `sentAt` to both message + voice note templates |
| `api/notifications/overdue/route.ts` | Passes new params; fixes AM/PM formatting (was `2pm`, now `2 PM`) |
| `api/bugs/route.ts` | Removes `screen` and `ip` from `tplBugReport` call |

### Obsidian sync — first run

- `greenqubes-kb` added as git submodule at `vault/`
- `OBSIDIAN_VAULT_PATH=C:/Greenqubes_GitHub/greenqubes-ops/vault` added to `.env.local`
- All three npm scripts (`obsidian-sync`, `monday-digest`, `sync-bugs`) updated to use `node --use-system-ca --import tsx` to fix Windows TLS certificate verification error (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`)
- First sync confirmed working: `✓ Welcome.md (1 chunk)` upserted to `kb_chunks`

### Other

- `NEXT_PUBLIC_APP_URL=https://greenqubes-ops.vercel.app` added to `.env.local` (still needs Vercel dashboard — see checklist)
- UI/UX Pro Max design system run; output saved to `design-system/greenqubes-ops/MASTER.md` (Trust & Authority style, Fraunces + IBM Plex Sans confirmed)
- Production OAuth redirect URI added to Supabase Auth → URL Configuration

---

## Pre-alpha testing results (2026-05-11)

Tested all notification flows on Vercel preview. Working: chat messages (✓), voice note recording flow (✓ with issues). All other notification triggers failed — see bugs below.

**Bugs found:**
- Submit for approval — no Telegram notification fires
- Approve job — no Telegram notification fires
- Send back — no Telegram notification fires
- Overdue cron — no notification fires on manual trigger
- Bug report with image attachment — returns "Failed to submit bug report"
- Voice note — mic permission requested every single recording (should be once)
- Job chat attachments — no handler fires

**Feature requests:**
- Voice note live audio waveform while recording
- `time_end` and `description` should be optional fields (job creation/edit/pending pages)
- Time fields persist on edit (currently auto-cleared)
- AI "Suggest" button per text column (Project Title, Description, Note, Production Instructions)
- Scheduler edit: "Send Back" + "Delete Job" buttons beside Mark Complete
- Sales edit: "Recall Job" instead of "Send Back" when job is awaiting approval
- Pre-send popup for sales showing scheduler name + busyness indicator before pushing for approval

---

## Key files changed

- `src/lib/telegram/templates.ts` — complete rewrite
- `src/lib/supabase/queries/notifications.ts` — new `JobNotifData` type + `getJobNotifData`; updated `OverdueJob`
- `src/app/api/jobs/[id]/approve/route.ts`
- `src/app/api/jobs/[id]/send-back/route.ts`
- `src/app/api/jobs/[id]/submit/route.ts`
- `src/app/api/jobs/[id]/messages/route.ts`
- `src/app/api/notifications/overdue/route.ts`
- `src/app/api/bugs/route.ts`
- `package.json` — `--use-system-ca` added to all script commands
- `.env.local` — `OBSIDIAN_VAULT_PATH`, `NEXT_PUBLIC_APP_URL` added; broken `CRON_SECRET` line fixed
- `.gitmodules` — `greenqubes-kb` submodule added
- `design-system/greenqubes-ops/MASTER.md` — new
- `docs/superpowers/specs/2026-05-11-telegram-notifications-design.md` — new
- `docs/superpowers/plans/2026-05-11-telegram-notifications.md` — new

---

## What's next

Fix all bugs found in pre-alpha testing. See `docs/nic-checklist.md` → Pending — Next Session.
