# feat-notifications-2 — Chat Notification Throttle

_Session date: 2026-05-20_

---

## What was built

Throttled job chat Telegram notifications so they fire at most once per 1 minute per recipient per job, with an accurate count of unseen messages in the notification body.

Previously every text message, voice note, and file attachment in a job chat sent a Telegram notification immediately — one per message, per recipient. On an active job this was extremely noisy.

---

## Key files changed

| File | Change |
|---|---|
| `supabase/migrations/0027_job_chat_state.sql` | New table: `job_chat_state` (job_id, user_id, last_seen_at, last_notified_at) |
| `src/lib/supabase/queries/notifications.ts` | Added `getJobChatState`, `countUnseenMessages`, `upsertJobChatNotified` |
| `src/lib/telegram/bot.ts` | Extended `InlineKeyboardButton` type to support `url` field (for system-browser links) |
| `src/lib/telegram/templates.ts` | Added `tplJobChatBatch` template |
| `src/app/api/jobs/[id]/messages/route.ts` | Replaced `notifyParticipants` with throttled version; removed unused vars |
| `src/app/api/jobs/[id]/chat-read/route.ts` | New route — upserts `last_seen_at = now()` for current user |
| `src/features/job-detail/ChatSection.tsx` | Calls `chat-read` on mount to reset unseen count when chat is opened |
| `CLAUDE.md` | Removed feat-job-form-redesign branch exception; all changes go to `dev` |

---

## Architecture decisions

**`job_chat_state` table** — tracks two timestamps per (job, user):
- `last_seen_at` — updated when the user opens the chat (via chat-read route). Represents "read receipt".
- `last_notified_at` — updated when a Telegram notification is sent to the user. Drives the 1-minute throttle.

Unseen count = messages authored by someone else after `COALESCE(last_seen_at, last_notified_at)`. This means on the first ever notification (no state row yet) the recipient gets a count of all messages in the job, which is correct.

**Resilient per-recipient pattern** — `notifyParticipantsThrottled` wraps per-recipient DB lookups in a try-catch. If `getJobChatState` or `countUnseenMessages` throws (e.g. DB timeout), the notification still fires with `count = 1`. The `upsertJobChatNotified` call is also in its own try-catch so a failed state write can't block the send.

**`url` vs `callback_data` on InlineKeyboardButton** — digest voting uses `callback_data` (bot receives the tap server-side); the "View in app →" button uses `url` (opens the URL directly in the system browser, bypassing Telegram's WebView). The TypeScript union type in `bot.ts` now supports both forms.

**Throttle window** — 1 minute (`THROTTLE_MS = 1 * 60 * 1000`). Chosen by Nic after testing. Easy to change in `messages/route.ts`.

---

## Bugs fixed during this session

**`created_at` vs `ts` in messages table** — `countUnseenMessages` initially queried `.gt('created_at', since)`. The `messages` table uses `ts` as its timestamp column; `created_at` doesn't exist, so PostgREST silently returned null → count stayed at 0 → `Math.max(1, 0) = 1` on every notification. Fixed: changed to `.gt('ts', since)`.

**Unhandled throw in Promise.all** — any exception inside the per-recipient `Promise.all` callback would propagate up and kill all other recipients' notifications in that batch. Fixed: wrapped the DB lookup block in try-catch with fallback `count = 1`.

---

## What's next

No follow-up items specific to this feature. Pre-alpha testing (Session 19) is the next milestone.
