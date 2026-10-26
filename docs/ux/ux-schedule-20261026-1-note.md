---
session: ux-schedule (My Jobs search, schedule search across all dates, Support crew departments)
date: 2026-10-26
branch: dev → main
migrations: none
release: f52571a live 17:21 SGT (My Jobs); ae99462 live 20:46 SGT (schedule search); 566081e live 21:22 SGT (Support crew departments + Designer); changelog f3ec453, 74c3eb6, 65f7834
status: LIVE — each change checked by Nic on the dev preview before main
---

# My Jobs search, schedule search across all dates, Support crew departments

Session start ran in full (checklist walked, latest note read); the AI-importance question was skipped at Nic's request. Bryan skipped per CLAUDE.md.

## 1 — My Jobs panel (Nic's annotated screenshot)

> "Make all section more obvious with background color demarcation" · "Replace 'x' with a search function" · "Make all Section collapsible. Add an arrow" · "Long title goes to row below (max 2 rows) then '…'"

- **Colours:** three mockups in the visual companion (whole section tinted / separate cards / heading + edge bar) — Nic picked **A, whole section tinted**: Drafts `bg-brand-amber-soft`, Ongoing `bg-brand-blue-soft`, Scheduled `bg-terracotta-soft` (soft tokens — slash opacity never compiles on the bare `var()` theme colours).
- **Search** replaces the ✕. Nic: "closest wording like company name, client name, or job title", then "can include location as well". Rule: every word typed must appear somewhere in title / company / client name / location — any order, any case, part-words. **Spelling mistakes not forgiven** (my call, stated to Nic: loose matching pulls in wrong jobs). Esc or the inner ✕ clears.
- **Folding:** the heading (and its chevron) folds a section; folds persist per device in `gq-my-jobs-folded`, read after mount (#418), parsed defensively (`parseFolded`). While searching, folded sections open (`sectionOpen`) and the fold button is disabled.
- **Scheduler tabs:** Mine / Not scheduled counts show matches while searching (my call), so a job in the other list is still findable.
- **Titles** `line-clamp-2`; company line stays one line.
- Closing the panel = the existing edge arrow tab.
- `getStageJobs` now selects `client_poc_name`.

## 2 — Schedule search across all dates

> Nic: "if im on lets say todays date and i want to search a job on another date, it returns empty.. is there a way to search for it?" · "across all the dates"

**Cause:** the box filtered `filtered` → `jobsByDate`, i.e. only the day on screen; and its haystack was company + description + location + crew — **never the job title**.

**Built (Nic picked option A of two mockups):** while the box has text, `ScheduleSearchResults` replaces List / Drivers / Week / Month.
- `scheduleSearchResults(jobs, query, today, order)`: grouped by START date (a multi-day job shows once, "to {end}"); `'upcoming'` = today onwards soonest first, then finished-but-still-scheduled marked **past**, most recent first (a job started earlier but still running is not past); `'newest'` for the Completed tab.
- Same rule as My Jobs via the now-shared **`matchesWords`**; fields title, company, client name, location, crew (assignees + confirmed contractors, never suggestions). **Descriptions dropped** (agreed with Nic).
- `highlightParts` marks the searched words (all occurrences, overlaps merged, original capitals); a "Crew:" line appears only when a crew name is why it matched.
- Tap → `pickJob(date, id)`: clears the search, closes the box, jumps, blinks. `pickJob` now always clears any search (a My Jobs pick during a search would otherwise jump behind the results list). Closing the magnifier also clears.
- `SCHEDULE_SELECT` gains `client_poc_name` (optional on `ScheduleJob` — installer views use other queries). New hint text `scheduleSearchHint`; the installer page's `searchJobs` text is untouched.
- Bulk selection is not offered inside the results list (my call — find, then act from the day).

## 3 — Support crew departments (the scheduler's request)

> Nic: "my installer wants to assign production people so he wants to label 4 dept seperately — Carpentry, Painter, Metalwork, Printing — instead of production pill where it lumps everyone together" · then "Add electrician pill too" · "put back designer pill too" · "put it inbetween scheduler and coordinator"

- Live users table read first (read-only REST): 15 active production staff; subroles Carpenter ×3, Senior Carpenter, Assistant Carpenter, Painter ×2, Metalwork ×4, Printing ×3, Electrician (Thoa). Nic asked "any name missing from production?" — none: 5 / 2 / 4 / 3 / 1 = 15.
- `DEPARTMENTS` + `departmentOf` in `user-meta.ts`: matched on the subrole's **wording** (`carpent`, `paint`, `metal`, `print`, `electric`), because subroles are free text typed in Admin. A label fitting none stays under All only.
- `SUPPORT_CREW_ROLES` is now an explicit list in pill order: scheduler, **designer**, coordinator, installer, production. Pills (`SUPPORT_CREW_FILTERS`): All · Scheduler · Designer · Coordinator · Installer · Carpentry · Painter · Metalwork · Printing · Electrician. `supportCrewPool` takes a role or a department.
- Designer back reverses that part of 2026-09-28; `getSupportUsers` already loaded designers, and the support-crew routes are role-agnostic (verified 2026-09-04).
- zh pill names 木工 · 油漆 · 金工 · 印刷 · 电工.

## 4 — Checks

- Every rule test-first, watched failing against empty placeholders: `my-jobs-search` (14), `schedule-search` (13, incl. "THE BUG: a job on another date is found while you stand on today"), `user-meta` departments (7), designer back (5). Department tests use the real names and labels.
- 63 suites green (61 at start); type-check + production build clean each time; new classes (`line-clamp-2`, the three soft tints, `bg-punct-*`, `text-inherit`, etc.) confirmed in the built CSS.
- Every dev preview and production flip verified by hashing the commit against `/api/version`; release times decoded from `x-vercel-id` at the flip (17:21, 20:46, 21:22 SGT). Probes `/login` 200, `sin1`.
- Not run by Claude in a real browser — Nic checked each on the dev preview before saying "push to main".

## 5 — Process notes

- **Each changelog push needed its own "push to main"**: the auto-mode classifier blocked the follow-up production push in the same turn, twice. Memory updated: commit the What's new entry to dev and ask, or let it ride with the next release.
- Popup reopens only on a new DATE, so people who closed today's popup after 17:21 won't see the 20:46 / 21:22 additions pop up — they can open What's new from the profile menu (told Nic; one entry per date kept).
- Three stale checklist boxes ticked (What's new popup, V3 folder, Aydan backup window passed).
- Visual companion mockups under `.superpowers/brainstorm/` (git-ignored); server stopped.

## ⚠ Next session

- Away test list still untested (top of Pending).
- Job stages: the scheduler crew-on-push check on the live app.
