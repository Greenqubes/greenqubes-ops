---
session: feat-schedule (Revert completed jobs + bulk actions + card team lines)
date: 2026-08-24
branch: dev → main (merged same day, verified by Nic on the preview first)
---

# Revert Completed Jobs + Bulk Actions + Card Team Lines — DONE

> Nic's ask: accidental completions need an undo. Every role except installer
> can now revert a completed job back to the schedule. The session then grew
> three sibling features from Nic's screenshots: bulk Complete/Revert on the
> list selection bars, Installer/Sales/Coordinator lines on the list + bell
> cards, and honest Telegram headers on installer-assignment notifications.

## 1 — Revert a completed job (all roles except installer)

- **Button**: "Revert to Scheduled" (RotateCcw icon) in the completed job's
  sticky bottom bar, next to Duplicate/Cancel. Confirm modal (z-[60], above
  the bottom nav per the hard rule). On confirm: success toast +
  `router.refresh()` — the form unlocks without a manual reload.
- **Route**: `POST /api/jobs/[id]/revert-complete` — needed because jobs RLS
  blocks sales (own pending only) and designer (no UPDATE) from touching
  completed rows. Auth → profile → `getEffectiveRole` (preview-as applies) →
  reject installers → service client does the work. **No migration.**
- Sets `status='scheduled'`, clears `completed_at`, then **restores the
  original `scheduled_at` with a second update** — the 0038 trigger re-stamps
  the FCFS rank on any transition into `scheduled`, and an undo must not send
  the job to the back of the queue. (The second update doesn't touch `status`,
  so the trigger stays quiet.) Idempotent: already-scheduled → ok; other
  statuses → 409.
- **No Telegram on revert** (Nic's call — quiet undo; live updates already
  refresh everyone's screens).
- i18n: `revertJob`, `revertJobConfirmTitle`, `revertJobConfirmBody` in
  en + zh only (Bengali frozen — falls back to English).

## 2 — Bulk actions on the list selection bars (scheduler)

`ScheduleShell`'s selection bar (checkboxes are scheduler-only outside the
pending page) gained per-page actions with the same inline confirm step as
Delete (`confirmBulk` is now `'delete' | 'revert' | 'complete' | false`):

- **Completed tab → "Revert N"** (amber) — calls the revert route per job.
- **Schedule tab → "Complete N"** (green `--green`) — plain client-side
  update (`status='completed'` + `completed_at`), same as the job page's
  Mark job complete; scheduler/admin RLS allows it.

## 3 — Team lines on list cards + overdue bell cards

- **Schedule/pending/completed cards** (`JobRow`): new bottom row —
  `Installer: <full names>` on the left; a box on the right with
  `Sales: <name>` / `Coordinator: <names>` whose text is **left-aligned so
  both labels start at the same edge** (Nic's mockup). Anything empty shows
  **NIL**. The old first-names-with-icon in the meta row now renders only on
  installer views to avoid duplication.
- **Data**: `SCHEDULE_SELECT` gained `sales_poc_id` +
  `job_coordinators(users(name))`; sales POC names come from a follow-up
  `users` query (`attachSalesNames`) — **never embed users onto jobs** in a
  PostgREST select (standing rule, broken twice before).
- **Installer views untouched**: they feed `InstallerJob` rows (no team
  fields) into `JobRow`, and the team row renders only when the fields are
  present (`hasTeamInfo` guard; the new ScheduleJob fields are optional).
- **Bell overdue cards** (`NotificationDrawer`): `Sales:` + `Coordinator:`
  lines under the address, NIL fallback, always shown. Coordinator names ride
  the existing job_coordinators select; sales name via the follow-up query.

## 4 — Telegram installer-assignment header

`tplInstallerAssigned` (sent to sales POC + coordinators from the
assign-installers route — job form Save & notify AND the FCFS panel) now
takes a `kind` computed from the before/after assignee sets:

| Situation | Header |
|---|---|
| team was empty → now assigned (or unchanged team re-notified) | ✅ Installer Assigned |
| existing team modified, ≥1 still assigned (swap/add/remove) | ❗ Installer Changed |
| last installer removed, team now empty | ❌ Installer Removed |

Body unchanged (`Assigned to: (none)` still shows on removal).

## Nic's decisions this session

- Revert scope: **all roles except installer** (incl. designer/production).
- **No notification** on revert.
- Card team lines exactly per his mockups; **NIL** for empty; left-aligned
  label box; also applied to the bell cards.
- AI importance-scoring question skipped this session (his call at start).

## Key files

| File | Change |
|---|---|
| `src/app/api/jobs/[id]/revert-complete/route.ts` | new revert route (service client, rank restore) |
| `src/features/job-detail/JobDetailShell.tsx` | Revert button + confirm modal + handler |
| `src/features/schedule/ScheduleShell.tsx` | bulk Revert/Complete on the selection bar |
| `src/features/schedule/JobRow.tsx` | Installer/Sales/Coordinator team row |
| `src/lib/supabase/queries/jobs.ts` | team fields in SCHEDULE_SELECT + attachSalesNames |
| `src/features/notifications/NotificationDrawer.tsx` | Sales/Coordinator lines on overdue cards |
| `src/lib/telegram/templates.ts` | tplInstallerAssigned `kind` headers |
| `src/app/api/jobs/[id]/assign-installers/route.ts` | computes assigned/changed/removed |
| `src/lib/i18n/en.ts`, `zh.ts` | revert keys (en+zh only) |

## Facts worth keeping

- The 0038 `stamp_scheduled_at` trigger fires on `UPDATE OF status` only — a
  follow-up update that touches other columns can restore `scheduled_at`
  without waking it.
- `JobRow` is shared with installer week/month views via an
  `InstallerJob → ScheduleJob` cast — any new ScheduleJob field must be
  optional with a runtime guard, or installer views break/leak office info.
- Preview CAN send outgoing Telegram notifications (only incoming webhooks —
  votes, /start — are pinned to production).

## ⚠️ Notes for next session

- Session started with the previous session's docs uncommitted; another open
  window committed them (6afa550) mid-session — the parallel-worktree rule
  exists for this.
- Checklist item "Collect Telegram chat IDs" (Before Go-Live) predates the
  self-service Connect Telegram button — could be reworded/closed when Nic
  next grooms the list.
