# Schedule List View — Scrolling & Navigation UX Redesign

**Date:** 2026-08-03
**Status:** Approved by Nic (pending spec review)
**Checklist item:** "Schedule tab: list view scrolling UX" (docs/nic-checklist.md, from 2026-07-22 Phase 3 session)

---

## Problem

The Schedule tab's list view has a horizontal date strip that renders **one button per day
from the earliest job to the latest job** — every day in between, including empty ones.
Confirmed problems:

1. **Unbounded growth** — a few months of jobs means hundreds of day buttons in one row.
2. **No auto-scroll to today** — the strip always starts at the oldest date; today can be
   far off-screen on load.
3. **Broken scrollbar styling** — the `scrollbar-none` class is used in 3 places
   (ListView date strip, ScheduleShell filter chips, InstallerShell filter chips) but was
   **never defined in any CSS**, so desktop shows the browser's tiny native scrollbar —
   the only way to scroll the strip with a mouse.
4. **Page feels long overall** — legend + generous paddings add up.

Nic confirmed (2026-08-03): all four pains matter; time navigation is "everything, all
the time" (past, present, future all visited regularly); device usage is roughly half
desktop, half phone.

## Decisions made during brainstorming

- **Option A chosen**: windowed strip + jump calendar + Today button (over "keep endless
  strip but smarter" and "week-only pager").
- **Strip is switchable between Week and Month windows** (Nic's addition).
- **Weeks are Monday → Sunday** — this is how the company operates. The existing helper
  builds Sunday-start weeks; Nic approved fixing this **app-wide** (Week tab, Month grid,
  installer views) so the whole app agrees on what a week is.
- **Week mode ignores month boundaries** — a week straddling two months always shows all
  7 days (confirmed with Nic; this is the comfortable mode for month-end work).
- The June 2026 decision "show every day, including empty ones" is preserved — within
  the visible window.

---

## Design

### 1. Date strip → windowed `DateStrip` component

New component `src/features/schedule/DateStrip.tsx`. Replaces the strip section of
`ListView.tsx`.

**Two window modes:**

| Mode | Window | Layout |
|---|---|---|
| `week` (default) | Mon–Sun containing the anchor date | 7 pills **flex evenly** to fill the row — no overflow, no scrolling |
| `month` | All days of the anchor date's month (28–31) | Fixed-width pills (current sizing), horizontal scroll, selected day auto-centred |

**Mode toggle:** one compact button at the right end of the strip row showing the
current mode ("7" / "31" with a small calendar glyph — stroke SVG, no emoji). Tapping
toggles. Persisted to `localStorage` key `gq-strip-mode`.
**Hydration guard:** the mode must initialise to `'week'` on both server and client,
then read localStorage in a `useEffect` after mount. Never read localStorage in the
initial render path — `/schedule` already has a production hydration issue (#418,
off-limits) and this must not add another mismatch.

**Strip row layout:** `[‹] [pills…] [›] [mode toggle]`

- The `‹ ›` paging arrows are **always visible on all devices** (in week mode there is
  no overflow to swipe, so arrows are the only way to page). They shift the strip's
  **anchor** by ±1 week (week mode) or ±1 month (month mode) **without changing the
  selected date** — you can peek ahead, then tap a day to select it.
- **Anchor state** lives inside DateStrip: it defines the visible window and re-syncs
  to `selectedDate` whenever the selection changes (heading chevrons, day tap, jump
  calendar, Today button).
- **Desktop nicety:** while hovering the strip in month mode, the mouse wheel scrolls
  it horizontally.
- **Day pills keep all current signals:** punctuality dots (red strict / blue flexible /
  both), red tint for days with overdue jobs, terracotta day number for today, dark
  fill for the selected day.

**Auto-centre:** on mount and whenever the selection or window changes, the selected
day (or window start if the selection is outside the window) scrolls into view,
centred (`scrollIntoView`, instant on mount, smooth afterwards). Client-side effect
only — no SSR impact.

### 2. Jump calendar → `JumpCalendar` component

New component `src/features/schedule/JumpCalendar.tsx`.

- **Trigger:** tapping the date heading (e.g. "Sun, 3 Aug") in ScheduleShell,
  **list view only** (the Week/Month tabs keep their non-tappable month heading —
  revisit later if wanted). A small chevron-down glyph is added next to the heading
  so it reads as tappable.
- **Popover card** anchored below the heading: month label + `‹ ›` month pager on top,
  then a Mon-first 7-column day grid (reuses `getMonthCells`).
  - Days with jobs show a small dot (from `jobsByDate`).
  - Today outlined; selected day filled.
  - Tap a day → `onSelectDate(day)` + close.
- Closes on outside click and Escape.
- **Layering:** `z-[70]` — above BottomNav per the standing hard rule (overlays always
  above `z-50`).
- No year picker — the month pager covers realistic ranges (YAGNI).

### 3. Today button

- A small amber-outline pill labelled "Today" in the **heading row**, left of the
  search button. Rendered only when `selectedDate !== today`.
- Tap → `setSelectedDate(today)`; the strip window follows automatically.
- Visually distinct from the terracotta "Today" **filter chip** (which filters jobs and
  is unchanged).

### 4. Monday-start weeks + Mon-first grids (app-wide)

In `src/features/schedule/utils.ts`:

- `getWeekDays`: offset becomes `(getDay() + 6) % 7` → weeks run Mon–Sun.
- `getMonthCells`: leading-blank count becomes `(firstDay + 6) % 7` → grid columns run
  Mon–Sun.

Affected consumers (all intended): Schedule **Week tab**, Schedule **Month tab**
(its day-of-week header row must be reordered to start Mon), **InstallerShell**
week/month views, the new DateStrip and JumpCalendar.

### 5. Date labels always English (hard-rule compliance)

CLAUDE.md hard rule: zh/bn settings translate UI text only; **date labels, day names,
month names are always English**. Current code violates this — `langToLocale` maps
zh→zh-CN / bn→bn-BD and is passed into `dayLabel` / `monthLabel` /
`toLocaleDateString` in ListView, WeekView, MonthView, ScheduleShell and
InstallerShell. `langToLocale` has **no other use** in the codebase.

Fix: `dayLabel` and `monthLabel` hardcode `en-GB`; heading labels use `en-GB`;
`langToLocale` is deleted. UI words (the "Today" button, toggle labels) remain
translated via i18n as normal.

### 6. Page tightening

- Legend shrinks to one compact line (`text-[10px]`, single row:
  "■ Strict on time · ■ Flexible window"), reduced margin.
- Vertical paddings close up: "Company Schedule" label, heading row, chips row, strip
  row each lose ~4–8px of padding. Same warm-editorial look, less dead air.
  Exact values tuned at implementation; the intent is a visibly tighter above-the-fold.

### 7. `scrollbar-none` utility (global fix)

Add to `src/app/globals.css`:

```css
.scrollbar-none            { -ms-overflow-style: none; scrollbar-width: none; }
.scrollbar-none::-webkit-scrollbar { display: none; }
```

Fixes the strip **and** the two filter-chip rows (ScheduleShell, InstallerShell) that
already reference the class.

### 8. i18n

New keys get real translations in `src/lib/i18n/en.ts` and `zh.ts` only.
**No new Bengali translations** (boss decision, relayed by Nic 2026-08-03 — not worth
the time/tokens): `bn.ts` receives the English text for any new key so the app keeps
compiling and bn users see English for new UI. Existing bn strings are left as they
are. Day/month names are NOT i18n keys (always English, §5).

---

## Component/state summary

| Unit | Responsibility | State |
|---|---|---|
| `ScheduleShell` | selection, filters, view tabs (unchanged); renders Today button + heading trigger for JumpCalendar | `selectedDate`, `showJump` (new) |
| `DateStrip` (new) | windowed strip, mode toggle, paging arrows, auto-centre, wheel scroll | `mode` (localStorage-backed), `anchor` |
| `JumpCalendar` (new) | month-grid popover for long jumps | `viewMonth` |
| `ListView` | slims down — renders DateStrip + legend + day's JobRows | none new |
| `utils.ts` | Monday-start helpers, en-GB labels, `langToLocale` removed | — |

The `dates` array (full earliest→latest range) computed in ScheduleShell becomes
unused and is removed.

**Not touched:** JobRow, WeekView/MonthView layout (beyond week-start + header order +
locale), FCFS board, any API route, any database table. No migrations.

## Pages that get this automatically

`/schedule`, `/pending`, `/completed` (all render ScheduleShell with different
`pageMode`). The Completed page — months of history — benefits most.

## Edge cases

- **Empty month/week:** pills render normally (count dots absent); job area shows the
  existing "no jobs" empty state.
- **Selection outside window** (after paging arrows): window shows, nothing highlighted;
  tapping any day selects it and re-anchors.
- **Multi-day jobs** already expand onto each covered date via `jobsByDate` — dots and
  counts work unchanged.
- **Filter chips** (All/Today/Week/Upcoming) and search continue to drive `jobsByDate`;
  the strip reflects filtered data exactly as today.
- **Hydration safety:** localStorage read deferred to `useEffect`; `scrollIntoView`
  effect-only; no date formatting differences between server and client renders
  (formatting is locale-hardcoded, which *reduces* mismatch surface).

## Testing

No test infra in this repo — verification is:

1. `npm run type-check` and `npm run build` clean.
2. Manual smoke on the dev preview (Nic): week↔month toggle persists; opens on today;
   paging arrows peek without changing selection; jump calendar reaches past + future
   months; Today button appears/works; Mon-start verified on Week tab, Month tab and
   installer views; zh/bn UI shows English day/month names; no tiny scrollbar on
   desktop; phone swipe still works in month mode.

## Out of scope

- The production hydration error #418 on /schedule (off-limits per CLAUDE.md).
- FCFS board views, agenda-style multi-day list, virtualised lists.
- Any change to job data, queries, or APIs.
