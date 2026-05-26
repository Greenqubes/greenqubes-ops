# Chat Notification Throttle — Design Spec

**Date:** 2026-05-20
**Status:** Approved

---

## Problem

The job chat Telegram notification fires for every single message, voice note, and attachment. With up to 30 people in a job chat, this creates constant noise on everyone's phone. Users need one batched summary notification per job, at most once every 5 minutes, showing only the messages they haven't actually read yet.

---

## Goal

- Fire at most one Telegram notification per (job, recipient) per 5 minutes
- Show an accurate unseen message count based on when the recipient last opened the chat
- New message format: count, project title, client, time, location, date, URL button
- "View in app →" opens in the system browser (Safari/Chrome), not Telegram's built-in browser

---

## Data Model

### New table: `job_chat_state` (migration 0025)

One row per (job, user). Tracks both read state and notification throttle in a single table.

```sql
CREATE TABLE job_chat_state (
  job_id           uuid NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at     timestamptz,
  last_notified_at timestamptz,
  PRIMARY KEY (job_id, user_id)
);
```

RLS:
- Authenticated users can upsert their own row (`user_id = auth.uid()` resolved via `users.auth_id`)
- Service role has full access (used by notification logic in API routes)

No additional indexes needed — primary key covers all query patterns.

---

## API Changes

### New route: `POST /api/jobs/[id]/chat-read`

Called from `ChatSection` on mount. Updates `last_seen_at = now()` for the current user on this job.

- Auth required (user session)
- Upserts into `job_chat_state` using service client
- Returns `{ ok: true }` — caller ignores response (fire-and-forget)
- No RLS needed on this route — uses service client, auth is checked at route level

### Modified route: `POST /api/jobs/[id]/messages`

Replace the immediate `notifyParticipants` helper with a throttled `notifyParticipantsThrottled` helper.

**Per-recipient logic (runs in parallel across all recipients):**

1. Fetch `job_chat_state` row for `(job_id, recipient_id)` using service client
2. If `last_notified_at IS NOT NULL` and `now() - last_notified_at < 5 minutes` → skip (no notification sent; message accumulates silently)
3. Otherwise:
   a. Count rows in `messages` where `job_id = X AND author_id != recipient_id AND created_at > COALESCE(last_seen_at, last_notified_at, '-infinity'::timestamptz)`
      — uses whichever is more recent: when they last opened the chat, or when we last notified them. Prevents an inflated count for users who have been notified before but never opened the chat.
   b. Add 1 for the current message being processed (already in DB for text/voice; attachment not in messages table so +1 manually)
   c. Send notification via `sendTelegramWithKeyboard` using `tplJobChatBatch` template
   d. Upsert `last_notified_at = now()` for `(job_id, recipient_id)`

The existing `notifyParticipants` helper is removed and replaced entirely. All three message kinds (text, voice, attachment) go through the same throttled path.

---

## Template

### New: `tplJobChatBatch` in `src/lib/telegram/templates.ts`

Replaces `tplJobMessage` and `tplJobVoiceNote` for all job chat notifications.

```
💬 You have <b>X New Messages</b>
<b>Project Title</b>
Client: Acme Corp
Time: 9 AM – 5 PM
📍 123 Orchard Road
Date: 20 May 2026
```

With "View in app →" as an InlineKeyboardButton URL button (not an HTML link in the message body).

Parameters:
- `count: number`
- `projectTitle: string | null`
- `jobClient: string`
- `jobDate: string`
- `timeStart: string | null`
- `timeEnd: string | null`
- `location: string`
- `jobUrl: string`

POC name/phone are removed from this template — they were in the old per-message templates but are noise in a batched summary.

`tplJobMessage` and `tplJobVoiceNote` are kept in the file (still used by other notification routes — approve, send-back, etc.) but no longer called from the messages route.

---

## bot.ts Change

Update `InlineKeyboardButton` type to a union supporting both callback buttons (digest voting) and URL buttons (new chat notification):

```typescript
export type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
```

No other changes to `bot.ts`. `sendTelegramWithKeyboard` already handles the keyboard payload generically and will pass URL buttons through correctly once the type is updated.

---

## ChatSection Change

Add a `useEffect` on mount in `ChatSection.tsx` that calls `POST /api/jobs/${jobId}/chat-read`. This is the only change to the component.

```typescript
useEffect(() => {
  fetch(`/api/jobs/${jobId}/chat-read`, { method: 'POST' })
}, [jobId])
```

⚠️ **File conflict risk:** `ChatSection.tsx` is in `src/features/job-detail/` — another agent is working on the job form in the same folder. Run `git status` + `git diff` before committing and flag any overlap to Nic before pushing.

---

## Files Touched

| File | Change |
|---|---|
| `supabase/migrations/0025_job_chat_state.sql` | New — `job_chat_state` table + RLS |
| `src/lib/telegram/bot.ts` | Update `InlineKeyboardButton` type union |
| `src/lib/telegram/templates.ts` | Add `tplJobChatBatch`; keep existing templates |
| `src/lib/supabase/queries/notifications.ts` | Add `getJobChatState` + `upsertJobChatNotified` helpers |
| `src/app/api/jobs/[id]/messages/route.ts` | Replace `notifyParticipants` with throttled version |
| `src/app/api/jobs/[id]/chat-read/route.ts` | New — mark chat as read |
| `src/features/job-detail/ChatSection.tsx` | Add `useEffect` to call chat-read on mount |

---

## What Is Not Changing

- All other notification templates (approve, send-back, overdue, assigned, bug) are untouched
- The digest bot and voting system are untouched
- The messages table schema is untouched — no new columns
- Voice note and attachment flows are preserved; only the notification side changes
