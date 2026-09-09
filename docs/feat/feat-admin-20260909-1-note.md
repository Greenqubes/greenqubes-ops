---
session: feat-admin (HR / Finance role + leave tracking + company events)
date: 2026-09-09
branch: feat-hr-leave → dev → main (d6a0769); branch deleted after merge, local and origin
migrations: 0057, 0058, 0059 — applied to the shared DB BEFORE the code merged
---

# The eighth role, built and shipped in one session

> The 14-task plan written on 2026-09-07 was executed end to end, plus two
> things Nic added while watching it come together: company events, and a
> layout round on the Leave page.

## 1 — What shipped

`hr` ("HR / Finance"): schedule view-only, read-only job form, **all prices**
(the `FinancialSection` that had been dead since session 17.6, revived
read-only for `hr` alone), an HR-only `/leave` tab, and the assistant. No job
edits, no job chat, no FCFS, no pending, no Admin.

Leave carries **AM/PM half days** and is a **hard red clash** on every surface
where crew get assigned: the push-flow clash modal, the edit-flow modal, the
FCFS board (bars, chips, drawer, assignment panel), both crew grids on the job
form, and the assistant's `check_clashes`.

Alongside it: **company events** (a retreat across a date range) and the **2026
Singapore public holidays**, both label-only — they appear on the schedule but
never warn.

## 2 — The privacy split, verified rather than asserted

This was the point of the whole design, so it was tested from both ends.

From this side, against production: an anon REST insert into `user_leaves` was
refused `42501 violates row-level security`; `user_leave_details` returned `[]`
while a row existed; a delete matching every leave row removed nothing.

From Nic's side, signed in as a real sales user: `POST /api/leave` → 403,
`GET /api/leave` → 403, and **zero matches** for the leave reason in the
schedule's page source.

That last one is the proof that matters. A record with a reason exists, sales
can see the person's name on the schedule, and the reason is nowhere in what
their browser received — it was never sent, not hidden.

**Why it was testable at all:** `user_leave_details` is a separate table with
its own RLS, decided at design time. Had type and note been columns on
`user_leaves`, the guarantee would have depended on every query remembering to
exclude them.

**A limitation worth recording:** there is no `SUPABASE_JWT_SECRET` in
`.env.local`, so a session token for a specific role cannot be minted locally,
and the service key bypasses RLS entirely. Role-specific RLS testing has to go
through Nic's browser. Recorded in Claude's memory.

## 3 — Nic's calls during the build

- **Leave, holidays and company events show to EVERY role, installers
  included** — "my office culture shows everyone who's on leave and all public
  holidays" — and **prominently**, not as a small counter. The muted line and
  tiny pill became bordered, tinted banners (`DayNotices`).
- **Company events are their own table** rather than a nullable end date on
  holidays. A holiday is one gazetted Singapore date; an event is a range
  belonging to this company. Merging them would have meant a "which kind is
  this?" column on every row and every screen.
- **Public holidays are NOT auto-synced.** A Google feed was offered and
  costed; he declined, and HR keys each year in. Worth recording the technical
  half of that answer: a general holiday feed lists the actual festival date,
  while MOM gazettes the **day off**, including the Monday when a holiday falls
  on a Sunday. For scheduling installs, MOM's version is the one that matters —
  so an automatic sync would still have needed HR to check it.
- **Events never warn**, matching holidays. Leave stays the only thing that
  blocks-with-a-red-card.

## 4 — Built so HR and Finance can split later

Nic asked for this before a line was written: the role is HR *and* Finance
because one person does both, but that may not hold.

Every policy asks a **named capability**, not a role:
`can_manage_leave()` (the HR half), `can_view_all_prices()` (the Finance half),
`can_view_jobs_readonly()` (shared), with a TypeScript mirror in
`src/lib/auth/capabilities.ts`.

Splitting later is: add a `finance` enum value, redefine two of those three
functions, leave `can_manage_leave` alone. **No policy rewrites, no component
changes, no rows to migrate**, and the existing hr account keeps working.

`capabilities.ts` also carries `gateRole(realRole, effectiveRole)`, which
encodes the trap that `getEffectiveRole` never returns `'admin'` — a plain
admin resolves to `'scheduler'`, so an admin gate that tests only the effective
role locks real admins out of their own page.

## 5 — Two bugs found in-session

**The Leave page overflowed a phone when editing an event.** Same class as the
JobRow bug on 2026-09-07: a non-wrapping flex row holding two date pickers (wide
intrinsic size) and a name field floored at `min-w-[120px]` could not shrink
below ~590px, and a row that cannot fit widens the page rather than wrapping.
Fixed by stacking. **Measured, not reasoned** — headless Chrome against the real
compiled stylesheet at 360px, with the OLD markup measured alongside to prove
the test could detect the bug: 592px vs 485px before, 500px vs 500px after.

**Installers were being passed no leave data at all.** Two edits to
`src/app/installer/page.tsx` had silently failed, so the page never fetched
leave, holidays or events despite `InstallerShell` being fully wired for them.
The props are optional, so it type-checked and built perfectly while doing
nothing. Caught by re-reading the file rather than trusting the earlier edit
results. **The lesson: an optional prop that is never passed fails silently in
exactly the way a required one cannot.**

## 6 — Buttons had been lying about their labels

Nic asked three times for capitalised buttons. The first two attempts changed
the i18n strings — and nothing moved on screen, because `Btn` hard-codes
`lowercase` in its base classes and the CSS was overriding the text.

Removed app-wide on his call, from `Btn` and `SignOutButton`, along with the two
lowercase Pill labels and the home page's role pill (which printed the raw DB
value, so it would still have read "hr"). A sweep of `src/` finds no
forced-lowercase styling left.

`CONTEXT.md`'s aesthetic line documented "Lowercase weight-500 buttons" as
brand — corrected, or a future session would have reinstated it.

## Facts worth keeping

- **A separate table is what makes a privacy promise testable.** The reason for
  an absence is in `user_leave_details` with its own RLS, so "the reason never
  leaves the DB" is provable by a query returning `[]` — not a claim about
  every consumer remembering to filter.
- **PostgREST answers 204 on a DELETE that RLS filtered out.** The status code
  proves nothing happened OR didn't. Every leave route asks for the row back
  with `.select()`; a probe delete needs a follow-up count.
- **Scope destructive probes to one row.** A DELETE filtered `gte.1900-01-01`
  was run to test the policy — safe only because the policy held. It should
  have targeted a single row.
- **`cn()` is a plain join, not tailwind-merge.** Two conflicting utilities both
  survive and stylesheet order decides. A descendant override
  (`[&_button]:normal-case`) wins on specificity instead — but the real fix was
  removing the base class.
- **Optional props hide wiring mistakes.** Verify a page actually passes what a
  component accepts; the compiler will not.
- **Worktrees are not linked to Supabase.** `supabase/.temp/` lives per-folder;
  copy it from the main folder before running `db push` from a worktree.
- **Migration numbers:** 0057/0058/0059 claimed against the live DB and every
  branch before writing. 0059 was written as its own file rather than folded
  into the unapplied 0058, because 0058 could have been applied at any moment
  and a later edit to it would be silently skipped.

## ⚠️ Next session

- **Provision the HR account** and have her sign in (she gets the tour).
- **Check the 11 holiday dates** against MOM — live on the schedule now.
- **Four checklist items still untested**: the Telegram escalation, the
  assistant's leave answer, the HR tour, and the half-day pass case on
  production. Tick page:
  https://claude.ai/code/artifact/68d57154-b1a7-44b2-bb40-50d7f57ad032
- **Ledgered, not built:** leave balances and entitlement counting, staff
  requesting leave themselves, and a yearly nudge when next year's public
  holidays have not been entered.
- **Still open from before:** the Support crew pill filter, the missing
  "scheduled job moved" notification, the realtime Voice PA decision, and the
  auto-refresh-after-deploy idea parked on 2026-09-08.
