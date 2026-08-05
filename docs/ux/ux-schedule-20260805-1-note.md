---
session: ux-schedule (Schedule list — scrolling & navigation UX)
date: 2026-08-05
branch: dev → main (live on production)
---

# Schedule List Scrolling UX — DONE, live on production

> The endless date strip is gone. The list view now has a **windowed strip** (week Mon–Sun ↔
> full month), a **jump calendar** off the heading, and a **Today button** — plus
> **Monday-start weeks app-wide** and the filter chips removed. Smoke test passed on desktop
> and mobile; `dev` merged into `main` the same day.

## What was done

1. **Full design loop before code**: brainstorm (windowed strip chosen over "smarter endless
   strip" and week-only pager) → spec (`docs/superpowers/specs/2026-08-03-schedule-list-scrolling-ux-design.md`)
   → **interactive HTML mockup** (`public/mockups/schedule-list-ux/index.html`, approved by Nic)
   → implementation plan (`docs/superpowers/plans/2026-08-04-schedule-list-scrolling-ux.md`)
   → inline execution in 6 committed tasks.
2. **New `DateStrip` component** — week (7 flex pills, Mon–Sun) ↔ month (scrollable, selected
   day auto-centred) with an icon-only toggle that shows the layout you'd switch TO; choice
   persisted in `localStorage` (`gq-strip-mode`, read **after mount only** — hydration-safe);
   ‹ › paging arrows move the window WITHOUT changing the selected day; mouse-wheel scrolls the
   month strip; a **persistent centred month label** above the strip tracks the peeked window
   ("Aug – Sep 2026" when a week straddles months).
3. **New `JumpCalendar` component** — popover from the list-view heading (▾): Mon-first grid,
   job dots, month paging, closes on pick/outside/Esc; scrim `z-[60]`, panel `z-[70]` per the
   overlay hard rule.
4. **Today button** — amber pill, appears left of the heading arrows only when off today
   (moved left + made compact after Nic's feedback).
5. **Monday-start weeks app-wide** — `getWeekDays` and `getMonthCells` are Mon-first; Week tab,
   Month tab (static Mon–Sun headers) and installer week/month views all follow.
6. **Date labels always English** — `dayLabel`/`monthLabel` hardcode `en-GB`; `langToLocale`
   deleted (it existed only for date labels, which violated the CLAUDE.md hard rule for zh/bn).
7. **Filter chips removed** — All/Today/This week/Upcoming gone from ScheduleShell (state, memo
   conditions, i18n keys `filterAll`/`filterWeek`/`filterUpcoming`); `filterToday` kept (WeekView
   badge + Today button). List/Week/Month view toggle unchanged.
8. **`scrollbar-none` finally defined** in globals.css (was referenced in 3 places but never
   existed — the "tiny scrollbar" Nic hated was this bug).
9. **Page tightened** — compact one-line legend, reduced paddings; ListView slimmed (dropped
   unused `jobs`/`dates` props; ScheduleShell's full-range `dates` memo deleted).
10. **Smoke test** (`docs/schedule-list-ux-smoke-test.md`) — 7 sections, all green after two
    feedback rounds: (1) heading box widened twice so the ‹ › arrows never move with text width;
    (2) strip month label centred; (3) Today button moved to the left cluster.
11. **Merged `dev` → `main`** after Nic confirmed the preview on desktop + phone. Bryan's
    obsidian-sync frontmatter tidy-up (`scripts/lib/frontmatter.ts` + test), already on dev,
    rode along to production.

## Key decisions

- **No new Bengali translations** (boss decision, relayed 2026-08-03): new i18n keys go to
  `en.ts` + `zh.ts` only; `bn` is `Partial<Translations>` so missing keys fall back to English
  automatically — nothing needs adding to `bn.ts` at all. Recorded in CONTEXT.md.
- **Strip toggle is icon-only** showing the target layout (month-grid ↔ single-row glyphs),
  with i18n tooltip/aria ("Show full month"/"Show one week") — replaced the "7/31" label idea.
- **Jump calendar is list-view only** for now; Week/Month tab headings stay plain.
- **Paging arrows peek** — they never move the selection; tap a day to commit.

## Key files

| File | Change |
|---|---|
| `src/features/schedule/DateStrip.tsx` | new — windowed strip |
| `src/features/schedule/JumpCalendar.tsx` | new — jump popover |
| `src/features/schedule/ListView.tsx` | rewired to DateStrip, slimmed |
| `src/features/schedule/ScheduleShell.tsx` | fixed-width heading + Today btn + jump wiring; chips/filter/dates removed |
| `src/features/schedule/utils.ts` | Mon-start helpers, `getMonthDays` added, en-GB labels, `langToLocale` deleted |
| `src/features/schedule/{WeekView,MonthView}.tsx` | Mon-start / static English headers |
| `src/features/installer/InstallerShell.tsx` | locale plumbing removed |
| `src/app/globals.css` | `scrollbar-none` utility defined |
| `src/lib/i18n/{en,zh}.ts` | +`stripShowMonth`/`stripShowWeek`; −3 dead filter keys (en) |

No DB migrations, no API changes.

## ⚠️ Notes for next session

- **Nic's stated priority: the full security + integrity audit** (checklist item from
  2026-07-22) — he raised it at this session's start; the schedule UX jumped the queue.
- Pre-go-live cleanup still pending: wipe test jobs / external contacts / test installer;
  remove Nic's TG id from Wei Qing's row.
- Hydration #418 on /schedule: still off-limits; this session deliberately kept `localStorage`
  reads inside `useEffect` — console was clean on reload in Nic's smoke test.
- Vercel CLI still signed into the wrong account (from 2026-08-03) — harmless, unfixed.
- Git-on-Windows gotcha hit at session end: `git add docs/context.md` silently missed the
  tracked-as-uppercase `docs/CONTEXT.md`; use the exact tracked case.
