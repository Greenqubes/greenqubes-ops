# Session 17 (continued) — Live chat realtime debugging

> This note covers post-deploy debugging done in the same sitting as Session 17.

_Done: 2026-05-04_

---

## What works

- Vercel deploy live at **https://greenqubes-ops.vercel.app** ✓
- Google OAuth login ✓
- All pages load (schedule, approvals, assistant, admin, installer) ✓
- DB migrations 0004–0007 applied via `npx supabase db push` ✓
- Telegram webhook re-pointed to Vercel URL ✓
- Telegram notifications fire (tested: job chat message → Telegram ping) ✓
- Job chat messages save correctly (API route works, DB write confirmed) ✓
- Admin Users tab — Telegram Chat ID field works ✓
- Your Telegram Chat ID added to your user record ✓

---

## Known bug — job chat realtime not working

Messages save and Telegram fires, but the chat UI does not update live. A page refresh is required to see new messages.

### What was tried

| Step | Result |
|---|---|
| Added `messages` + `files` to `supabase_realtime` publication | WebSocket now connects |
| Set `REPLICA IDENTITY FULL` on `messages` + `files` | No change |
| Fixed React hydration error (chatLocked in useEffect, explicit SGT locale) | Hydration error gone, WebSocket connects |
| Removed server-side filter — `job_id` filtered client-side instead | No change |

### Current state

- WebSocket connection: **established** (visible in DevTools → Network → WS, status "pending" = open)
- Events delivered: **none**

### Most likely root cause

The Supabase Realtime engine checks RLS policies before delivering events. The `messages` SELECT policies use custom functions `get_my_role()` and `get_my_id()` which call `auth.uid()` internally. These functions may not execute correctly in the Supabase Realtime context (separate Postgres session from the API layer), causing the RLS check to silently fail and drop events.

### Recommended fix for Session 18

Two options:

**Option A — Optimistic updates (quick):**
After `handleSend` succeeds, immediately append the message to local state without waiting for the realtime event. The user always sees their own message instantly. Realtime only needs to deliver messages from other users (less critical path).

```ts
// In handleSend, after successful POST:
setMessages(prev => [...prev, { id: crypto.randomUUID(), job_id: jobId, author_id: userId, kind: 'text', content: trimmed, voice_url: null, ts: new Date().toISOString(), author: null }])
```

**Option B — Simplify RLS for realtime (proper fix):**
Add a direct policy that doesn't rely on custom functions:
```sql
-- Participants (assigned installers + sales/scheduler) can subscribe via realtime
CREATE POLICY "messages: realtime select by participant"
  ON messages FOR SELECT TO authenticated
  USING (
    auth.uid() IN (
      SELECT u.auth_id FROM users u
      JOIN job_assignees ja ON ja.user_id = u.id
      WHERE ja.job_id = messages.job_id
      UNION
      SELECT u.auth_id FROM users u WHERE u.role IN ('sales', 'scheduler')
    )
  );
```

Option A is a safe immediate fix. Option B is the correct long-term fix. Both should be done in Session 18.

---

## Other items to address in Session 18

- Add favicon.ico (currently 404s on every load — harmless but noisy)
- Full design review against `docs/greenqubes-phase0.jsx`
