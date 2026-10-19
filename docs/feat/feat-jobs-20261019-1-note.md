---
session: feat-jobs (Job stages — Draft / Ongoing / Scheduled, Jobs tab, My Jobs panel)
date: 2026-10-09 → 2026-10-19
branch: feat-job-stages (main folder) → dev → main
migrations: 0064_job_status_awaiting_date + 0065_job_stages (applied 2026-10-14, --include-all, on Nic's OK); 0067_attach_files_any_office_role (applied 2026-10-19, on Nic's OK)
release: dev → main 40f1bfe, live 18:49 SGT 2026-10-19; changelog 83afc50
status: LIVE — production checks with real logins are on the checklist; Nic to tell the team old pending jobs are now Drafts
---

# Job stages: Draft → Ongoing → Scheduled → Completed

> Nic's screenshot: "Quick link panel of listed inserted jobs by sales (persistent), when clicked will jump to the schedule page to the date where the job is at." Then a sales colleague's question: "if i ever get a project with no confirmed date yet … shouldnt i be able to create that job first, then assign designer to do its work first while waiting for client confirmation on the job installation date?"

The AI-importance question was skipped at Nic's request. Bryan skipped per CLAUDE.md. Work ran on a new `feat-job-stages` branch in the main folder ("new dev branch will do", company closed). A parallel session shipped Away (0066) on 2026-10-12, so 0064/0065 went in with `--include-all` after merging `dev` in.

**Side question, same session — QQ email.** Chinese staff use QQ email, and Google sign-in can't find a QQ address. Suggested: create a Google account using the QQ address. Nic is letting them try. Fallback if it fails: a sign-in by emailed code (not built). It's on the checklist under Only you.

## 1 — Decisions (Nic)

| Question | Answer |
|---|---|
| The Pending tab | Its purpose was "defeated" — split into **Draft** and a new office stage |
| Draft | A **private notepad**: the same job form, **no field restrictions**. Seen by its sharers only (0062, unchanged) |
| Ongoing (was "Pending" until 2026-10-14) | Client confirmed, **date optional**, **seen by everyone in the office**, designers can start; designer-assigned Ongoing jobs show on the Design tab |
| Scheduled | Unchanged: needs a date and the required fields; the scheduler assigns crew |
| Tabs | First Drafts + Ongoing as two tabs, then **combined into one "Jobs" tab**: [Ongoing \| Drafts] switch, opens on Ongoing, +New inside |
| My Jobs panel | On Schedule **and** Jobs. Arrow to hide/show. Sales/coordinator/scheduler: their own jobs + jobs they're PIC on; completed drops off |
| Jump behaviour | Jump to the date, scroll **only if the card is off screen**, wait for the scroll to stop, then **blink twice at 0.6s** |
| Panel headers | Larger, bold, with a count |
| Designer panel | Jobs **assigned to them**, Ongoing and Scheduled, until completed |
| Scheduler/admin panel | **[Mine \| Not scheduled]** — Not scheduled = their own drafts + every Ongoing job in the company. The company's scheduled jobs left out: "wont it flood his side bar?" |
| Files | Every role but installers may attach on **Ongoing + Scheduled**; any designer may also rename and delete |
| Separate test database | Idea added to the checklist (Supabase Branching vs a second free project) — not built |
| Auto-mode pushes | Claude may push `feat-*` and `dev` itself; `main` still needs "push to main" |

## 2 — What was built

Spec [2026-10-09-job-stages-design.md](../superpowers/specs/2026-10-09-job-stages-design.md) (carries banners for the 2026-10-14 rename and the Jobs-tab combine); plan [2026-10-09-job-stages.md](../superpowers/plans/2026-10-09-job-stages.md); ledger `.superpowers/sdd/2026-10-09-job-stages/progress.md`. Built from a 13-task plan, then follow-ups from Nic's preview checks.

**Data**
- **0064**: enum value `awaiting_date` (= Ongoing).
- **0065**: `jobs.date` nullable + check `jobs_date_required_when_scheduled`; sales UPDATE policy includes `awaiting_date`; `stamp_r2_folder` falls back to 'undated'.
- **0067**: `files` INSERT for designer + hr on `awaiting_date`/`scheduled` jobs, kinds attachment/url_link (0060 already covered production).
- Numbers claimed against the live DB and every branch (remote max 0063 at the time; 0066 later taken by Away).
- Counts before = after the apply (2026-10-14): pending 10, awaiting_approval 0, scheduled 30, completed 84. A real-row check inserted an undated Ongoing job, confirmed the 'undated' folder, a refused undated Scheduled job (23514), and a Bin round trip — all cleaned up.

**The rules** (pure, tested)
- `src/lib/utils/job-stage.ts` — the ONLY status → stage mapping (raw `pending` is a Draft).
- `src/lib/utils/job-stage-rules.ts` — required fields per stage, valid moves, who may move/edit/delete, `pendingLocks`, `stageWriteVia`, `stageMoveBlocked`, `newJobPlan`.
- `src/lib/utils/my-jobs.ts` — the panel lists (mine / designer / scheduler).
- `src/lib/storage/job-file-permissions.ts` — `canAttachFiles`.
- `src/features/schedule/job-jump.ts`, `my-jobs-panel-box.ts`, `src/features/stages/stage-view.ts`.

**Routes**
- `POST /api/jobs/[id]/stage` — the only way to move between Draft and Ongoing (and Scheduled → Ongoing). Crew writes on the service key after the status update; Scheduled → Ongoing removes formal crew + contractors and tells the day's crew if the job is today (`tplJobPostponed`); failures undo the move.
- `/submit` 422 without a date; crew routes refuse formal crew on Ongoing; designers refused on a Draft; suggest-installer opened to scheduler; clashes 422 for undated jobs.

**Screens**
- Jobs tab at `/job-list` (`StageListShell`); `/pending`, `/ongoing`, `/drafts` redirect there. Nav tab "Jobs" for every role but installers.
- Job page: `StageActions` (Save as Ongoing / Move back to Drafts / Move back to Ongoing — the last clears the date and the crew), "Save your changes first" before a move, undated save.
- New Job: Save draft / Save as Ongoing / Push to Schedule; designers attached after a push.
- `MyJobsPanel` on Schedule + Jobs; z-[25] under the top bar on PC so the profile menu shows over it; content shifts left when open.
- Telegram and the bell cope with no date ("To be confirmed"); the assistant knows the four stages.

## 3 — Reviews (fresh Opus reviewer, twice)

**Round 1** — 3 Critical + 5 Important fixed, each test-first: an undated save failed; designers locked out on Ongoing; New Job push dropped designers; Delete shown on Ongoing; Ongoing → Draft by a non-sharer gave a 500; designers stranded on a Draft; the bell showed raw JSON for undated jobs; the assistant still said "Pending tab". One release ruling: apply migrations, preview, dev and main on one evening, because old production code reads the shared DB.

**Round 2** — no Critical/Important; four re-graded by effect and fixed: hidden ticks carried across the Ongoing/Drafts switch (bulk delete could bin unseen jobs); the panel broke when a PC window crossed 1024px; the assistant said "Save as Pending"; a crafted `?highlight=` link crashed the page.

## 4 — Caught by Nic on the preview

- Panel icons sat on top of the page and the bottom nav got pushed in → the panel is measured between the top bar and the bottom nav.
- Blink too fast, then too slow; it started while still scrolling → 0.6s, after the scroll settles, scroll only if needed.
- Profile menu hidden under the panel → panel layered below the top bar.
- "Pending" renamed **Ongoing** everywhere (UI, i18n, assistant).

## 5 — Release

1. 61 suites green; type-check and build clean.
2. 0064 + 0065 applied 2026-10-14; 0067 applied 2026-10-19 — all before the code reached production.
3. `feat-job-stages` → `dev` (preview verified by `/api/version` hash) → `main` `40f1bfe` (35 commits, fast-forward). Production `/login` 200; `/job-list`, `/schedule`, `/ongoing` 307.
4. Release time **18:49 SGT**, from `x-vercel-id` epoch 1792406957136.
5. Changelog entry 2026-10-19 (3 heads-up, 6 added) as `83afc50`; production flipped to `df35d1ab1c98`.

## 6 — Deferred minors (logged, not fixed)

- A postponed job is marked "crew told" even if the Telegram send fails.
- The stage-route undo doesn't re-add crew if the contractor delete fails after the crew delete.
- A clash swap during a push adds formal crew while the job may still be a Draft; if the push then fails, an installer could see it.
- Designers aren't told "install date removed" when a job goes back to Ongoing.
- zh "待定" sits where a date goes (dates-always-English rule).
- The panel's arrow tab (z-[61]) sits above other z-[60] pop-ups on a phone.
- The postponed message links removed crew to a job they can no longer open.
- An undated Draft with a contractor shows under "past" with a blank date on the contractor page.
- 0067 doesn't pin `uploader_id` to the signed-in user (same as 0050).
- Switching Ongoing/Drafts re-runs the page's queries; tapping the same panel job twice doesn't re-blink; `?highlight` stays in the URL.
- Away notifications still check `awaiting_approval` (now a Draft status; 0 rows).
- A few stale comments ("a Ongoing", etc.).

## ⚠ Next session

- **Nic to tell the team:** the Pending tab is now Jobs; the 10 old pending jobs are Drafts and stay private until moved to Ongoing.
- **Production checks with real logins** are at the top of Pending on the checklist (the Away test list is still below it, untested).
- QQ email: wait to hear whether a Google account on a QQ address works.
- `feat-job-stages` is fully merged; keep or delete on Nic's word.
