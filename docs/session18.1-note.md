# Session 18.1 — Additional Design Edits (Owner Review Pass)

_Written: 2026-05-05. All changes committed to `dev` and pushed to Vercel preview._

---

## What was done

Follow-up visual and UX pass based on owner's own design input after reviewing the Session 18 preview. Session rules: visual/design only, no unrelated feature work.

---

## Changes applied

### Company bar & branding
| Change | File |
|---|---|
| Added sticky company bar (GreenQubes + Pre-Alpha label) above all shells | `ScheduleShell`, `ApprovalsShell`, `InstallerShell` |
| GreenQubes name: 15px → 22px (50% bigger) | All three shells |
| Notification bell + UserMenu lifted from action row into company bar | `ScheduleShell` |
| "COMPANY SCHEDULE" label moved up one row — between company bar and h1 | `ScheduleShell` |

### Action row (ScheduleShell header)
| Change | File |
|---|---|
| Removed approvals icon button (covered by bottom nav) | `ScheduleShell` |
| Search and New button order swapped (search first, New second) | `ScheduleShell` |
| "New job" renamed to "New", `lowercase` removed, weight → `font-semibold` | `ScheduleShell` |
| New button height: py-1.5 → py-[9px] → py-[11px] (+10% additional) | `ScheduleShell` |

### Notification bell & drawer
| Change | File |
|---|---|
| Bell active state: inverted to solid red (`bg-bad`, white bell + count inline) | `NotificationDrawer` |
| Count caps at `10+` when > 10 overdue jobs | `NotificationDrawer` |
| Drawer header: round bell icon (bg-bad-soft) beside "Notifications" label | `NotificationDrawer` |
| Overdue job cards: amber → washed red (`border-bad`, `bg-bad-soft`, `text-bad`) | `NotificationDrawer` |
| `AlertCircle` → `Hourglass` icon in washed red on overdue cards | `NotificationDrawer` |
| Card text (client/date/location) in `text-bad` at varying opacities | `NotificationDrawer` |

### Job row (schedule list)
| Change | File |
|---|---|
| Time range: `text-xs` → `text-[24px]` → `text-[12px]` (settled at 12px, 50% reduction from 24px) | `JobRow` |
| "Job Time:" flavor label added above the time, vertical stack, right-aligned | `JobRow` |
| `production ✓` → `Production ✓` (capital P) | `JobRow` |

### Overdue pill (Pill component)
| Change | File |
|---|---|
| Overdue pill: `bg-terracotta-soft text-terracotta` → `bg-bad text-white` (solid red, white text) | `Pill.tsx` |
| Label: `'overdue'` → `'Overdue'` (capital O) | `Pill.tsx` |

### Date strip (ListView)
| Change | File |
|---|---|
| Overdue dates: whole button card → `bg-bad-soft border-bad text-bad` | `ListView.tsx` |
| Overdue date shortDay: `opacity-70` removed so red reads at full saturation | `ListView.tsx` |
| Dot logic: strict-only → red `#D14545` dot; flexible-only → blue dot; both → stacked (blue base + red shifted half-dot left on top) | `ListView.tsx` |

### Language switcher
| Change | File |
|---|---|
| `UserMenu` accepts optional `lang` prop; fetches current lang from `users` table | `UserMenu.tsx` |
| Language switcher in dropdown: EN / 中文 / বাং buttons, updates DB, refreshes page | `UserMenu.tsx` |
| `PATCH /api/user/lang` API route | `src/app/api/user/lang/route.ts` |
| Lang prop passed from all shells to UserMenu | `ScheduleShell`, `ApprovalsShell`, `InstallerShell` |

### Bottom navigation
| Change | File |
|---|---|
| Completed + Pending tabs added for scheduler and sales | `BottomNav.tsx` |

### New pages
| Page | What it shows |
|---|---|
| `/completed` | Completed jobs only (`getCompletedJobs()`), no New button |
| `/pending` | Pending + awaiting_approval jobs (`getPendingJobs()`), no New button |

### Query additions
| Function | Filter |
|---|---|
| `getCompletedJobs()` | `status = 'completed'`, descending by date |
| `getPendingJobs()` | `status in ('pending', 'awaiting_approval')`, ascending by date |

---

## TypeScript

`npx tsc --noEmit` — clean, no errors.

---

## What's next

- Session 18.2 — additional design edits (continuing owner review pass)
