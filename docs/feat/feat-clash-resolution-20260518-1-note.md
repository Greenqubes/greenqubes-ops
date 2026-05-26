# feat-clash-resolution — 2026-05-18

## What was built

Full pre-send clash resolution system to replace the old WorkloadPreviewModal, plus a set of time-picker and form fixes discovered during testing.

---

## Key changes

### New API routes

| Route | What it does |
|---|---|
| `GET /api/jobs/[id]/clashes` | Detects installer double-bookings and back-to-back jobs for a given job; returns clashes, travel warnings, substitutes with free/busy status, and weekly workload data |
| `DELETE /api/jobs/[id]` | Hard-deletes a pending job (sales only); cascade handles assignees, files, messages |
| `GET /api/workload?weekStart=YYYY-MM-DD` | Returns 7-day installer workload breakdown for week navigation in the chart |

### New / replaced components

| File | What it does |
|---|---|
| `src/features/approvals/ClashResolutionModal.tsx` | Full-screen modal: clash cards with substitute selection, free/busy badges, keep-anyway flow, time-shift pickers, travel-time amber banner, team workload chart |
| `src/features/approvals/WeekWorkloadChart.tsx` | 5-level bar chart (grey→green→amber→orange→terracotta, every 2 jobs = +1 level); prev/next week navigation; interactive installer panel (day detail or weekly overview) |

### Modified files

- `src/features/job-detail/JobDetailShell.tsx` — replaced WorkloadPreviewModal with ClashResolutionModal; added auto-save before clash check (so edited times are persisted and detected correctly); added delete confirmation modal; added `handleSendToScheduler` and `handlePushAnyways` handlers
- `src/features/job-detail/StatusSection.tsx` — added Delete Job button (sales, pending only)
- `src/features/job-detail/AssigneeSection.tsx` — sales can now assign installers on pending jobs (was scheduler-only)
- `src/features/job-detail/TimeSelect.tsx` — rolling dropdown starting from current time; HH:MM:SS → HH:MM normalisation fix (DB returns seconds, dropdown options are HH:MM)
- `src/app/jobs/[id]/page.tsx` — use `getEffectiveRole()` so admin+role-switcher sees correct UI
- `src/app/api/jobs/[id]/submit/route.ts` — use `getEffectiveRole()` so admin+role-switcher can submit

### DB migration

`supabase/migrations/0021_installer_profile.sql` — adds `years_experience integer` and `skills text[] not null default '{}'` to `users`. Applied.

---

## Clash detection logic

```typescript
// Normalize both sides to HH:MM before any comparison
const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

// True when windows overlap (touching end-to-start is NOT a clash)
function timesOverlap(s1, e1, s2, e2): boolean {
  if (!a || !c) return true               // no start → flag unknown
  if (b && d)   return a < d && c < b     // both have end → strict overlap
  if (b)        return c >= a && c < b    // job1 has end → job2 start inside
  if (d)        return a >= c && a < d    // job2 has end → job1 start inside
  return a === c                          // neither has end → same start only
}

// True when jobs touch exactly end-to-start (travel-time warning)
function timesTouch(s1, e1, s2, e2): boolean {
  return (!!b && b === c) || (!!d && d === a)
}
```

---

## Known issues going into next session

### Major bug
- **Approval page: Save failed on Approve & Schedule click** — root cause unknown. The crash log opened this session (`crash-2026-05-18_12-37-10.txt`) was a different issue (`showWorkload is not defined`, a mid-session hot-reload artifact — already resolved). The approval save failure is a separate unresolved bug in the approve API route or ApprovalCard handler.

### Minor visual bug
- **Friday bar missing in WeekWorkloadChart** — layout was restructured (bar + label merged into single `<button>` per day) but not confirmed fixed on the Vercel preview. Re-test first thing.

### Feature request
- **Schedule page visual overhaul** — Nic to share screenshot. Full redesign of `/schedule`. Spec + plan needed before any coding.

---

## What's next

1. Investigate and fix the approval page save failure (major bug)
2. Confirm or re-fix the Friday bar in WeekWorkloadChart (minor)
3. Schedule page visual overhaul (Nic provides screenshot → brainstorm → spec → plan → build)
4. AdminRoleModal double-Yes bug (minor, pending since 2026-05-14)
5. Bulk delete jobs (spec + plan still needed)
