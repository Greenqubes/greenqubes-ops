---
session: feat-jobs (4pm message checked; Support crew filter + Support crew on New Job)
date: 2026-09-28
branch: feat-support-crew-filter (scratchpad worktree, deleted) → dev bbea8bf → main (fast-forward)
migrations: none
release: 21:01 SGT
---

# One investigation, one small build

## 1 — "The 4pm message is misfiring" — it was not

The scheduler said Charles had arranged crew for "Headboard and Bedframe
Catalogu", yet the 4pm "jobs still to arrange" message kept listing it.

Read-only against the live DB:

| When (SGT) | Evidence |
|---|---|
| Fri 25 Sep 11:38 | `created_at`, and `scheduled_at` one second later — pushed straight onto the schedule |
| Fri–Mon 16:00 | four `day_summary_cron` rows; the run reads live crew each time |
| Mon 28 Sep 16:35:09 | `jobs.updated_at` — the only later save |
| Mon 16:35:10–12 | three Telegram sends in `api_usage_logs`, matching that save to the second |

A confirmed driver at any 16:00 would have kept the job off the list, so
the message was right every day. The likely story: Charles is `sales`, his
picks are **suggestions**, and the 4pm check ignores suggestions on purpose.
It cannot be proven — `assign-installers` deletes suggestion rows when a
scheduler confirms.

Nic declined a "suggested by" line in the message. Left as is.

**Seen on the way:** the 6pm installer run reported `installerSent: 0` on
27 and 28 Sep — nobody received it. The known Connect Summary gap, not code.

## 2 — Support crew filter

Buttons under the Support crew heading, like Admin → Users: **All ·
Scheduler · Coordinator · Installer · Production**. No subrole dropdown
(Nic's pick). **Sales, HR / Finance, Admin and Designer are removed from the
list itself**, not just from the buttons. This replaces the 2026-09-07
request for trade pills (Carpentry, Metalwork…) and keeps Coordinator in.

The one subtlety: anyone **already on the job's crew** stays listed under
All, whatever their role, or an earlier pick could never be taken off. That
is in the rule (`supportCrewPool(users, role, keepIds)`), not the UI, and the
test asserts it. `SUPPORT_CREW_ROLES` is the single list; `getSupportUsers`
still fetches wider on purpose so those kept people can be resolved.

## 3 — Support crew on the New Job form

Same `SubInstallerBucket`, same rules as Drivers on that form:

- sales / coordinator suggest, scheduler / admin assign;
- picking someone as a driver removes them from Support crew — one
  `job_assignees` row per person per job (the primary key);
- **no Telegram at creation**, matching Drivers there;
- a failed crew insert is **reported, not thrown**. The job already exists;
  landing in the catch would leave the person on the form, one tap from
  saving a duplicate.

No RLS change needed: the 0034 insert policy checks role only.

## 4 — The changelog commit did not deploy

After the release, the other session merged its job-bin work into `dev`.
Promoting `dev` again would have shipped the bin, so the docs + changelog
commit went onto `main` alone by cherry-pick (`723890e`). **Its Vercel build
failed, and so did the same commit on `dev`** — while the commits beneath it
built, and it builds cleanly locally. The log was not readable from here:
the Vercel CLI is signed into Nic's personal scope, not the team. Unconfirmed
guess: the Hobby daily deployment limit after a heavy day of pushes from two
sessions. Production kept serving the good build throughout.

Nic will redeploy `dev` → `main` in one shot through the job-bin session.

## Facts worth keeping

- **`job_assignees` has no timestamp.** "When was this person put on the
  job" can only be inferred from `jobs.updated_at` plus `api_usage_logs`,
  which carries no job id. Worth a column if it is asked again.
- **The 4pm check counts only a confirmed driver** — support crew, a sales
  suggestion or an outside contractor all leave a job on the list.
- **A worktree's `node_modules` cannot be removed by `git worktree remove`
  on this machine** ("Filename too long"). Empty it with `robocopy <empty>
  <dir> /MIR`, delete the folder, then `git worktree prune`.
- **When `dev` carries someone else's unreleased work, ship docs to `main` by
  cherry-pick**, never by promoting `dev`.

## ⚠ Next session

- **Confirm the What's new entry reached production** (21:01, three Support
  crew lines) after the job-bin session's promotion — and that session must
  ADD its lines to the same 2026-09-28 entry, not create a second one.
- External installers on the New Job form — still missing.
- Cron firing for job-form changes (from 2026-09-17), unchanged.
