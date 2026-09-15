---
session: feat-jobs (job card rebuild, new-job attachments, driver-container design)
date: 2026-09-15
branch: dev → main (ee13414 / 424da9b, then dc35e36 / ae7fd91)
migrations: 0060 (designer + production off pending jobs) — applied
releases: 19:40 and 20:17 SGT
---

# A reported bug that never reproduced, and everything it uncovered

> The day opened on "7 jobs entered, 3 fell through". It was answered in
> minutes and never reproduced. What it produced instead was a redesign of the
> scheduler's board, nineteen changes to production, and four bugs of a single
> shape that nobody had reported at all.

## 1 — The reported bug: answered, not solved

Nic's question was exact and answerable: **is it in the database, or did it
fail to render?**

Neither guessing nor reading code would settle it, so the live DB did. Searched
by title, by client, by date, by "everything created today", on the service key
so nothing could be hidden by RLS: **four Arnotts rows existed, three had never
been written.** A save failure, not a display one. Nothing to recover.

Then the part worth recording: **it did not reproduce.** Nic worked his real
list while a 4-second poller watched `jobs`, `crash_logs` and vanishing rows.
Eighteen duplicates, eighteen successes, zero crashes, zero disappearances.

**The cause is still unknown and is written down as unknown.** Every mechanism
that could be ruled out was ruled out by evidence — a failed Duplicate cannot
delete a job it already created; no cron deletes jobs; the four source jobs had
no files, so nothing was timing out; both save paths are guarded by
`.select('id')` since 2026-09-07 and cannot report success over an empty write.
A confident story here would have been fiction.

**What the watching found instead was the real cost.** All eighteen were
Duplicates chained off one another, and each arrived carrying the PREVIOUS
store's address. That is a worse failure than the one reported: an unedited
copy looks finished, and two jobs at the same address are invisible on the
schedule. It became feedback item 14.

## 2 — Four bugs, one shape

The most useful thing this session produced is a class, not a fix. Each of
these is **code that reads as though a feature exists**:

| Found | Consequence |
|---|---|
| `NAV_TABS.admin` never reached — every page builds the nav from `getEffectiveRole`, which answers `'scheduler'` for a plain admin | Admins had no Pending tab and no Leave tab. `/leave` and `/assistant` had each patched around it locally, so it worked on exactly two screens |
| `StatusSection` rendered nowhere, replaced by the action bar | Schedulers and admins had **no Push to Schedule button on the edit form at all** |
| Job delete never removed R2 objects — `files` rows cascade, and then nothing remembers the keys | Every job ever deleted left its files in storage forever, including the 46 wiped in August |
| The schedule query never selected `is_sub_installer` | The card could not tell a driver from support crew, though the column has existed since 0033 |

None was reported. All four were found while doing something adjacent.

> A component existing, a column existing, or a config entry existing is not
> evidence the feature works. Check that it is *reached*.

`WorkloadPreviewModal` and `PendingFilesSection` were deleted alongside
`StatusSection` for the same reason: dead code is how the push button went
missing without anyone noticing.

## 3 — The silent-write trap, this time mine

Nic attached a file to a new job, saved, and the file did not arrive. The job
saved. Nothing said otherwise.

I could not diagnose it, because I had written it so it could not be
diagnosed — the attach call was `.catch(() => {})` with the response never
read. **An hour earlier, in the same feature, I had guarded the upload PUT
against exactly this**, and then left the next call open.

Every step was verified individually afterwards, against his real data: the
source object existed, copying it into the job's folder worked, the route was
reachable, the buckets existed, uploader and creator matched, and the exact
`files` insert succeeded (probe row removed). **So the cause is unproven.** A
hard refresh fixed it, which points at a stale bundle — recorded as likely, not
as fact.

An interaction I caused made that more likely: attached files now count as
unsaved work, so the app deliberately does *not* auto-refresh while one is
attached. Correct behaviour, and it pinned him to an old build during a session
of rapid deploys.

The fix that matters is not the cause: **the attach step now checks its
response**, counts what actually landed, surfaces the server's reason, and logs
`[attach-pending-files] …`. The wording says *re-attach* rather than implying
loss, because the file is still safe in the holding area.

## 4 — Item 5 designed, from two sketches

Flagged on 2026-09-14 as needing its own session; it got one, driven by Nic
against a live mockup.

**Three FIXED bands** — Mixed Drivers (2+ drivers) on top, the drivers across
the middle, Unassigned last. A band is always in the same place; a flowing grid
reshuffles as the day fills, so the scheduler would have to hunt. More drivers
push Unassigned *down*, never aside.

**Mixed Drivers is the piece that makes it honest.** A two-driver job otherwise
forces a bad choice: duplicate it into both columns, or file it under one and
leave the other's day incomplete. Its own band means it appears exactly once.

It fits the real crew: `is_driver` is true for exactly **Rintu, Xiao Yi, CK** —
checked against the live DB, not assumed — so three across on the scheduler's
confirmed 32" monitor is natural rather than a squeeze.

**The load-bearing decision is Nic's:** a drag Telegrams nobody. A scheduler
arranging tomorrow would otherwise buzz a phone ten times for a day that is not
settled, each message contradicting the last. Crew get a **6pm summary** —
**except jobs dated today, which notify immediately**. That exception is what
makes a quiet board safe, and it merged feedback item 11 into this one: two
summaries, scheduler and installer, not one.

Still open and named as such: hand-sorting inside a container (the list is
FCFS-ranked), and what happens when a job stops being shared.

## 5 — Shipped

Nineteen changes across two releases. The ones with a story:

- **The full address.** Truncated at `max-w-[150px]`, so since Google Places
  landed on 2026-09-11 the unit number and postcode were saved and then hidden.
  Nic's "I want to see full address" was a bug report, not a preference.
- **Whole names.** `name.split(' ')[0]` rendered "Xiao Yi" as "Xiao" and
  collapsed BOTH "Ali B" and "Ali Ramjan" to "Ali" — two real people, identical
  on the card.
- **Quiet push (admin).** The flag is client-supplied, so the server decides
  from the REAL role; `getEffectiveRole` never returns `'admin'`, which would
  have hidden the button from admins *and* let the check pass for the wrong
  people. The type checker then caught a bug that would have been invisible in
  review: passing the handler straight to `onClick` hands it the click event as
  the `silent` argument, and a MouseEvent is truthy — **every sales push would
  have gone out silently.**
- **Migration 0060.** Designer and production could SELECT every draft and
  merely lacked a link to the page; the screen and the DB disagreed, and Nic
  chose to make the DB match. Coordinator keeps pending — they create jobs.
  Consequence recorded in the migration itself: a designer attached while a job
  is still pending cannot see it, which is why the Design brief is now locked
  until the job is scheduled.
- **New Job attachments.** Nic picked the holding area over browser-held files:
  *"if pending job is discarded, so is the file."* Uploads land in
  `new-job/{userId}/…`, are copied onto the job at creation, and are swept after
  7 days. Cancel and the bin discard immediately — the cron is for closed tabs,
  not for someone who just said "discard this". His follow-up fixed a
  disappearing act: the form now offers **the job's four real buckets**, so a
  permit filed under PERMIT-TO-WORK is still there after saving.

## Facts worth keeping

- **A component, column or config entry existing is not evidence it is reached.**
  Four bugs this session, one shape.
- **`is_sub_installer` is a fact about the JOB, not the person** — the same
  installer drives one job and supports another. Read the flag per row.
- **A name is not a first name.** Two people can share one.
- **The key arrives from the browser.** Anything naming a storage object must
  prove the caller owns it, or any object in the bucket can be copied onto a
  new job. `ownsNewJobScratchKey` is tested against traversal and near-miss
  prefixes for that reason.
- **Check the response of anything that writes.** `fetch` does not reject on
  HTTP errors, and a swallowed failure is indistinguishable from success.
- **`getNavRole` is for navigation only, never permissions** — and preview-as
  must keep working, which is the case its test pins.
- **The release time comes from the production deployment's own clock.** This
  machine reports MPST and `TZ=` is ignored.
- **One changelog entry per date.** A second entry for the same day would never
  reopen the popup; fold it in and bump the time.

## ⚠ Next session

- **Build item 5.** Fully designed, mockup published, two questions open inside
  it. The biggest remaining piece.
- **Feedback list: 5 of 14 left** — 3b (time picker), 6 (support crew pills),
  8 (tickable buckets), 9 (external page chat), plus 13 held and 11 awaiting
  the go.
- **Two housekeeping items**, both on the checklist: the R2 orphans from every
  job deleted before today, and one stray test upload the 7-day sweep will take
  on its own.
- **Unexplained, deliberately left open:** the three jobs that never saved.
