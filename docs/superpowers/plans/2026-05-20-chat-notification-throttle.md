# Chat Notification Throttle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-message Telegram notification in job chat with a throttled batch notification (at most once per 5 minutes per recipient) showing an accurate unseen message count.

**Architecture:** A new `job_chat_state` DB table tracks two timestamps per (job, user): when they last opened the chat and when they were last notified. On each message, the notification logic checks both timestamps to decide whether to fire and what count to show. A new `POST /api/jobs/[id]/chat-read` route updates the last-seen timestamp when the user opens the chat.

**Tech Stack:** Next.js 15 API routes, Supabase (Postgres + service client), Telegram Bot API (HTML parse mode + inline keyboards)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/0027_job_chat_state.sql` | Create | New table + RLS |
| `src/lib/telegram/bot.ts` | Modify | Add URL button to `InlineKeyboardButton` type union |
| `src/lib/telegram/templates.ts` | Modify | Add `tplJobChatBatch` function |
| `src/lib/supabase/queries/notifications.ts` | Modify | Add 3 new helper functions |
| `src/app/api/jobs/[id]/chat-read/route.ts` | Create | Mark-as-read endpoint |
| `src/app/api/jobs/[id]/messages/route.ts` | Modify | Replace `notifyParticipants` with throttled version |
| `src/features/job-detail/ChatSection.tsx` | Modify | Add `useEffect` to call chat-read on mount |

---

## Task 1: DB migration — job_chat_state table

**Files:**
- Create: `supabase/migrations/0027_job_chat_state.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Tracks per-user read state and notification throttle for job chat.
-- One row per (job, user). Used by the chat notification throttle logic.
create table public.job_chat_state (
  job_id           uuid not null references public.jobs(id)  on delete cascade,
  user_id          uuid not null references public.users(id) on delete cascade,
  last_seen_at     timestamptz,
  last_notified_at timestamptz,
  primary key (job_id, user_id)
);

alter table public.job_chat_state enable row level security;

-- Users can read and upsert their own row (used by the chat-read route)
create policy "users can manage own chat state" on public.job_chat_state
  for all
  using (
    user_id = (select id from public.users where auth_id = auth.uid())
  )
  with check (
    user_id = (select id from public.users where auth_id = auth.uid())
  );
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: `Applied 1 migration` with no errors. If you see `already applied`, check that 0027 doesn't already exist.

- [ ] **Step 3: Verify the table exists**

In Supabase dashboard → Table Editor, confirm `job_chat_state` appears with columns: `job_id`, `user_id`, `last_seen_at`, `last_notified_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0027_job_chat_state.sql
git commit -m "feat: add job_chat_state migration for chat notification throttle"
```

---

## Task 2: Update InlineKeyboardButton type to support URL buttons

**Files:**
- Modify: `src/lib/telegram/bot.ts`

The current type only allows `callback_data` buttons (used by digest voting). We need to also allow `url` buttons so the "View in app →" button opens in the system browser rather than Telegram's built-in WebView.

- [ ] **Step 1: Update the type at the bottom of `src/lib/telegram/bot.ts`**

Find this line (currently near line 194):
```typescript
export type InlineKeyboardButton = { text: string; callback_data: string }
```

Replace with:
```typescript
export type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
```

- [ ] **Step 2: Verify typecheck still passes**

```bash
npx tsc --noEmit
```

Expected: no new errors. The existing digest voting code uses `callback_data` buttons and is unaffected by the union — TypeScript narrows correctly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram/bot.ts
git commit -m "feat: add URL button variant to InlineKeyboardButton type"
```

---

## Task 3: Add tplJobChatBatch template

**Files:**
- Modify: `src/lib/telegram/templates.ts`

Add the new batched chat notification template. The existing `tplJobMessage` and `tplJobVoiceNote` functions stay in the file — they are still used by other routes (approve, send-back). Only the messages route will stop calling them.

- [ ] **Step 1: Add `tplJobChatBatch` to the end of the Job notifications section in `src/lib/telegram/templates.ts`**

Add this function after `tplJobVoiceNote` (before the `// ─── Bug report` comment):

```typescript
export function tplJobChatBatch(p: {
  count:        number
  projectTitle: string | null
  jobClient:    string
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  location:     string
}): string {
  const timeLine = p.timeStart && p.timeEnd
    ? `Time: ${formatTime(p.timeStart)} – ${formatTime(p.timeEnd)}\n`
    : ''
  return (
    `💬 You have <b>${p.count} New Message${p.count !== 1 ? 's' : ''}</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    timeLine +
    `📍 ${p.location}\n` +
    `Date: ${formatDate(p.jobDate)}`
  )
}
```

Note: `formatDate` and `formatTime` are private helpers already at the top of the file. No imports needed.

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram/templates.ts
git commit -m "feat: add tplJobChatBatch template for throttled chat notifications"
```

---

## Task 4: Add query helpers to notifications.ts

**Files:**
- Modify: `src/lib/supabase/queries/notifications.ts`

Add three helpers: fetch a user's chat state, count their unseen messages, and update their last-notified timestamp.

- [ ] **Step 1: Add the helpers to the end of `src/lib/supabase/queries/notifications.ts`**

```typescript
// ── Chat notification throttle ────────────────────────────────────────────────

export type JobChatState = {
  last_seen_at:     string | null
  last_notified_at: string | null
}

export async function getJobChatState(
  jobId:  string,
  userId: string,
): Promise<JobChatState | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('job_chat_state')
    .select('last_seen_at, last_notified_at')
    .eq('job_id', jobId)
    .eq('user_id', userId)
    .maybeSingle()
  return data as JobChatState | null
}

// Count messages in this job that were sent by someone other than recipient,
// after the most recent of their last_seen_at or last_notified_at.
// Returns 0 if no qualifying messages.
export async function countUnseenMessages(
  jobId:       string,
  recipientId: string,
  state:       JobChatState | null,
): Promise<number> {
  const supabase = createServiceClient()
  const since = state?.last_seen_at ?? state?.last_notified_at ?? null

  let query = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .neq('author_id', recipientId)

  if (since) query = query.gt('created_at', since)

  const { count } = await query
  return count ?? 0
}

export async function upsertJobChatNotified(
  jobId:  string,
  userId: string,
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('job_chat_state')
    .upsert(
      { job_id: jobId, user_id: userId, last_notified_at: new Date().toISOString() },
      { onConflict: 'job_id,user_id' },
    )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/queries/notifications.ts
git commit -m "feat: add job chat state query helpers for notification throttle"
```

---

## Task 5: Create chat-read API route

**Files:**
- Create: `src/app/api/jobs/[id]/chat-read/route.ts`

Called from `ChatSection` on mount. Upserts `last_seen_at = now()` for the current user on this job.

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  await service
    .from('job_chat_state')
    .upsert(
      { job_id: jobId, user_id: profile.id, last_seen_at: new Date().toISOString() },
      { onConflict: 'job_id,user_id' },
    )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/jobs/[id]/chat-read/route.ts
git commit -m "feat: add chat-read API route to update last_seen_at"
```

---

## Task 6: Replace notification logic in messages route

**Files:**
- Modify: `src/app/api/jobs/[id]/messages/route.ts`

This is the main change. Replace the fire-on-every-message `notifyParticipants` helper with a throttled version that respects the 5-minute window and sends the batched count template.

- [ ] **Step 1: Update the imports at the top of `src/app/api/jobs/[id]/messages/route.ts`**

Replace:
```typescript
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobMessage, tplJobVoiceNote } from '@/lib/telegram/templates'
```

With:
```typescript
import { sendTelegramWithKeyboard } from '@/lib/telegram/bot'
import { tplJobChatBatch } from '@/lib/telegram/templates'
import {
  getJobChatState,
  countUnseenMessages,
  upsertJobChatNotified,
} from '@/lib/supabase/queries/notifications'
```

- [ ] **Step 2: Replace the `notifyParticipants` helper function**

Remove the old `notifyParticipants` function (lines 57–64 in the original):
```typescript
// ── Telegram helpers ──────────────────────────────────────────────────────
async function notifyParticipants(tgMessage: string) {
  const { salesPoc, installers } = await getJobRecipients(jobId)
  const recipients = [salesPoc, ...installers].filter(
    (r): r is NonNullable<typeof r> =>
      r !== null && r.id !== authorId && r.telegram_chat_id !== null,
  )
  await Promise.all(recipients.map(r => sendTelegram(r.telegram_chat_id!, tgMessage)))
}
```

Replace with:
```typescript
// ── Telegram helpers ──────────────────────────────────────────────────────
const THROTTLE_MS = 5 * 60 * 1000

async function notifyParticipantsThrottled(isAttachment = false) {
  if (!notifData) return
  const { salesPoc, installers } = await getJobRecipients(jobId)
  const recipients = [salesPoc, ...installers].filter(
    (r): r is NonNullable<typeof r> =>
      r !== null && r.id !== authorId && r.telegram_chat_id !== null,
  )

  await Promise.all(recipients.map(async r => {
    const state       = await getJobChatState(jobId, r.id)
    const lastMs      = state?.last_notified_at ? new Date(state.last_notified_at).getTime() : 0
    if (Date.now() - lastMs < THROTTLE_MS) return

    const unseenInDb  = await countUnseenMessages(jobId, r.id, state)
    // Text/voice messages are already in DB when this runs.
    // Attachments are not inserted into the messages table, so add 1 manually.
    const count       = unseenInDb + (isAttachment ? 1 : 0)

    const text = tplJobChatBatch({
      count,
      projectTitle: notifData!.project_title,
      jobClient:    notifData!.client,
      jobDate:      notifData!.date,
      timeStart:    notifData!.time_start,
      timeEnd:      notifData!.time_end,
      location:     notifData!.location,
    })

    await sendTelegramWithKeyboard(
      r.telegram_chat_id!,
      text,
      [[{ text: 'View in app →', url: jobUrl }]],
    )
    await upsertJobChatNotified(jobId, r.id)
  }))
}
```

- [ ] **Step 3: Update the three handler blocks to call the new helper**

In the voice note block, replace:
```typescript
if (notifData) {
  await notifyParticipants(tplJobVoiceNote({
    projectTitle: notifData.project_title,
    jobClient:    notifData.client,
    pocName:      notifData.client_poc_name,
    pocPhone:     notifData.client_poc_phone,
    jobDate:      notifData.date,
    authorName,
    sentAt:       sgtTimeNow(),
    jobUrl,
  }))
}
```
With:
```typescript
await notifyParticipantsThrottled()
```

In the attachment block, replace:
```typescript
if (notifData) {
  await notifyParticipants(tplJobMessage({
    projectTitle: notifData.project_title,
    jobClient:    notifData.client,
    pocName:      notifData.client_poc_name,
    pocPhone:     notifData.client_poc_phone,
    jobDate:      notifData.date,
    authorName,
    sentAt:       sgtTimeNow(),
    preview:      `📎 ${filename}`,
    jobUrl,
  }))
}
```
With:
```typescript
await notifyParticipantsThrottled(true)
```

In the text message block, replace:
```typescript
if (notifData) {
  await notifyParticipants(tplJobMessage({
    projectTitle: notifData.project_title,
    jobClient:    notifData.client,
    pocName:      notifData.client_poc_name,
    pocPhone:     notifData.client_poc_phone,
    jobDate:      notifData.date,
    authorName,
    sentAt:       sgtTimeNow(),
    preview:      content.slice(0, 100),
    jobUrl,
  }))
}
```
With:
```typescript
await notifyParticipantsThrottled()
```

- [ ] **Step 4: Remove the now-unused `sgtTimeNow` function and `authorName` variable**

Delete the `sgtTimeNow` function (lines 11–15 in the original) since no caller uses it anymore:
```typescript
function sgtTimeNow(): string {
  return new Date().toLocaleTimeString('en-SG', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore',
  })
}
```

Also update the profile destructure to remove `authorName` (no longer used by the new template):
```typescript
// Before
const { id: authorId, name: authorName } = profile

// After
const { id: authorId } = profile
```

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see "unused variable authorName" — check that the text/voice path still uses it. `authorName` is used for `insertMessage` / `insertVoiceMessage` calls, so it should remain.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/jobs/[id]/messages/route.ts
git commit -m "feat: throttle job chat telegram notifications to once per 5 min with unseen count"
```

---

## Task 7: Mark chat as read when user opens it

**Files:**
- Modify: `src/features/job-detail/ChatSection.tsx`

⚠️ **Before touching this file:** Run `git status` and `git diff src/features/job-detail/ChatSection.tsx`. If the other agent has modified it, flag to Nic before continuing.

Add a fire-and-forget `useEffect` that calls `POST /api/jobs/[id]/chat-read` when the component mounts (i.e. when the user opens the job chat).

- [ ] **Step 1: Check for conflicts**

```bash
git diff src/features/job-detail/ChatSection.tsx
```

Expected: no output (file not touched by other agent). The other agent is modifying `CoreSection.tsx`, not `ChatSection.tsx`. If you do see changes, stop and flag to Nic.

- [ ] **Step 2: Add the useEffect after the chatLocked useEffect (around line 407)**

Find this block:
```typescript
  // Evaluated client-side only — avoids server/client timezone mismatch (hydration error)
  useEffect(() => {
    if (cutoff) setChatLocked(new Date() > cutoff)
  }, [cutoff])
```

Add the new useEffect immediately after it:
```typescript
  useEffect(() => {
    fetch(`/api/jobs/${jobId}/chat-read`, { method: 'POST' }).catch(() => {})
  }, [jobId])
```

The `.catch(() => {})` swallows any network errors silently — this is intentional. A failed read-receipt update should never interrupt the user's chat experience.

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/job-detail/ChatSection.tsx
git commit -m "feat: call chat-read on mount to track last_seen_at for notification throttle"
```

---

## Task 8: Final verification

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build completes with no errors. Warnings about `any` or unused vars from pre-existing code are acceptable as long as the build succeeds.

- [ ] **Step 3: Manual smoke test (in Vercel preview after deploy)**

1. Open a job chat as User A. The `chat-read` route fires on mount — confirm in Supabase Table Editor that a row appears in `job_chat_state` with `last_seen_at` set.
2. From a second account (User B), send a message in the same chat. Confirm in Telegram that User A receives one notification in the new format:
   ```
   💬 You have 1 New Message
   Project Title
   Client: ...
   Time: ...
   📍 Location
   Date: ...
   [View in app →]
   ```
3. From User B, send 5 more messages rapidly. Confirm no additional Telegram notifications arrive for User A within 5 minutes.
4. Wait 5+ minutes, send another message from User B. Confirm User A gets one more notification with an updated count (should reflect all messages since User A last opened the chat).
5. Tap "View in app →" on the Telegram notification — confirm it opens in Safari/Chrome, not in Telegram's built-in browser.
