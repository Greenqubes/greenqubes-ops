# Session 18.2 — Additional Design Edits (Owner Review Pass)

_Written: 2026-05-06. All changes committed to `dev` and pushed to Vercel preview._

---

## What was done

Continuing visual pass from Session 18.1, based on owner review of the preview. Session rules: visual/design only, no feature work.

---

## Changes applied

### Job time label size
| Change | File |
|---|---|
| Time range font size: `text-[12px]` → `text-[15px]` | `JobRow.tsx` |

### Pill component — casing fix
| Change | File |
|---|---|
| Removed `lowercase` CSS class from Pill span (was overriding all label casing) | `Pill.tsx` |
| `pending` label → `Pending` | `Pill.tsx` |
| `completed` label → `Completed` | `Pill.tsx` |
| `overdue` label was already `Overdue` — now actually renders correctly without the `lowercase` override | `Pill.tsx` |

### Schedule tab — hide completed jobs
| Change | File |
|---|---|
| Added `if (j.status === 'completed') return false` to the `filtered` useMemo | `ScheduleShell.tsx` |
| Completed jobs now only appear in the `/completed` tab | — |

### Strict on-time legend colour
| Change | File |
|---|---|
| Legend colour box: `bg-terracotta` → `bg-[#D14545]` (matches punctuality bar and date-strip dot) | `ListView.tsx` |

---

## Deferred

| Feature | Reason | Target |
|---|---|---|
| Admin role-switcher (`ai@greenqubes.com` previews as Sales / Scheduler / Installer) | Functional feature — requires server-side email check + role-override state; outside 18.x visual-only scope | Session 17.4 |

---

## TypeScript

`npx tsc --noEmit` — clean, no errors.

---

## What's next

- Session 17.4 — Admin role-switcher feature
- Session 19 — Pre-Alpha testing
