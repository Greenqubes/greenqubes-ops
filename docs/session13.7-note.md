# Session 13.7 — Bottom Tab Bar

> Read alongside `CONTEXT.md` and `plan.md` at session start.

_Planned: 2026-05-04_

---

## Why this session exists

The prototype (`docs/greenqubes-phase0.jsx` line 5367) renders a `position: fixed, bottom: 0` tab bar that is the primary navigation for all roles. The Next.js migration replaced it with page-level routing and header links — which works but looks nothing like the prototype. This session adds the missing bottom nav.

---

## What the prototype does

```
position: fixed, bottom: 0, width: 100%, maxWidth: 480
bg: C.card (--paper), borderTop: 1px solid C.line
padding: 8px 0 12px

Tabs by role:
  scheduler  →  Schedule (Calendar) | Pending (ClipboardList) | Approvals (Inbox) | Completed (Archive) | Assistant (MessageSquare)
  sales      →  Schedule (Calendar) | Pending (ClipboardList) | Completed (Archive) | Assistant (MessageSquare)
  installer  →  My Jobs (HardHat)   | History (History)       | Assistant (MessageSquare)

Active:   color: C.accent (--terracotta), strokeWidth: 2
Inactive: color: C.muted,                strokeWidth: 1.6
Icon size: 20 · label: 10px uppercase font-body
```

---

## Tab mapping — Next.js routes

The prototype's "Pending" and "Completed" tabs are filter views of the schedule, not separate routes. In the Next.js app, ScheduleShell already handles this via its filter chips. The bottom nav maps to actual pages:

| Role | Tabs |
|---|---|
| **scheduler** | Schedule `/schedule` · Approvals `/approvals` · Assistant `/assistant` |
| **sales** | Schedule `/schedule` · Assistant `/assistant` |
| **installer** | My Jobs `/installer` · Assistant `/assistant` |

> Note: If the boss later wants Pending/Completed as distinct tabs, they become separate routes in Session 13.8+.

---

## What to build

### 1. `src/components/BottomNav.tsx` (new)

Client component. Uses `usePathname()` to determine active tab.

```tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Inbox, Bot, HardHat } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Role } from '@/lib/supabase/types'

// tab definitions per role
// active = pathname starts with tab.href
```

Props: `role: Role`

Styling reference:
```
outer:   fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px]
         bg-paper border-t border-line flex z-50
         pb-[env(safe-area-inset-bottom,12px)] pt-2
tab btn: flex-1 flex flex-col items-center gap-1 text-[10px] font-medium
         uppercase tracking-wide transition-colors
active:  text-terracotta
inactive: text-muted hover:text-ink2
```

### 2. Add `BottomNav` to each shell

| Shell | Role passed |
|---|---|
| `ScheduleShell.tsx` | `role` prop (already exists) |
| `ApprovalsShell.tsx` | hardcode `'scheduler'` (page is scheduler-only) |
| `InstallerShell.tsx` | hardcode `'installer'` (page is installer-only) |
| `AssistantShell.tsx` | `role` prop (already exists) |

Render it as the **last child** of the outermost `<div className="min-h-screen bg-bg">` in each shell. The `position: fixed` handles visual stacking — no need for a separate layout wrapper.

### 3. Add bottom padding to all shell content areas

Each shell's scrollable content area needs `pb-24` (96px) so the fixed bar never covers the last job card. Check each shell and bump the bottom padding on the main content div.

Current padding to update:
- `ScheduleShell` — content rendered by sub-views; `WeekView` and `MonthView` already have `pb-6`, `ListView` has its own — need to verify each
- `ApprovalsShell` — `py-6` on content div → add `pb-24`
- `InstallerShell` — `pb-10` on job list div → change to `pb-24`
- `AssistantShell` — input bar is already `shrink-0`, messages flex area is scrollable — verify

### 4. Remove redundant header nav links

Once the bottom bar handles navigation, the Bot/assistant icon links in `ScheduleShell` and `InstallerShell` headers become redundant. Remove them to clean up the header. Keep the sign-out button and approvals badge — those stay in the header.

---

## Files to touch

| File | Change |
|---|---|
| `src/components/BottomNav.tsx` | **create** |
| `src/features/schedule/ScheduleShell.tsx` | add `<BottomNav role={role} />`, remove Bot link, check view padding |
| `src/features/approvals/ApprovalsShell.tsx` | add `<BottomNav role="scheduler" />`, add `pb-24` to content |
| `src/features/installer/InstallerShell.tsx` | add `<BottomNav role="installer" />`, remove Bot link, `pb-10` → `pb-24` |
| `src/features/assistant/AssistantShell.tsx` | add `<BottomNav role={role} />`, verify messages area scroll |
| `src/features/schedule/WeekView.tsx` | `pb-6` → `pb-24` |
| `src/features/schedule/MonthView.tsx` | `pb-6` → `pb-24` |
| `src/features/schedule/ListView.tsx` | check + bump bottom padding |

---

## What to check after building

- Active tab highlights correctly on each page (terracotta, `strokeWidth={2}`)
- Tab bar sits above iOS home indicator (safe-area-inset)
- Last card on every page isn't hidden under the bar
- Navigating between tabs doesn't cause a flash (Next.js Link prefetching handles this)
- Typecheck clean
