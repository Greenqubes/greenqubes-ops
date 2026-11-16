# Jobsheet Scheduler Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "Greenqubes Jobs" sheet is rewritten hourly in the scheduler's layout (driver blocks in driver colours, ticks, leave/course/PH rows at the bottom), with every cell's look decided by the app.

**Architecture:** A new pure module builds a fully painted week (values + fill + text colour + bold + alignment + wrap per cell, widths, pinned rows). `/api/sheet/jobs` serves it when asked with `layout=2` and keeps today's answer otherwise, so the live sheet is untouched until Nic pastes script v2, which becomes a thin painter.

**Tech Stack:** Next.js route (TypeScript), Supabase service client, Google Apps Script (plain ES2015-ish JS), standalone `npx tsx` tests (`check()` style, no framework).

**Spec:** `docs/superpowers/specs/2026-11-16-jobsheet-scheduler-layout-design.md`

## Global Constraints

- Columns, in order: `Date`, `Day`, `Production (生产)`, `Company`, `Client Name & Contact`, `Time & Punctuality (时间)`, `Jobs Description （工作说明）`, `Address`, `DO`, `Sales PIC`, `Driver & Installer`. Widths px: 70, 45, 80, 130, 150, 130, 320, 260, 50, 100, 130.
- Colours: title fill `#1F3D3B` text `#FFFFFF`; header fill `#B7B7B7`; day gap `#CCCCCC`; driver gap no fill; strict time fill `#FF0000` text `#FFFFFF` bold; leave/course/PH text `#FF0000` bold, no fill; default text `#000000`. Driver fills come from `driverTintHex` (CK `#D9D2E9`, Rintu `#D9EAD3`, Xiao Yi `#FFF2CC`).
- Title text: `Greenqubes jobs · {d/m} to {d/m} · updated {d MMM h:mm AM/PM SGT} · filled by the app every hour, view only`. Two rows pinned (title + header).
- Dates and day names English (CLAUDE.md hard rule): `23-Dec`, `Wed`.
- Leave labels: `medical` → `MC`; anything else (incl. no details row) → `On leave`. Never read or send `user_leave_details.note`.
- Without `layout=2` the route's answer must stay byte-for-byte what `buildWeekRows` gives today.
- Any change to the .gs file means Nic re-pastes it; the Admin card serves the file as-is (no change needed there).

## Review Focus

- A job whose only driver is not flagged `is_driver` → its own white block after the real drivers, never dropped (Task 2 test `stray driver block`).
- A day with leave or a PH but no jobs → leave rows straight after the date row, no white gap above them (Task 2 test `leave-only day`).
- Two Away trips on one day → two "On course" rows, one per trip, each with its own title (Task 2 test `two trips`).
- A leave with no details row (type unknown) → "On leave", never blank or "null" (Task 2 test `missing type`).
- A malformed or older-format answer (wrong row length, missing `layout`) → script refuses it and leaves the tab as it was (Task 3 test `usableWeek rejects…`).

---

### Task 1: Driver colours as hex, from the same list

**Files:**
- Modify: `src/lib/utils/driver-board.ts:387-395`
- Test: `src/lib/utils/driver-board.test.ts` (append)

**Interfaces:**
- Produces: `driverTintHex(name: string): string | null` exported from `driver-board.ts`. `driverTint(name)` keeps its current output.

- [ ] **Step 1: Write the failing tests** (append to `driver-board.test.ts`)

```ts
console.log('driverTintHex — the sheet uses the same colours as the board:')
check('CK hex',      driverTintHex('CK'),        '#D9D2E9')
check('Xiao Yi hex', driverTintHex(' xiao  yi '), '#FFF2CC')
check('Rintu hex',   driverTintHex('Rintu'),     '#D9EAD3')
check('unlisted → no hex', driverTintHex('Ali Ramjan'), null)
// globals.css light-theme values must equal the hexes (read the first :root block)
check('hex matches globals.css purple', cssTint('purple'), '#D9D2E9')
check('hex matches globals.css beige',  cssTint('beige'),  '#FFF2CC')
check('hex matches globals.css green',  cssTint('green'),  '#D9EAD3')
```
`cssTint(key)` is a test helper: read `src/app/globals.css`, take the text before the first `@media`/`[data-theme` block, regex `--driver-tint-${key}:\s*(#[0-9A-Fa-f]{6})`, return the upper-cased match.

- [ ] **Step 2: Run** `npx tsx src/lib/utils/driver-board.test.ts` — expect FAIL (`driverTintHex` not exported).
- [ ] **Step 3: Implement.** `DRIVER_TINTS` becomes name → colour key (`'purple' | 'beige' | 'green'`); a `TINT_HEX` record holds the three hexes with a comment that they mirror globals.css (tested). `driverTint` returns `` `var(--driver-tint-${key})` ``; `driverTintHex` returns `TINT_HEX[key]`; both use the same name normalisation.
- [ ] **Step 4: Run** the test — expect all pass, including the older `driverTint` checks.
- [ ] **Step 5: Commit** `feat(sheet): driver colours as hex from the board's own list`

### Task 2: The painted week (pure)

**Files:**
- Create: `src/lib/utils/jobsheet-layout.ts`
- Test: `src/lib/utils/jobsheet-layout.test.ts`

**Interfaces:**
- Consumes: `sheetTime`, `crewLine`, `type SheetJob` from `./jobsheet-rows`; `type Crew` from `./installer-crew`; `leaveWindowOnDate`, `type LeavePortion` from `./leave-overlap`; `awayWindowOnDate`, `type AwayTrip` from `./away-overlap`; `driverTintHex` (Task 1).
- Produces:
```ts
export const LAYOUT_COLUMNS: ReadonlyArray<{ name: string; width: number }>
export type PaintedRow = { values: string[]; bg: (string | null)[]; fg: string[]; weights: ('bold' | 'normal')[]; aligns: ('left' | 'center')[]; wrap: boolean }
export type PaintedWeek = { layout: 2; week: string; widths: number[]; frozen: number; hasJobs: boolean; rows: PaintedRow[] }
export type LayoutJob = SheetJob & { production_ready: boolean; do_issued: boolean }
export type LayoutLeave = { name: string; date_start: string; date_end: string; start_portion: LeavePortion; end_portion: LeavePortion; leave_type: string | null }
export type LayoutHoliday = { holiday_date: string; name: string }
export type LayoutInput = { monday: string; now: Date; jobs: LayoutJob[]; leaves: LayoutLeave[]; trips: AwayTrip[]; holidays: LayoutHoliday[]; drivers: string[] }
export function sgtStamp(now: Date): string            // '23 Dec 3:00 PM' (UTC+8, no DST)
export function leaveLabel(type: string | null): 'MC' | 'On leave'
export function buildPaintedWeek(input: LayoutInput): PaintedWeek
```
`drivers` = names of `is_driver` users in name order.

- [ ] **Step 1: Write the failing tests** in `jobsheet-layout.test.ts` (same `check()` harness as `jobsheet-rows.test.ts`). Fixtures: week `2026-12-21`, `now = new Date('2026-12-23T07:00:00Z')`, drivers `['CK', 'Rintu', 'Xiao Yi']`, a base job like `owl` in `jobsheet-rows.test.ts` with `production_ready`/`do_issued`. Find rows by `values[6]` (description) or `values[0]` (date). Assertions:
  - `sgtStamp(now)` → `'23 Dec 3:00 PM'`; `sgtStamp(new Date('2026-12-22T16:30:00Z'))` → `'23 Dec 12:30 AM'`.
  - `leaveLabel('medical')` → `'MC'`; `'annual'`, `'emergency'`, `'other'`, `null` → `'On leave'` (**missing type**).
  - Row 0 values[0] equals the title text in Global Constraints with `21/12 to 27/12` and `23 Dec 3:00 PM`; its `bg` all `#1F3D3B`, `wrap` false. Row 1 values = the 11 column names, `bg` all `#B7B7B7`, weights all bold, aligns all center. `frozen` 2, `widths` as Global Constraints, every row 11 long in all five arrays.
  - **Day order** for Wed 23 Dec with one job each — Mixed (`drivers: CK, Rintu`), CK, Xiao Yi, contractor-only (`externals: Fu`), no crew — the description column after the date row reads, in order: mixed title, `''` (white gap), CK title, `''`, Xiao Yi title, `''`, contractor title, `''`, no-crew title. The row before the date row has `bg` all `#CCCCCC`; the white gaps have `bg` all null. No Rintu block (empty block skipped).
  - **Driver colour:** CK job row `bg` all `#D9D2E9` except a strict time cell; mixed, contractor, no-crew rows `bg` all null.
  - **Strict:** time cell (index 5) `bg #FF0000`, `fg #FFFFFF`, weight bold; flexible time cell bg = the row's colour.
  - **Cells:** `values[2]` `'✓'` when `production_ready`, `''` otherwise; `values[8]` same for `do_issued`; both centered. `values[3]` company (`client`), `values[4]` `'Li Min\n9123 4567'`, `values[6]` `'TITLE\nDESCRIPTION'` (title alone when no description, description alone when no title), `values[10]` `crewLine` output.
  - **Inside a block:** untimed job before a 9:00 job before a 14:00 job.
  - **Stray driver block:** a job whose only driver is `'Hai Long'` (not in `drivers`) sits after the Xiao Yi block, `bg` null.
  - **Leave rows** on Wed: leaves medical (Halim), annual PM-start single day (Razu), emergency (Vinz) → after a white gap below the last job: `'MC: Halim'`, `'On leave: Razu (PM), Vinz'`; then a trip covering the day `'On course: Firoz, Rintu · Forklift course'`; `fg[6]` `#FF0000`, weight bold, `bg` null. A leave ending AM on its last day shows `(AM)` that day.
  - **Two trips:** two "On course" rows, each with its own title.
  - **PH:** Fri 25 Dec holiday `Christmas Day`, no jobs → **leave-only day**: date row immediately followed by `'PH: Christmas Day'` (no white gap).
  - A trip ending `00:00` on 24 Dec does not appear on 24 Dec.
  - `hasJobs` true with a job in the week, false with none; a 2-day job (23–24 Dec) appears on both days.
- [ ] **Step 2: Run** `npx tsx src/lib/utils/jobsheet-layout.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `jobsheet-layout.ts`. Band of a job from its `crew`: `drivers.length >= 2` → mixed; `1` → that driver's name; `0` with `externals.length` → contractor; else none. Blocks per day in order: mixed, each name in `input.drivers`, strays (names not in `drivers`, alphabetical), contractor, none; skip empty; white gap between rendered blocks. Sort inside a block with `(a.time_start ?? '').localeCompare(b.time_start ?? '')`. Leave suffix from `leaveWindowOnDate` (pass `id: ''`, `user_id: ''`): window `00:00–12:00` → ` (AM)`, `12:00–24:00` → ` (PM)`, else none. Names inside a leave row sorted A–Z. Trips covering a day via `awayWindowOnDate`; people already sorted. Header comment cites the spec.
- [ ] **Step 4: Run** the test — all pass. Also `npx tsx src/lib/utils/jobsheet-rows.test.ts` still passes (untouched).
- [ ] **Step 5: Commit** `feat(sheet): the scheduler's layout as a fully painted week`

### Task 3: Serve it, read the extra data, script v2

**Files:**
- Modify: `src/lib/supabase/queries/jobsheet.ts` (`getWeekSheet`)
- Modify: `src/app/api/sheet/jobs/route.ts`
- Modify: `scripts/google-sheet/jobsheet-sync.gs`
- Modify: `scripts/google-sheet/jobsheet-sync.test.ts`
- Modify: `docs/google-sheet-jobsheet-setup.md`

**Interfaces:**
- Consumes: `buildPaintedWeek`, `LayoutInput` types (Task 2); `TRIP_SELECT`, `mapTripRows`, `type TripRow` from `@/lib/supabase/queries/away`.
- Produces: `getWeekSheet(svc, monday): Promise<Omit<LayoutInput, 'monday' | 'now'>>` (jobs are `LayoutJob[]`, leaves `LayoutLeave[]` — supersets of what `buildWeekRows` takes, so the old path keeps working). Script globals tested: `usableWeek(data): boolean`, `needsTab(monday, todayISO, hasJobs: boolean): boolean`, plus the unchanged tab helpers.

- [ ] **Step 1: Write the failing script tests.** In `jobsheet-sync.test.ts`: drop the `SHEET_COLUMNS` import and the `headerTitle`/`headerCells`/`paintRows`/`DEFAULT_COLUMNS`/`COLUMN_WIDTHS` checks; keep every tab-name/`insertAt`/`safeCell`/`isRefreshable` check. Add:
  - `usableWeek(buildPaintedWeek(<a fixture week with one job and one leave>))` → true (**the app's answer and the script agree** — import `buildPaintedWeek` from `../../src/lib/utils/jobsheet-layout`).
  - **usableWeek rejects:** `null`; the old format `{ week, columns, rows: [{ type: 'job', cells: [...] }] }`; `layout: 1`; a row whose `bg` has 10 entries; a `weights` entry `'heavy'`; `frozen` greater than the row count; empty `rows`.
  - `needsTab('2026-12-21', '2026-12-23', false)` → true (this week); next week, false → true; three weeks ahead, false → false; three weeks ahead, true → true.
- [ ] **Step 2: Run** `npx tsx scripts/google-sheet/jobsheet-sync.test.ts` — expect FAIL (`usableWeek` undefined).
- [ ] **Step 3: Rewrite the .gs to v2.** Header comment: what it does now (layout from the app, v2, paste over the old one). Remove `WIDTH`, `HEADER_ROWS`, `DEFAULT_COLUMNS`, `COLUMN_WIDTHS`, `headerTitle`, `headerCells`, `paintRows`. `fetchWeek_` appends `'&week=' + monday + '&layout=2'` and returns the data only if `usableWeek(data)`. `needsTab(monday, today, data.hasJobs)`. `writeTab_(sheet, data)`: the existing wipe block unchanged; grow columns/rows to fit; `setColumnWidth` from `data.widths`; one range over all rows → `setNumberFormat('@')`, `setValues` (each value through `safeCell`), `setBackgrounds`, `setFontColors`, `setFontWeights`, `setHorizontalAlignments`, `setVerticalAlignment('middle')`, `setWraps` (each row's `wrap` repeated across its cells); then `setFrozenRows(data.frozen)`. The `updated` stamp now comes from the app's title row, so `refreshAll` no longer formats one. Nothing at the top level touches Google services (the test loads the file in a bare vm).
- [ ] **Step 4: Extend `getWeekSheet`.** Jobs select adds `production_ready, do_issued`. Leaves select `user_id, date_start, date_end, start_portion, end_portion, user_leave_details(leave_type)` → `leave_type` (object-or-array tolerant: take `[0]` if an array). In parallel: `away_trips` with `TRIP_SELECT`, `.lte('start_date', sunday).gte('end_date', monday)` → `mapTripRows`; `public_holidays` `holiday_date, name` between monday and sunday ordered by date; `users` `name` where `is_driver` true and `deleted_at` null, ordered by name. Every error throws (the route then answers 500 and the script leaves the tab).
- [ ] **Step 5: Route.** After the key and week checks: `if (params.get('layout') === '2')` → `NextResponse.json(buildPaintedWeek({ monday: week, now: new Date(), ...data }), no-store)`; otherwise the existing `{ week, columns: SHEET_COLUMNS, rows: buildWeekRows(week, jobs, leaves) }` unchanged.
- [ ] **Step 6: Run** the script test, `jobsheet-layout.test.ts`, `jobsheet-rows.test.ts`, `driver-board.test.ts`, then `npm run type-check` — all pass, no type errors.
- [ ] **Step 7: Real-data check, read-only.** Throwaway (not committed) `npx tsx --env-file=.env.local` script in the scratchpad: `getWeekSheet(createServiceClient(), <this week's Monday>)` → `buildPaintedWeek` → print each row's description cell, first fill and Driver cell. Expected: real jobs grouped by driver in the spec's order, CK rows purple etc., leave rows at day ends showing MC / On leave, nothing with a note in it.
- [ ] **Step 8: Update `docs/google-sheet-jobsheet-setup.md`** "What it does" to the new layout (one short bullet list, the mockup link) and add under "Setting it up": updating from the earlier version = paste over it, the app link is kept.
- [ ] **Step 9: Commit** `feat(sheet): serve the painted week on layout=2; script v2 paints what the app sends`

### Task 4: Build and hand over

- [ ] **Step 1:** `npm run build` — succeeds.
- [ ] **Step 2:** Merge `feat-jobsheet-layout` into `dev` (ask Nic before pushing), give Nic the preview link: Admin → Settings → Copy script must give the v2 file.
- [ ] **Step 3:** After "push to main": confirm the deploy against `/api/version`, then Nic tests v2 on a copy of the sheet, then the real one.
