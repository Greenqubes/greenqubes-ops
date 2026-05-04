# Session 17.2 — Calendar navigation + live schedule

_Done: 2026-05-05_

---

## Bugs fixed

### 1. List view left arrow goes back 2 days / right arrow stays on same day

**Root cause:** `toISO()` in `src/features/schedule/utils.ts` was using `d.toISOString()` which converts to UTC before formatting. In Singapore (UTC+8), local midnight is UTC-8h (previous day 16:00). So every date operation returned yesterday's date — going back 1 day showed as going back 2, going forward 1 day stayed on the same day.

**Fix:** Rewrote `toISO()` to use local date components (`getFullYear`, `getMonth`, `getDate`) instead of UTC string conversion. Fixes all three navigation bugs (list left, list right, month right) since they all call `shiftDate` / `shiftMonth` which both call `toISO`.

**File:** `src/features/schedule/utils.ts`

---

### 2. Month view right arrow doesn't advance to next month

Same root cause as above — `shiftMonth` calls `toISO` at the end, returning the wrong UTC date. Fixed by the same `toISO` change.

---

### 3. Schedule doesn't update live when a job is pushed to scheduled

**Root cause:** The schedule page is a server component. Job data was only fetched on page load — no realtime subscription existed for the jobs table itself.

**Fix (two parts):**

**Part A — Migration `0010_realtime_jobs.sql`:**
- Added `jobs` table to the `supabase_realtime` publication
- Replaced the two old SECURITY DEFINER-based SELECT policies on `jobs` with a single direct `auth.uid()` subquery policy (same pattern as the messages/files fix in 0008 — required for Supabase Realtime to evaluate RLS correctly)

**Part B — `ScheduleShell.tsx`:**
- Added `useRouter` from `next/navigation`
- New `useEffect` subscribes to `postgres_changes` (`event: '*'`) on the `jobs` table
- On any event, calls `router.refresh()` — this triggers a server-side re-render of the schedule page, pulling fresh job data without losing any client state (selected date, view mode, filters)
- Subscription runs for all roles, not just scheduler

**Files changed:**
- `supabase/migrations/0010_realtime_jobs.sql` (new)
- `src/features/schedule/ScheduleShell.tsx`
- `src/features/schedule/utils.ts`

---

## How live schedule works now

1. Scheduler approves a job → status changes to `scheduled` in DB
2. Supabase Realtime delivers a `jobs UPDATE` event to all connected clients
3. `ScheduleShell` receives the event and calls `router.refresh()`
4. Next.js re-fetches the schedule server data and re-renders the job list
5. New job appears on screen within ~1 second — no manual refresh needed

---

## What's next

Session 18 — full design review (visual pass against `docs/greenqubes-phase0.jsx`).
