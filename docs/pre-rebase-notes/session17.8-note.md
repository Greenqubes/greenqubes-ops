# Session 17.8 — Installer UI: Completed Tab + My Jobs Redesign + View Toggle

_Written: 2026-05-08. All changes on `dev` branch._

---

## What was built

### 1. Completed tab added to installer bottom nav

`BottomNav.tsx` installer tab array updated from 2 to 3 tabs:

**Before:** My Jobs | Assistant  
**After:** My Jobs | Completed | Assistant

The `/completed` page was already accessible and RLS-filtered — installers only see their own completed jobs. Adding the tab simply surfaces it in the nav. No page or query changes needed.

**File:** `src/components/BottomNav.tsx`

---

### 2. InstallerShell visual redesign — matches ScheduleShell

The My Jobs page (`/installer`) was redesigned to match the ScheduleShell visual language:

- **Eyebrow label:** "Hi, [firstName]" moved to a small muted uppercase tracking label (was an h1 eyebrow above a big "Today" heading)
- **Header:** "My Jobs" h1 (new i18n key `installerMyJobs`) with a search toggle button on the right — identical pattern to ScheduleShell
- **Search bar:** expandable search panel (same style as ScheduleShell — rounded-full input, Search icon left, X clear button right)
- **Filter chips:** Today's run / Up next / This week — restyled from rounded green pill buttons to ScheduleShell's terracotta chip style (`rounded-full border text-[11px]`; active state `bg-terracotta-soft border-terracotta text-terracotta`)
- **Past tab removed:** replaced by the Completed bottom nav tab

i18n key `installerMyJobs` added to en (`My Jobs`), zh (`我的工作`), bn (`আমার কাজ`).

**Files:** `src/features/installer/InstallerShell.tsx`, `src/lib/i18n/en.ts`, `src/lib/i18n/zh.ts`, `src/lib/i18n/bn.ts`

---

### 3. List / Week / Month view toggle on My Jobs page

Added the same view toggle as ScheduleShell to InstallerShell:

- Toggle sits to the left of the filter chips in the same row — `bg-paper border border-line rounded-lg p-0.5` pill with three buttons (List / Week / Month), active state `bg-ink text-white`
- **List mode:** existing behaviour — filter chips shown, NowCard + InstallerJobCard list
- **Week mode:** filter chips hidden; date nav arrows appear in header with month label; renders shared `WeekView` component showing all assigned scheduled jobs by day
- **Month mode:** same date nav; renders shared `MonthView`; tapping a date drills down to list view

For week/month, the installer's `scheduled` jobs are built into a `jobsByDate: Record<string, ScheduleJob[]>` map (same multi-day expansion logic as ScheduleShell). Jobs are cast as `ScheduleJob` — safe because `InstallerJob` is now a structural superset.

#### InstallerJob type extended

`project_title: string | null` and `date_end: string | null` added to `InstallerJob` and the `getInstallerJobs()` query so `JobRow` (used inside WeekView/MonthView) can render both fields correctly.

**Files:** `src/lib/supabase/queries/installer.ts`, `src/features/installer/InstallerShell.tsx`

---

## Files changed

| File | Change |
|---|---|
| `src/components/BottomNav.tsx` | Add Completed tab to installer array |
| `src/features/installer/InstallerShell.tsx` | Full redesign: search, terracotta chips, view toggle, WeekView/MonthView |
| `src/lib/supabase/queries/installer.ts` | Add `project_title`, `date_end` to type and query |
| `src/lib/i18n/en.ts` | Add `installerMyJobs` |
| `src/lib/i18n/zh.ts` | Add `installerMyJobs` |
| `src/lib/i18n/bn.ts` | Add `installerMyJobs` |

---

## Commits this session

| Hash | Message |
|---|---|
| `72f7a8d` | feat: installer Completed tab + My Jobs page redesign |
| `d9e039f` | feat: list/week/month view toggle on installer My Jobs page |

---

## Known issues

- **React hydration error #418 on /schedule (production only)** — pre-existing, untouched. See CLAUDE.md.

---

## What's next

- Session 19 — Pre-Alpha Testing (Myself)
