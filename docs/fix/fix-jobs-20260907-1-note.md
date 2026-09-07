---
session: fix-jobs (live-issue day — permissions, Drivers bucket, silent-write class bug, changelog popup)
date: 2026-09-07
branch: dev (3f9bc0f) — main fast-forwarded 3× to 716b838; migrations 0054, 0055, 0056 applied
---

# Seven fixes to production, and one bug wearing three costumes

> Nic worked live issues reported by his team and directors. Three of the
> reported bugs turned out to be the same root cause in different places.

## 1 — The bug of the day: a refused write is not an error

**This is the thing to remember from this session.**

`supabase.from('jobs').update({...}).eq('id', id).throwOnError()` looks safe.
It isn't. When RLS filters the row out, PostgREST returns **204 with no rows
and no error** — so `.throwOnError()` passes, the form resets, and the UI
reports "Saved successfully" over a write that never happened.

It surfaced three times today, in three different reports:

| Where | What the user saw |
|---|---|
| `saveValues` (job form fields) | The director's "says saved, doesn't save" — every field on a scheduled job |
| `handleStatusChange` (status transitions) | Would have hidden a refused close |
| `POST /api/jobs/[id]/submit` (server route) | Push-to-Schedule on a completed job: success, no write, **and a Telegram to every scheduler** |

Fix in all three: ask for the row back with `.select('id')` and treat an empty
result as a failure. The client throws `SaveBlockedError`, reported as a
distinct "you don't have permission" message rather than the generic retry.

**Anywhere a client-side write meets a policy, this trap exists.** It is now
recorded in `docs/CONTEXT.md` as a standing lesson.

## 2 — The permission fixes (migrations 0054–0056)

- **0054 — sales manage coordinators again.** `0029` granted sales
  INSERT/DELETE on `job_coordinators`; `0034`'s Workflow V2 pass dropped and
  recreated those policies as `(scheduler, coordinator, admin)`, losing sales,
  while *widening* SELECT to include them. So the chips displayed and every
  save failed. The job form never agreed — `canEditCore` includes sales.
- **0055 — sales edit their OWN scheduled job.** `0036` had split USING from
  WITH CHECK so sales could push a job *to* scheduled, but left USING at
  `('pending','awaiting_approval')`. The moment a job was scheduled it left the
  sales row set. Sales also joined the read-only clash pre-flight coordinator
  already had (`assign-installers?checkOnly`), so moving a date warns instead
  of silently double-booking.
- **0056 — sales and assigned coordinators close their own jobs.** The overdue
  reminder goes to the sales POC, so they were nagged about jobs only the
  scheduler could finish. Added `'completed'` to WITH CHECK only — USING stays
  without it, so a completed job leaves the sales row set and the way back is
  the Revert button (that route allows every role except installer).

**Coordinator scope is UI-only, on purpose.** `0037` grants coordinator **and
production** blanket `jobs` UPDATE with no job or status limit. Narrowing it to
assigned jobs would cut off the **15 production staff** sharing that policy.
That migration's own comment says coordinator limits are enforced in the form,
so this matches the existing model rather than inventing a weaker one.

## 3 — Drivers bucket, and the escalation that was avoided

The job form's **Installers** bucket is now **Drivers** — only `is_driver`
users (3 of 7). The other 4 moved to **Support crew**, which is already
clash-exempt and already Telegrams new members (`tplSubInstallerAssigned`).

An intermediate version of this request would have made Support crew
clash-checked. Exploration killed it: **62 decision points across 12 files and
four separate copies of `timesOverlap`** (job-form clash route,
assign-installers, ClashResolutionModal, assistant `check_clashes`) — and it
would have collided with the HR/leave plan, which opens those same four
surfaces to add leave as a hard clash. Nic's clarified rule (clash-check
drivers only, Telegram the rest) needed none of it.

**Data migration:** those 4 held **17 main-crew assignee rows across 7 jobs, 5
of them upcoming**, which would have rendered in neither bucket. Flipped to
`is_sub_installer = true` — dry run first, 4-user allowlist, reversible
snapshot; whole-DB main-crew rows 32 → 15, delta exactly −17. Safe against the
`(job_id, user_id)` primary key, which makes a duplicate impossible.

Consequence accepted: the FCFS board now shows 3 driver rows instead of 7.

## 4 — Role filter on the people pickers

Person-in-Charge and Sub POC both listed every non-installer with only a name
search. Both now carry a role filter.

**A compact native `<select>`, not pills** — the mockup made the case: that
dropdown is a fixed **224px wide AND 224px tall**, identical on phone and
desktop, so seven pills need ~288px and wrap to two rows, eating ~58px of the
height the names were using. Same control as the admin subrole filter, and on
a phone it opens the OS picker. Mockup published and approved before any code.

`ROLES` moved out of `UsersTab` into `user-meta.ts` so the admin filter bar and
both pickers share one list — the coming `hr` role appears in all three at
once. It is NOT in `supabase/types.ts`: that file is regenerated from the live
DB and would drop a hand-written constant.

## 5 — Changelog popup (on `dev`, awaiting Nic's preview)

Nic's director asked for one. Content is **hand-written per session** in
`src/lib/changelog/entries.ts`, not generated from `bug_reports` — those
messages are raw reporter wording, often duplicated, and carry the reporter's
email. Good as a source to write from; bad to show the team.

**Nic asked for his template to be vetted, and three things changed:**

1. "Reported Bugs" and "Hotfix" both drew on the same two-state (open/fixed)
   bug data, so a bug reported and fixed the same day landed in both and the
   reader couldn't tell *we broke this* from *we know about this* → **Fixed**
   and **Known issues**, with open items **last** (a changelog answers what
   changed; leading with bugs makes a good release read badly).
2. **"Improved" added** — most of the day was neither a new feature nor a bug
   fix. Today's own entry was unwritable without it.
3. **"Heads up" added** for changes to how people work, shown first and tinted.
   Today's is the Drivers/Support crew move: without it someone opens a job
   tomorrow and thinks four installers vanished.

English only (Nic). Bullets render one step below the H3 as asked, but as a
real `<ul>` — literal `<h4>` per bullet makes a screen reader announce every
line as a heading.

## 6 — Two new hard rules in CLAUDE.md

- **Claim a migration number before writing the file.** Six consecutive numbers
  had collided. A duplicate is **silently skipped** by `db push` with no error —
  the file looks applied, its SQL never runs, and it surfaces later as a missing
  table. The rule requires `supabase migration list`, checking **every branch**,
  and *stating which number was taken* — the part that can't be quietly skipped.
- **Write the changelog whenever anything reaches `main`.** Gated on `main`, not
  `dev`. One entry per **date**, not per push — `date` is the seen-marker, so a
  second same-day entry re-nags everyone; bump `time` instead.

Also this session: `dev-bryan` skipped permanently at both ends of a session,
and the dead "Before Pre-Alpha Testing" / "Before Go-Live" checklist sections
removed (their live items already tracked under Team onboarding).

## Facts worth keeping

- **A refused UPDATE is not an error.** See §1. The single most reusable thing
  learned today.
- **`getEffectiveRole` never returns `'admin'`** — a plain admin resolves to
  `'scheduler'`, which is why `role === 'scheduler'` gates already cover admin.
- **`StatusSection.tsx` is dead code** — nothing imports it. The real
  Mark-complete button is inline in `JobDetailShell`. Don't be fooled by its
  role gating.
- **Derived flags must track live state.** `completed` read `job.status` (the
  page-load prop) while the pill read `status` (state), and
  `handleStatusChange` never calls `router.refresh()`. That mismatch is what
  offered "Push to Schedule" on a finished job.
- **Files created with the Write tool are LF; the repo is CRLF.** A find/replace
  script that converts `\n` → `\r\n` will silently miss every match in a
  freshly-written file. It also double-converted a literal `\r\n` inside a
  template string into `\r\r\n` and mangled `en.ts`/`zh.ts` — caught by the
  diff being 1101 lines instead of 1. Always check `git diff --stat` after a
  scripted edit.
- **`npx supabase db push` was blocked twice by the permission classifier**,
  having been allowed minutes earlier for the previous migration. Not a settings
  rule — just inconsistent. Ask Nic to re-run rather than routing around it.
- **Support crew is clash-exempt and gets `tplSubInstallerAssigned`;** the
  overdue Telegram goes to the sales POC + assigned crew ONLY (not
  coordinators), while the in-app bell **does** include coordinators.

## ⚠️ Next session

- **Nothing notifies the crew when a scheduled job's date moves** — true for
  every role, no Telegram template exists. Nic asked for this to be fixed;
  needs a short design first (who is told, what it says, whether the size of
  the shift matters).
- **Support crew role/subrole pill filter** (scheduler's request) — pills ARE
  right here, unlike §4's dropdown; this bucket is full-width. Seven pills:
  Installer, Production, Metalwork, Carpentry, Electrician, Painter, Printing.
  Two data notes: "Carpentry" is three values (`Carpenter`, `Senior Carpenter`,
  `Assistant Carpenter`) so one pill must match all three; the `Electrcian`
  typo **is now fixed** (verified — Thoa reads `Electrician`). Also exclude
  sales/designer/coordinator from that bucket, which partly reverses the
  2026-09-04 decision to widen it to all roles.
- **Support crew + External installers are missing from the NEW job form** —
  confirmed; the edit form has both. A job must be created and reopened before
  either can be added.
- **Merge the changelog popup** once Nic has read the wording (5 commits on
  `dev`).
- **HR/Finance role build** — plan ready and now reserves NO migration numbers
  (`<N>`/`<N+1>`, picked at implementation time).
