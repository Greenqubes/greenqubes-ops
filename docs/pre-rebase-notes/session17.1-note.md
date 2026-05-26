# Session 17.1 — Live-chat bug fix

_Done: 2026-05-04_

---

## What was fixed

### 1. Job chat realtime — Option B (proper RLS fix)

**Root cause:** Supabase Realtime runs in a separate Postgres session. The existing `messages` and `files` SELECT policies used `get_my_role()` and `get_my_id()` — SECURITY DEFINER functions that call `auth.uid()` internally. In the Realtime session, these functions silently fail, so every event was dropped before delivery. The WebSocket connection showed as open but nothing arrived.

**Fix:** New migration `0008_realtime_rls.sql` drops the four broken policies and replaces them with two combined policies that query `auth.uid()` directly via subjoins on the `users` table — no SECURITY DEFINER wrapper.

| Old policy | New policy |
|---|---|
| `messages: sales and scheduler see all` | dropped |
| `messages: installer sees thread on assigned jobs` | dropped |
| — | `messages: select by role or assignment` |
| `files: sales and scheduler see all` | dropped |
| `files: installer sees files on assigned jobs` | dropped |
| — | `files: select by role or assignment` |

Access semantics are identical: sales/scheduler see all, installer sees only records on assigned jobs. The difference is the evaluation path — direct `auth.uid()` subquery instead of SECURITY DEFINER function.

**Files changed:**
- `supabase/migrations/0008_realtime_rls.sql` (new)

### 2. Favicon

**Fix:** `src/app/icon.tsx` — Next.js App Router dynamic icon (32×32, terracotta `#B5523D`, white "G"). Served at `/favicon.ico` automatically. No more 404 on every page load.

**Files changed:**
- `src/app/icon.tsx` (new)

---

## Deployment steps

1. `npx supabase db push` — already applied (migration 0008) ✓
2. Push to GitHub → Vercel auto-deploys
3. Test: open a job, open chat in two browser tabs (or two users), send a message — it should appear live in the other tab without refresh

---

## What's next

Session 18 — full design review (visual pass against `docs/greenqubes-phase0.jsx`).
