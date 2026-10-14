---
session: feat-hr (Away — courses & business trips)
date: 2026-10-09 → 2026-10-12
branch: feat-away (scratchpad worktree) → dev → main
migrations: 0066_away_trips (applied 2026-10-12, on Nic's OK, before any code deployed)
release: dev → main f9cb986, live 18:16 SGT 2026-10-12; changelog + checklist 6c457f9
status: LIVE, NOT YET TESTED BY NIC — test list is first under Pending on the checklist
---

# Away: staff on courses and business trips

> Nic: "Add another box which allows HR to insert staff that goes on course or away for whatever business / work related trips." On the schedule it "appears below On Leave Column — shows employee name + title as 'Away'. Clicking it will open a pop up and show more details."

A parallel Claude session held the main folder on `feat-job-stages` throughout. All work was done in a scratchpad worktree, and that session was never touched. The AI-importance question was skipped at Nic's request.

## 1 — Decisions (Nic)

| Question | Answer |
|---|---|
| Scheduling someone during a trip | **Amber warning only**; the scheduler can still assign |
| Several staff on one trip | **One trip, several people** |
| Timing | **Exact start date + time → end date + time** |
| Notifications | **Same as leave**: bell to schedulers on every new or changed trip; bell + Telegram to schedulers, PIC and coordinators when a trip lands on a job someone is formally on |
| Where it shows, and to whom | **Everywhere leave shows, every role**, installers included |
| Build shape | **Its own list alongside leave**; leave code untouched |
| Touching edges (trip ends 2pm, job starts 2pm) | **No warning** |
| Editing a trip | Re-notify **only newly affected** people and jobs |
| Form fields | Staff going\*, title\*, business, address (Google search), start\*, end\*, note |
| Release | Merged to main **before** his test ("I'll test it next time"); test list goes on the checklist and is raised at session start |

## 2 — What was built

Spec [2026-10-09-away-trips-design.md](../superpowers/specs/2026-10-09-away-trips-design.md); plan [2026-10-09-away-trips.md](../superpowers/plans/2026-10-09-away-trips.md). Built inline from an 11-task plan (`executing-plans`), test-first wherever the code is pure.

**Data**
- Migration **0066**: `away_trips` + `away_trip_people`.
  - RLS: every signed-in user can read; only `can_manage_leave()` can write.
  - Grants to `authenticated` + `service_role`, never `anon`.
  - Both tables added to realtime.
- Number **0066**, claimed against the live DB (0063) and every branch: the parallel `feat-job-stages` already held 0064 and 0065.

**The rule**
- `src/lib/utils/away-overlap.ts` holds the single "is this person away during this job?" rule.
- It also provides the date-by-date strip, the picker set, the English date label, and the before/after pair diff for edits.

**Write routes**
- `/api/away` and `/api/away/[id]`, HR and admin only via `guardHr`.
- Every write checks that a row came back.
- Validation lives in `away-validate.ts`.

**Notifications** (`away-notify.ts`, awaited and best-effort)
- One message per job, naming everyone on the trip who is on that job.
- The Telegram text is HTML-escaped.

**Screens**
- Leave page: Away card and the Add/Edit trip form.
- Schedule (List, Drivers, Week, Month), FCFS and the installer page: an amber `AwayStrip` under On leave, a tap-for-details pop-up with Open Maps, and an amber calendar dot.

**Warnings** (amber, never counted as a clash)
- Push-to-Schedule pop-up, edit-save pop-up, FCFS assign panel, Drivers-board drag pop-up and the Bin's restore check.
- FCFS: an amber bar outline, chip and drawer entry.
- An amber "Away" tag on the Drivers and Support crew pickers.
- The assistant's `check_clashes` reports trips as "warning only".

## 3 — Final review (fresh Opus reviewer)

0 Critical, 3 Important, 10 Minor. All five Review Focus cases passed: midnight end, all-day job, no-op edit, last person removed, and coordinator on an away-only warning. Fixed in one pass, each with a test watched failing first:

1. **Telegram volume.** Messages went out per (person, job), so 3 people on 2 jobs sent 6 each. Now `groupPairsByJob` sends one message per job, naming everyone.
2. **A part-failed edit lost its notifications.** On a retry, the new dates read as "before". The route now re-reads the trip and notifies before it returns the error.
3. **Warning-only reads could break core pages** (e.g. a missing table on /schedule). Those reads now go through fail-soft `orEmpty`. The Leave page stays strict.
4. **Re-graded from Minor:** the edit pop-up said "Clash detected" when the only issue was an away warning. It now says "Heads-up before saving".

## 4 — Caught by Nic on the preview

**The Add trip pop-up ran off the top and bottom of the screen.**
- **Cause:** the shared `Modal` has no height cap.
- **Fix:** an opt-in `scrollBody` (max height = visible screen, body scrolls, title stays). Only the trip form uses it.
- **Why opt-in:** an overflow container clips any dropdown that doesn't portal to `<body>`, and 11 other modals were not audited.
- **Verified** in headless Chrome against the real compiled CSS at 605px usable height: before −317..922px, after 16..589px.

## 5 — Release

1. 51 suites green (46 before + `away-overlap`, `away-validate`, `away-template`, `edit-clash-rules`, `or-empty`). Type-check and build clean. New amber, ring and height classes confirmed in the built CSS.
2. Migration 0066:
   - Dry-run showed only 0066 pending; then applied.
   - Probed afterwards: service role 200; an anon write is refused `42501`; an anon read returns `[]`.
   - The anon read still reaches the table only through Supabase's default grants, which end 30 Oct. RLS shows it no rows.
3. Branch preview verified by `/api/version` hash. The `git push` was first blocked by the auto-mode classifier; Nic then allowed it.
4. Fast-forward `feat-away` → `dev` (verified) → `main` `f9cb986`. Production flipped to `2b1450939704`; login 200, pages 307, `/api/away` 403, `sin1`.
5. Release time **18:16 SGT**, from `x-vercel-id` epoch 1791800219629.
6. Changelog entry dated 2026-10-12 with three added lines, shipped with the checklist reminder as `6c457f9`. Production flipped to `ace07fc2a5d5`.

## 6 — Rulings made during the build (from the ledger)

**Process**
- DB push deferred until Nic's OK; tasks 3–10 needed only type-check and build.
- Dev-server click-throughs deferred to the preview, because the tables weren't on the DB yet.

**Tests and refactors** (cost if wrong: none)
- Extra tests written first where the plan had none: `away-validate`, `away-template`, a `tool-schemas` case.
- Pure helpers pulled out of components: `buildAwayByDate`, `awayIdsFor`, `editClashActions`.

**Form**
- Save button uses the accent (green) style.
- Picked people stay visible while searching.

**Robustness**
- `ClashResolutionModal.awayClashes` is optional, so a stale tab can't crash it.
- `AssignmentPanel` now clears leave and away prompts when a different job opens.
- The assistant tool description changed, so the prompt cache rebuilds once per user. `SYSTEM_PREFIX` is untouched.

**FCFS**
- The amber outline is skipped on bars already red for leave or a hard clash.
- Away entries sit last in the drawer, with no Re-assign button.
- Chip text comes from a small `chipLabel` helper.

## 7 — Deferred minors (logged, not fixed)

- A scheduler bell goes out on every trip edit, even one that changes nothing.
- The strip shows **one line per trip**, not one per person as the spec says. **Nic to confirm** (on the checklist).
- Trips over 62 days drop off the strip and dots after day 62 but still warn; there is no length cap.
- A deactivated person left on a trip can't be unticked in the form.
- Support crew get the picker tag but no save- or drag-time warning (the same as leave today).
- Every trip ever entered is loaded (the same as leave).
- The drag pop-up warns on every drag of a job with an away crew member.
- FCFS builds the by-date lookup twice per render.
- If the re-read after a successful create fails, HR sees an error and may create a duplicate.
- Other tall modals (e.g. the Leave form on a phone) may still overflow until they opt into `scrollBody`.

## ⚠ Next session

- **Raise the Away test list first.** It's at the top of Pending on the checklist.
- **Tell the `feat-job-stages` session:** its 0064 and 0065 now sit below the applied 0066. `npx supabase db push` will refuse until it is run with `--include-all`.
- The scratchpad worktree is removed at this session's close.
