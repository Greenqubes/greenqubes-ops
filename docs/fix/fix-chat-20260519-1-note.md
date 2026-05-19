# fix-chat — 2026-05-19

## What was fixed

### Job chat realtime — root causes and fixes

Three separate root causes were found and fixed. Realtime now works for all roles (admin, sales, scheduler, installer).

---

#### 1. Supabase client recreated on every render (`useMemo` fix)

**Root cause:** `createClient()` calls `createBrowserClient` which returns a **new instance on every call** (confirmed empirically — not a singleton). `supabase` was declared in the component body and included in the `useEffect` dependency array, so every render (e.g. user typing) tore down and rebuilt the realtime channel. The async reconnection window meant messages from other users were consistently dropped.

**Fix:** Wrapped `createClient()` in `useMemo(() => createClient(), [])` so the client is stable for the component lifetime.

**File:** `src/features/job-detail/ChatSection.tsx`

---

#### 2. Admin role missing from the auth.uid()-based RLS SELECT policy (migration 0023)

**Root cause:** Migration 0008 created a realtime-compatible SELECT policy using `auth.uid()` for `sales` and `scheduler`. Migration 0019 added `admin` but only via a `get_my_role()` policy — which silently returns null in Supabase Realtime's Postgres session. So admin users' events were dropped by the server before delivery.

**Fix:** Migration 0023 — updated the `auth.uid()`-based SELECT policy on `messages` and `files` to include `admin`.

**File:** `supabase/migrations/0023_realtime_rls_admin.sql`

---

#### 3. RLS policies rewritten as EXISTS subqueries (migration 0024)

**Root cause:** The `IN (SELECT ... UNION ...)` pattern in the auth.uid()-based policies was not reliably evaluated by Supabase Realtime for non-admin users (sales/scheduler). Events showed SUBSCRIBED status but were silently dropped.

**Fix:** Migration 0024 — replaced the single UNION policy with two separate `EXISTS`-based policies (one for role-based access, one for installer assignment). `EXISTS` is the standard Supabase RLS pattern.

**File:** `supabase/migrations/0024_realtime_rls_exists.sql`

---

#### 4. JWT not wired to the realtime connection

**Root cause:** `@supabase/ssr`'s `createBrowserClient` does not automatically pass the user's session JWT to the Supabase Realtime WebSocket connection. Without the JWT, Supabase Realtime evaluates RLS as anonymous and drops all events. The subscription shows SUBSCRIBED (WebSocket connected) but no events are delivered.

**Fix:** In the `useEffect`, call `supabase.auth.getSession()` first, then `supabase.realtime.setAuth(session.access_token)` before creating the channel. Also added a server-side `filter: job_id=eq.${jobId}` on the subscription to reduce unnecessary event traffic.

**File:** `src/features/job-detail/ChatSection.tsx`

---

#### 5. Avatar/name missing on incoming realtime messages

**Root cause:** Realtime payloads are raw DB rows — no joined `users` data. Own messages were already handled (name injected from props), but others' messages had no name, showing `?` avatar and "Unknown".

**Fix:** Added a `nameCacheRef` seeded from `initialMessages` (which do have joined names from the server-side load). When a message arrives from a sender not in the cache, add it immediately and fetch their name from `users` async, then patch the message in state.

**File:** `src/features/job-detail/ChatSection.tsx`

---

## Key files changed

| File | Change |
|---|---|
| `src/features/job-detail/ChatSection.tsx` | useMemo client, explicit JWT auth, name cache, server-side filter |
| `supabase/migrations/0023_realtime_rls_admin.sql` | Add admin to auth.uid() SELECT policy |
| `supabase/migrations/0024_realtime_rls_exists.sql` | Rewrite SELECT policies as EXISTS subqueries |

---

## Next session

- Chat: thumbnails for all attachments (voice notes + file attachments) in the job chat thread
