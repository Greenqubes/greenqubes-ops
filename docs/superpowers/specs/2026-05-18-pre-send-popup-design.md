# Pre-Send Popup — Design Spec
_2026-05-18_

## Summary

Add two pieces of information to the existing `WorkloadPreviewModal` that appears when sales clicks "Submit for Approval": the name of the scheduler(s) who will receive the submission, and a "busier than usual" warning when the selected date already has 5 or more jobs.

---

## Context

The `WorkloadPreviewModal` already opens before submission and shows a 7-day job-count calendar. The scheduler name and busy indicator are not currently shown. This spec adds both without changing the modal's structure or the surrounding flow.

---

## Changes

**File:** `src/features/approvals/WorkloadPreviewModal.tsx` — only file touched.

### 1. Scheduler name fetch

On mount, query Supabase for all users with `role = 'scheduler'` and store their names in state. Uses the existing `createClient()` pattern already in the file. If only one scheduler, show their name. If multiple, join with commas.

### 2. Scheduler banner

Always visible. Placed between the modal title and the busy warning (i.e., below the heading block, above the calendar).

Layout: blue circle avatar showing initials + label "Sending to scheduler" (small, muted, uppercase) + name below it in ink.

Matches the design of Option A chosen during brainstorm.

### 3. Busy warning

Amber banner. Appears only when the currently selected date has `jobCount >= BUSY_THRESHOLD`. Disappears automatically if the user switches to a less-loaded date.

`BUSY_THRESHOLD = 5` defined as a const at the top of the file.

Wording: `⚠ [N] jobs already on this day — busier than usual`

Placed between the scheduler banner and the week navigation row.

---

## Layout order (top to bottom inside modal)

1. Modal title + subtitle (existing)
2. Scheduler banner (new — always visible)
3. Busy warning (new — conditional on selected date jobCount ≥ 5)
4. Week navigation arrows (existing)
5. 7-day grid (existing)
6. Helper hint text (existing)
7. Cancel / Submit buttons (existing)

---

## Data

- Scheduler names: fetched from `users` table, `role = 'scheduler'`, columns `id` + `name`. Fetched once on mount.
- Busy threshold: `BUSY_THRESHOLD = 5` (const, easy to change).
- Job counts per day: already fetched by the modal's existing `fetchWorkload()` function — no new query needed.

---

## What is not changing

- The existing workload fetch logic
- The date-switching behaviour
- The confirm/cancel flow
- `JobDetailShell.tsx` — no prop changes needed
- Any API routes

---

## Out of scope

- Making `BUSY_THRESHOLD` configurable via admin settings (future)
- Showing scheduler availability or online status
- Any change to the week/month calendar views
