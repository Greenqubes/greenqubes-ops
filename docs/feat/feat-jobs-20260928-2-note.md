---
session: feat-jobs (pending privacy + the job bin)
date: 2026-09-28
branch: feat-job-bin (worktree) → dev → main (2de099c, session close d4c0b6e)
migrations: 0062_pending_privacy, 0063_job_bin — applied on Nic's "apply both"
release: 21:23 SGT
---

# A trash can, and the leak found while designing it

> Nic: "all my aydan job disappeared. where did it go" — then, when told the
> answer could not be known: "lets add a trashcan feature where we can recover
> deleted jobs by accident".

## 1 — The question that could not be answered

Read-only against the live DB: nothing dated 1–4 Oct, none of the 15 Sept
Arnotts duplicates left, and **no record anywhere of who deleted a job or
when** — delete was a hard cascade and wrote no event. The only trace was
indirect: two jobs dragged on the Drivers board on 17 Sept 16:08 SGT by the
GreenqubesAI admin account no longer exist. Recovery would need the server PC's
nightly dumps (`E:\Greenqubes-Archive`, 30 days). Nic chose to leave them.

Every delete now writes a `job_deleted` event. That alone would have answered
his question in seconds.

## 2 — The leak Nic caught mid-design

Asked who should see deleted drafts, Nic answered with the rule for live ones
— and added "i think now i can see scheduler pending jobs which is weird". He
could. **Every draft was readable by every sales, coordinator, scheduler and
admin user**: `getPendingJobs` has no filter, and 0060's SELECT policy lets
those four roles read every row. The "only its sales person and coordinators"
rule had been Workflow V3 round 2, cancelled with it before it was built.

So the spec became two parts, privacy first.

## 3 — Restrictive policies, not rewrites

Twelve tables carry ~60 permissive policies between them. Rewriting each to add
"…unless it's someone else's draft" is how one gets missed. Postgres ANDs a
**RESTRICTIVE** policy onto whatever the permissive ones allow, so 0062 adds
exactly one per table and edits none. The helpers are SECURITY DEFINER for the
0053 reason (jobs ↔ job_coordinators policies read each other).

Service-client routes bypass all of it. Four read a job by an id the caller
supplies (duplicate, buckets, files, designers); each now asks the session
client first via `callerCanSeeJob`.

## 4 — A sealed copy, not a flag

A `deleted_at` flag would have meant teaching ~34 readers, the crons, both
Telegram summaries, the assistant and the external pages to skip it — and one
miss nags a scheduler at 4pm about a deleted job. A sealed jsonb snapshot of
the job plus its 11 linked tables means the live job really is gone; nothing
can surface it by accident. Restore is one RPC, one transaction.

The trap in re-inserting: three BEFORE INSERT triggers rewrite columns.
`stamp_scheduled_at` would have put every restored job at the back of the FCFS
queue. The RPC writes `scheduled_at`, `r2_folder`, `created_by` and
`created_at` back from the snapshot.

## 5 — Verified against the real schema

A throwaway script ran the real functions against the live DB: delete → bin
(R2 object kept) → restore (four columns and every child count identical) →
double restore refused → purge (R2 object gone). 15/15. The first run crashed
on the script's own wrong column name and left a job plus one R2 object; both
were found and removed, and the R2 prefix checked empty — `listObjects` needed
the `jobs/` prefix the first look forgot.

The cron was run the same way with a backdated entry: emptied, while a fresh
one was kept.

## 6 — What the fresh-context review found

Three real defects, each fixed with a test that failed first:

| Finding | Why | Fix |
|---|---|---|
| A PIC-only sharer could not hand a draft to another sales person | Postgres checks an UPDATE's **new** row against SELECT policies and raises — the whole save failed | `/api/jobs/[id]/handover`, run LAST in the save; the form returns the person to their list if the draft is no longer theirs |
| Delete forever racing a restore brought a job back with its files gone | Files were deleted before the row was claimed | Claim-first: `bin-purge.ts` deletes the row (returning its keys) before any file |
| The retention warning missed a job on its last day | Counted against now; the cron runs at the next 04:00 SGT | `nextBinRunISO` |

Three minors were deferred (listed in Nic's checklist).

## 7 — Two sessions, one dev

A parallel session shipped Support crew work to dev and main while this was
built, including a commit made straight onto main. The bin branch was merged
with dev and fully re-tested (40 suites) before landing, and main's stray
commit was folded back into dev so main could fast-forward.

## Facts worth keeping

- **Drafts are private to creator / sales PIC / coordinators on it, plus admin.** Any new job-linked table needs the 0062 restrictive policy; any new service-client route taking a job id needs `callerCanSeeJob`.
- **An UPDATE whose new row fails a SELECT policy is an error, not a silent filter** — the opposite of the 2026-09-07 trap, and just as easy to miss.
- **A new job-linked table must join `BIN_CHILD_TABLES` and the restore RPC's list**, or a restore silently drops it.
- **Re-inserting a row fires its BEFORE INSERT triggers** — check what they overwrite.
- **A push to main needs Nic's explicit words**; an inferred go is blocked by the auto-mode safety check.

## ⚠ Next session

- Nic's real sales login and a coordinator: the two checks the preview could not do.
- Still waiting from 2026-09-17: telling people when a scheduled job changes.
