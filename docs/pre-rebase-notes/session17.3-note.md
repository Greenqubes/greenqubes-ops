# Session 17.3 — Schedule live refresh + hydration crash (force reverted)

_Done: 2026-05-05_

> **This session was force-reverted to the state at `a3b365a` (start of conversation).**
> The hydration fixes did not resolve the error in production even after SSR was disabled for ScheduleShell.
> Notes kept for reference in case the issue resurfaces.

---

## What was attempted

### Bug 1 — Schedule live refresh not working

**Root cause:** `jobs` table missing `REPLICA IDENTITY FULL` — Postgres only sends primary key in UPDATE events, Realtime drops them. RLS JOIN also too complex for Realtime engine.

**Fixes that were kept after revert:**
- Migration `0011_jobs_replica_identity.sql` — `ALTER TABLE jobs REPLICA IDENTITY FULL` (already applied to DB, kept in code)
- 2-minute polling fallback in `ScheduleShell` — `setInterval(() => router.refresh(), 2 * 60 * 1000)`. Preserves all React state (selected date, view, filters). Kept after revert.

### Bug 2 — React hydration error #418 crashing schedule on every fresh load

**Root cause:** Multiple `new Date()` calls at render time — server (UTC) and client (SGT +8) produced different dates, causing HTML mismatch.

**Fixes attempted (all reverted — did not resolve in production):**
1. `ScheduleShell` — moved `today` to `useState(serverToday)` passed from server
2. `NotificationDrawer` — moved `isOverdueNow` from `useMemo` to `useEffect`
3. `JobRow` — changed `isOverdue()` to accept `today` as param instead of calling `new Date()`
4. All schedule components — replaced `toLocaleDateString` with hardcoded English formatters
5. Disabled SSR for `ScheduleShell` via `dynamic(..., { ssr: false })` — error persisted even with this

**Outcome:** Error persisted in production despite SSR being fully disabled (which should have made hydration impossible). Root cause not conclusively identified. Reverted to clean state. Hydration error is a console warning only — the page still loads after a manual refresh. To be revisited if it becomes blocking.

---

## What was kept after revert

- `supabase/migrations/0011_jobs_replica_identity.sql`
- 2-min polling in `ScheduleShell.tsx`
- This note

---

## Going into Session 18

- Schedule page polls every 2 minutes — updates appear silently without disrupting user state
- Hydration error (#418) still present in console but not blocking Session 18 design review
- Session 18 is the full visual design review against `docs/greenqubes-phase0.jsx`
