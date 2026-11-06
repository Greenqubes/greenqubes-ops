---
session: feat-jobs (To arrange — sales marks a job ready, the scheduler offers a date, sales confirms with the client)
date: 2026-11-04 → 2026-11-06
branch: feat-to-arrange (scratchpad worktree) → dev → main; GitHub branch deleted 6 Nov with Nic's OK
migrations: 0068_job_arrange.sql (applied 2026-11-05, before any code push)
release: 5b7adfc live 13:07 SGT 6 Nov (build 6508408cd81d); changelog 71d9cf7; c20d4b0 live 17:58 SGT (build 3af030b903ad) — My Jobs panel + 4pm check; Change date link c745f5a built after that (see the end)
status: LIVE — round trip, panel section and 4pm check on production
---

# To arrange

Session start ran in full on 4 Nov. The auto-fixer session ran in parallel on the same folder, so this was built in a scratchpad worktree and held, on Nic's call, until that session had finished. It was then merged on top of the auto-fixer's work and re-checked.

## The ask

Between Ongoing and Scheduled there was no hand-off. Sales messaged the scheduler; the scheduler guessed a date; nobody recorded whether the client had agreed. Nic wanted the round trip inside the app:

- **Sales** marks an Ongoing job **Ready to install**. They give a rough day (between two days, a fixed day, or any day), a time (end optional) and a note.
- **The scheduler** offers a date, time and crew, or sends it back ("Can't fit") with a reason.
- **Sales** checks with the client. **Client OK** puts it on the schedule with that crew confirmed; **Client said no** sends it back with the reason.
- **Nothing shows on the schedule before the client agrees.**

Spec: `docs/superpowers/specs/2026-11-04-to-arrange-design.md`. Plan: `docs/superpowers/plans/2026-11-04-to-arrange.md` (10 tasks, run inline, one fresh whole-branch review at the end).

## What was built

- **Not a status.**
  - The job stays raw `awaiting_date` (Ongoing). `jobs.arrange_state` (`needs_date` / `offered` / `no_fit` / `clash`) and `jobs.arrangement` jsonb (guide, offer, last reason) carry the step.
  - The constraint `jobs_arrange_only_ongoing` refuses a value on any other stage. **Any path that moves a job off Ongoing must clear both** (`arrangeClearPatch`, already in `/submit` and `/stage`).
- **One route, one lock.**
  - Every button goes through `POST /api/jobs/[id]/arrange`. That runs `parseArrangeAction`, then `src/lib/arrange/actions.ts`.
  - Every write is conditional on the `updated_at` the screen saw, so a stale tab gets a 409 instead of answering a newer offer.
  - `/submit` also refuses (409 `offer_with_client`) while an offer is out.
- **Only the scheduler confirms crew.**
  - Sales' picks, outside contractors included, stay suggestions.
  - Client OK confirms exactly the offer's crew and re-checks clashes. A new clash sends the job back to the scheduler as "Client agreed — crew clashes"; he fixes the crew and pushes.
- **Alerts** (`src/lib/arrange/notify.ts`, bell + Telegram):
  - Schedulers hear about ready, client said no, clash and client OK.
  - The sales PIC and coordinators on the job hear about offered, couldn't fit and withdrawn.
  - At Client OK, drivers get the usual assigned message and support crew get theirs.
- **Jobs tab:**
  - It reads Drafts · Ongoing · To arrange. Schedulers open on To arrange; everyone else opens on Ongoing.
  - Old `/ongoing` and `/pending` links go to `/job-list?view=ongoing`.
- **Nic's call (4 Nov): a proposed date is not an install date for designers.** Offers and Saves on a To arrange job leave `date` out of the design update, so there is no due-date shift, no designer message and no rescore. Push to Schedule is unchanged.

### Added on 6 Nov, after the release

- **My Jobs side panel** ("this side panel need to include a To arrange as well"):
  - To arrange jobs get their own soft-green section between Ongoing and Scheduled, and leave Ongoing.
  - Tapping one opens the To arrange list with that job highlighted.
  - The rule lives in `myJobs` (`src/lib/utils/my-jobs.ts`); search covers the new section too.
- **The 4pm "Jobs still to arrange" Telegram** (to schedulers, admin and Nic):
  - It now ends with a To arrange part listing the jobs waiting for a date: who the sales person is, how long they have waited, and sales' guide. It then counts the ones back with sales.
  - With no driver gaps, the old all-clear stays word for word unless To arrange has jobs.
  - Built by `arrangeSummaryFrom` in `src/lib/telegram/day-summary.ts`.
  - Every per-step message already existed, so nothing else needed a Telegram. The 6pm installer message, design-daily, overdue and Monday digest were checked and need no change.
- **Change date link** ("allow scheduler to revert his selection of date cuz he might insert wrongly"):
  - **Withdraw offer** already did this on the job page. Nic had not seen it because his account is sales.
  - On a card that is waiting on the client, the scheduler now sees **Change date →**. It opens the job straight at the take-back step, worded for a wrong date.
  - The job goes back to Needs a date with his crew kept. He sets the new date and offers again. Sales gets the usual "offer withdrawn" message, then the new offer.
  - Admin, being both sides, keeps "Answer →". No server change was needed.

## How it was checked

- **Whole-branch review:** a fresh reviewer read the whole branch at the end. Five findings were fixed, each with a test that failed first:
  - Withdraw was blocked by the scheduler's own offer reading as unsaved work.
  - A stale screen could answer a newer offer.
  - Contractors that sales had only suggested got confirmed at Client OK.
  - A multi-day fixed-day job couldn't get an end date.
  - The crew could be Telegrammed about a day that had already passed.
- **Test site:** Nic tried it on 5 Nov ("looks good").
- **Production:** each release was confirmed by hashing the pushed commit against `/api/version`, and the changelog time came from the deployment's own `x-vercel-id`.
- **Suites:** 82/82 pass, types are clean, and the build passes, for both the 17:58 release and the Change date link.

## Rulings (calls made during the build)

- `/submit` also refuses while an offer is with the client, not just hides the button.
- On the To arrange list, bulk-delete tick boxes are off. Deleting stays on the job page.
- Roles without drafts get the switch too (Ongoing · To arrange), so they can reach the list.
- Locked date fields use read-only, not disabled. A disabled box can drop out of the form, and a later Save would blank the date.
- Crew picks refilled from an offer don't count as unsaved work until touched.
- If saving the crew fails at Client OK, the undo puts the job back to Offered, but sales' original crew suggestions are not restored. The offer itself is intact.
- At Client OK, a contractor link removed by a manager after the offer doesn't block the client's yes.

## Deferred (none urgent; also in Nic's checklist in plain words)

- Pushing while an offer is out is refused with a general error, not the clear message written for it.
- An old open tab that changes the date while an offer is out leaves Client OK saying only "reload".
- A database hiccup reads as "someone changed this, reload". Typed times aren't checked for a proper format.
- Support crew on leave aren't flagged at offer time; drivers are.
- Editing sales' guide clears the client's last reason and the refilled crew. Editing while offered tells the scheduler "Ready to arrange", not "offer withdrawn".
- Client OK doesn't send "Installer Assigned" to sales and coordinators, nor record crew-change events.
- Clash cards say "Offer a date →" when the real step is fix the crew and push. There's no bell for the scheduler when a To arrange job is moved to Drafts or deleted.
- The Client OK undo path doesn't check its writes. The read-only date box hasn't been checked on an iPhone.

## Deploy notes

- **Migration 0068 had to be applied before any deployment of this code.** It was (5 Nov). 0069, the auto-fixer's, went in from its own session the same day.
- **Rolling back needs the data cleared first:** `update jobs set arrange_state=null, arrangement=null where arrange_state is not null`. Otherwise older code can't move those jobs.
- The scratchpad worktree `wt-arrange` and its ledger are removed at session end.
