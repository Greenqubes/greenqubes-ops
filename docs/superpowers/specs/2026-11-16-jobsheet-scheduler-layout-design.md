# The old jobsheet in the scheduler's layout — design

_2026-11-16. Short design (a small change). Approved by Nic ("looks good") against the mockup https://claude.ai/artifact/9CHHtNRpAS27rJvDCEDH9s (version 8)._

## Why

The "Greenqubes Jobs" Google Sheet is filled hourly by the app (2026-11-11 → 13, `scripts/google-sheet/jobsheet-sync.gs` + `/api/sheet/jobs`). Nic's scheduler wants it to read like the app's Drivers view: each driver's jobs together, in that driver's colour, so a day is read by van, not by clock. He supplied a screenshot of the header he wants.

## What Nic decided

- **Columns (11):** Date · Day · Production (生产) · Company · Client Name & Contact · Time & Punctuality (时间) · Jobs Description （工作说明） · Address · DO · Sales PIC · Driver & Installer. No Project Title column; no Remarks / Job Time.
- **Production / DO:** a ✓ when the job is ticked Production ready / DO issued, blank otherwise.
- **Each day, top to bottom:** grey gap row → date row (date + day, bold) → Mixed drivers (2+ drivers, white) → white gap → each driver's jobs → … → jobs with no driver yet (white, at the bottom until arranged) → white gap → leave rows.
- **Driver colour across the whole row:** CK purple, Rintu green, Xiao Yi yellow — the app's Drivers view colours (#D9D2E9, #D9EAD3, #FFF2CC). Mixed stays white.
- **Strict time:** the Time cell solid red (#FF0000), white bold text. Flexible: plain.
- **Gaps:** grey (#CCCCCC) between days, white between driver blocks.
- **Leave at the bottom of the day, red text (#FF0000, bold), no fill:** a row for MC, a row for On leave, a row per course, then PH (public holiday).
- **Leave type shown (privacy call, Nic 2026-11-16).** Until now the reason for an absence was HR/admin only. Nic was told the sheet is shared with the whole team and chose to show MC vs On leave anyway. HR's free-text note is never shown.
- **Title row on top** (dark, "Greenqubes jobs · 21/12 to 27/12 · updated 23 Dec 3:00 PM · filled by the app every hour, view only"), then the column names; both pinned. Date header grey like the others.

## Claude's calls (shown in the mockup, accepted with it)

- **Job title** is the first line of Jobs Description, the description under it (no title column, but the title must not be lost).
- **Contractor-only jobs** (an outside installer, none of ours) get their own white block just above "no driver yet". A job with our driver plus a contractor shows once, in our driver's block (the board's mirror copies don't suit a sheet).
- **Driver block order:** the `is_driver` users in name order (as the board: CK, Rintu, Xiao Yi); anyone else crewed as the single driver gets a block after them, white. A block with no jobs that day is skipped.
- **Inside a block:** jobs with no time first, then by start time (as the sheet does today).
- **Leave labels:** `medical` → "MC"; `annual`, `emergency`, `other` → "On leave" (so "emergency" never appears). A half day carries "(AM)" / "(PM)". One row per label listing everyone, e.g. "On leave: Razu (PM), Halim".
- **"On course"** is every Away trip covering the day (the Away list holds courses and business trips; nothing tells them apart): "On course: Firoz, Rintu · Forklift course", one row per trip. Uses the existing `awayWindowOnDate` rule, so a trip ending 00:00 does not show on its last date.
- **PH:** "PH: Christmas Day" from `public_holidays`. Company events are not included.
- Multi-day jobs show on every day they cover (as today).

## Approaches

- **A — the app paints every cell; the script only copies (picked).** The route sends each row's values, fills, text colours, bold, alignment and wrap, plus column widths and how many rows to pin. The script becomes a thin painter. Nic pastes it once; later tweaks (a fourth driver's colour, a column) are app-only.
- B — keep the colours and order in the script. Every tweak means another paste into the sheet. Rejected.

## How

- **New pure module `src/lib/utils/jobsheet-layout.ts`** builds one painted week from jobs, leave (with type + portions), away trips and holidays. Tested standalone like `jobsheet-rows.test.ts`.
- **Driver colours stay in one place.** `driver-board.ts` keeps the name → colour list; it gains the hex for each colour (`driverTintHex`) beside the CSS variable. A test reads `globals.css` and fails if the hex and the light-theme `--driver-tint-*` values ever differ.
- **The route keeps the current answer for the current script.** `/api/sheet/jobs?…&layout=2` returns the new painted week; without `layout=2` it answers exactly as today. So the real sheet does not change until Nic pastes the new script. Once the real sheet is switched, a later session deletes the old path and `jobsheet-rows.ts`.
- **The query** (`getWeekSheet`) additionally reads `production_ready`, `do_issued`, the leave type (`user_leave_details.leave_type`, never `note`) and portions, away trips covering the week, and `public_holidays` — all on the service key, behind the sheet key, as today.
- **Script v2:** asks with `&layout=2`, checks the answer's shape before wiping anything (a bad answer leaves the tab as it was), then wipes and writes rows, styles, widths and pinned rows exactly as sent. Tab handling (which weeks, making tabs, never touching past or non-week tabs, two tabs for one week) is unchanged. A later week still gets a tab only once it has a job (the answer says `hasJobs`).

## Rollout

Feature branch → dev → Nic checks the preview (Admin → Settings → Copy script gives the new script) → main. The live sheet keeps its current look. Nic pastes the new script into a copy of the sheet and presses Refresh now (Google can only reach production, previews sit behind Vercel SSO); when happy, pastes it into the real sheet.

## Not in scope

Company events, Away times on the sheet, removing the old answer (after the switch), any change to the app's own screens.
