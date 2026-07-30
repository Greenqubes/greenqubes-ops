---
session: fix-schedule
date: 2026-06-11
branch: dev / feat-workflow-v2
---

# fix-schedule — Vercel 404 Fix + Schedule Date Strip + Plan Update

## What was done

### 1. Vercel 404 fix — Workflow V2 mockups

HTML mockups were pushed to `docs/superpowers/mockups/workflow-v2/` in the previous session but returned 404 on Vercel. Root cause: Vercel's Next.js app only serves static files from `public/` — the `docs/` folder is not served.

Fix: copied all 15 HTML files to `public/mockups/workflow-v2/`. Mockups now accessible at:
`[preview-url]/mockups/workflow-v2/index.html`

Files moved:
- clash-modal.html, external-installer-link.html, external-poc-bucket.html
- fcfs-board.html, fcfs-clash-detail.html, fcfs-timeline-v2.html, fcfs-timeline.html, fcfs-updated.html
- index.html, installer-panel.html, job-form-roles.html, overview.html
- schedule-job-card.html, sub-installer-section.html, task-list-section.html

### 2. Schedule list view — full date range carousel

**File:** `src/features/schedule/ScheduleShell.tsx`

The `dates` array (fed to ListView's horizontal date strip) was previously built from `Object.keys(jobsByDate)` — only dates that had assigned jobs appeared. Empty days between jobs were invisible.

Changed to generate a full continuous date range from the earliest job date to the latest, filling in every day regardless of whether jobs exist on that day. If no jobs exist, defaults to showing just today.

```typescript
const dates = useMemo(() => {
  const jobDates = Object.keys(jobsByDate).sort()
  if (jobDates.length === 0) return [today]
  const start = jobDates[0] < today ? jobDates[0] : today
  const end   = jobDates[jobDates.length - 1] > today ? jobDates[jobDates.length - 1] : today
  const result: string[] = []
  let cur = start
  while (cur <= end) {
    result.push(cur)
    cur = shiftDate(cur, 1)
  }
  return result
}, [jobsByDate, today])
```

The strip was already `overflow-x-auto scrollbar-none` — scrollable on mobile. No auto-scroll added (user scrolls manually).

### 3. feat-workflow-v2 branch

Branch already existed locally from a previous session. Merged dev in (bringing it up to date with all recent commits) and pushed to remote. Vercel automatically generates a separate preview URL for this branch.

All Workflow V2 implementation work goes on `feat-workflow-v2`. When done and tested, merge into `dev` → confirm → merge into `main`.

### 4. Implementation plan updated

**File:** `docs/superpowers/plans/2026-06-05-workflow-v2.md`

Several design decisions made during the visual mockup review were not reflected in the plan written on 2026-06-05. Updated to fix all gaps:

**Phase 3 — FCFS clash detection:**
- Added `punctuality: 'strict' | 'flexible'` to `FCFSJob` interface and DB query
- `ClashType = 'hard' | 'soft'` added to `Clash` interface
- `getClashType()` function: strict+strict → `'hard'`, flex+flex → `null` (no clash), one of each → `'soft'`
- `JobBlock` updated: hard = bright red border/bg, soft = amber dashed border, none = default
- FCFS board shows two separate banners: red for hard clashes, amber for soft warnings

**Phase 4 — External installer (major rewrite):**
- Old: `installer_temp_links` table — one 48hr link per job
- New: `external_contacts` table (name, phone, token, deleted_at) + `job_external_contacts` join table — one persistent link per person, all jobs on one homepage
- Old: `/external/[token]` — single job view, shows "expired" after 48hr
- New: `/ext/[token]` — jobs homepage (pending Accept/Decline, upcoming, past), job detail view, "link no longer active" state (only when coordinator soft-deletes the contact)
- Delete: sets `deleted_at = now()` → link immediately invalid
- Restore: clears `deleted_at` → same token works again, all job history intact
- API: `POST /api/external-contacts` (create), `DELETE /api/external-contacts/[id]` (soft delete), `PATCH /api/external-contacts/[id]` (restore), `POST /api/jobs/[id]/external-contacts` (assign to job), `GET /api/ext/[token]` (public homepage data), `POST /api/ext/[token]/respond` (accept/decline)
- Old Task 25: `job_external_installers` table with text fields per team
- New Task 25: `ExternalPOCBucket` component — uses `external_contacts` DB, shows existing contacts with past job count, Assign button, delete confirmation (warns N active jobs affected), restore confirmation (explains same token reactivated), add new contact inline

## Key decisions confirmed this session

- Vercel serves static files from `public/` only — mockups and similar static HTML must live there
- Schedule date strip: show all dates in range (not just job dates)
- feat-workflow-v2 is the implementation branch; dev stays stable
- External installer = persistent per-person link (not per-job 48hr link)
- Clash type is driven by `punctuality` field: strict+strict = must resolve, flex+flex = ignore

## Files changed

| File | Change |
|---|---|
| `public/mockups/workflow-v2/*.html` | 15 new files (moved from docs/) |
| `src/features/schedule/ScheduleShell.tsx` | Date strip fills full range |
| `docs/superpowers/plans/2026-06-05-workflow-v2.md` | Phase 3+4 updated to match approved mockups |
| `docs/plan.md` | Session entry added |
| `docs/context.md` | Last updated line |
| `docs/nic-checklist.md` | Done this session items added |

## Next session

Start Phase 1 of the Workflow V2 implementation plan on `feat-workflow-v2`:
- Task 1: DB migration 0033 (designer/coordinator/production roles + installer suggestion columns)
- Task 2: Auth callback routing for new roles
- Task 3: Admin UI role dropdown
- Task 4: Remove approval workflow (API routes)
- Task 5: Remove approval workflow (UI)
- Task 6: Update BottomNav per role
- Task 7: Redirect /approvals → /schedule
- Task 8: Phase 1 integration check + deploy
