---
session: feat-jobs (the old Greenqubes Jobs sheet in the scheduler's layout)
date: 2026-11-16 → 2026-11-17
branch: feat-jobsheet-layout in a scratchpad worktree → main on Nic's "push to main" (twice) → dev fast-forwarded to main on his word; branch and worktree deleted after
migrations: none
release: bc5d191 live 16 Nov 19:56 SGT (build f47b4c209381); d12a1d9 live 17 Nov 19:24 (build 4bbcde0661e2); changelog e61f33c (17 Nov entry, the 16 Nov release folded in)
status: LIVE — the app serves the new layout; the sheet changes once Nic pastes script v2.1
---

# The old jobsheet in the scheduler's layout

Nic opened the session with "today we need to fix your google sheet app script": the scheduler wanted the "Greenqubes Jobs" sheet the app fills every hour (built 11–13 Nov) to look like her own sheet. Shaped over seven rounds of a mockup, built test-first in a worktree, reviewed by a fresh reviewer, and put live on Nic's "push to main". Two small additions the next day.

## The ask

- From the scheduler's screenshot: per day, jobs with two or more drivers on top, a gap, then each driver's jobs with a gap between; driver colours as in the app's Drivers view (Xiao Yi yellow, CK purple, Rintu green); a strict time highlighted hard red, flexible not.
- Through the mockup (https://claude.ai/artifact/9CHHtNRpAS27rJvDCEDH9s): a dark title row on top; colour across the whole row; white gaps between blocks, a grey gap between days; a Company column after Production; jobs with no driver white, at the bottom until arranged; MC / On leave / On course / PH in red text (no fill) at the bottom of each day; no Project Title column; a ✓ for Production ready and DO issued.
- 17 Nov: column K 245 wide; the year in L2, Arial 20 bold.
- Spec `docs/superpowers/specs/2026-11-16-jobsheet-scheduler-layout-design.md`, plan `docs/superpowers/plans/2026-11-16-jobsheet-scheduler-layout.md`.

## What was built

- **The app paints every cell** (`buildPaintedWeek`, `src/lib/utils/jobsheet-layout.ts`): each row's values, fills, text colours, weights, alignments, font sizes and fonts, plus column widths and pinned rows. `/api/sheet/jobs?…&layout=2` serves it; without `layout=2` the route answers exactly as before, so the live v1 script was never affected.
- **Script v2.1** (`scripts/google-sheet/jobsheet-sync.gs`) is a thin painter: it checks the answer is whole (`usableWeek`) BEFORE wiping a tab, then copies it. Tab handling (which weeks, new tabs, past and non-week tabs untouched) is unchanged. Layout tweaks no longer need a re-paste; a new kind of formatting does (fonts did, 17 Nov).
- **The week's data** (`getWeekSheet`, `src/lib/supabase/queries/jobsheet.ts`): jobs with `production_ready` / `do_issued`, leave with half-day portions and leave type, courses (title and people only), public holidays, and the drivers in name order.
- **Driver colours from one source:** `driverTintHex` in `src/lib/utils/driver-board.ts`, mirroring globals.css, guarded by a test.

## How it was checked

- Test-first; 95 test files, 0 failing; `tsc` and `next build` clean before each push.
- Real-data runs (read-only, throwaway scripts): week of 16 Nov grouped correctly; week of 2 Nov showed a course and Deepavali; trip note / business / location never read.
- A fresh reviewer read the branch: no Critical or Important findings; its minors were fixed except two left by choice (below).
- Each production deploy confirmed by hashing the commit against `/api/version`; the live new answer passed the script's own `usableWeek`; the old answer unchanged; a wrong key gets 404. Release times from production's `x-vercel-id`.

## Rulings (calls made during the build)

- Leave TYPE shown (medical → MC; everything else → On leave): Nic's call, told the sheet is team-wide. HR's note never read.
- The project title becomes the first line of Jobs Description. Contractor-only jobs get their own white block before the no-driver jobs.
- A strict job with no time does not get an empty red cell. Rows with the same time keep a steady order (by id) between refreshes.
- The year in L2 is the year the week STARTS in. Column L sits beside the table: no fill; the grey and dark bands stop at K.
- Fonts: null = the sheet's own font; size 10 everywhere except L2.
- Left from review: the old answer now also depends on the new reads (goes away with the old path); grouping is by driver name, as the board does.

## Deferred

- Once Nic says the real sheet runs v2.1: delete the old answer path in the route and `buildWeekRows` / `SHEET_COLUMNS` in `src/lib/utils/jobsheet-rows.ts` (keep `sheetTime`, `crewLine`, `SheetJob`).

## Deploy notes

- Nic objected when local `dev` was fast-forwarded mid-session ("this is not for dev"); nothing had been pushed, and it was undone. `dev` was brought level with `main` only at the end, on his word.
- The 17 Nov What's new describes the new sheet, which only appears once Nic pastes the script.
