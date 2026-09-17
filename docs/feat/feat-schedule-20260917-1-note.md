---
session: feat-schedule (driver containers, drag-to-reassign, two daily summaries)
date: 2026-09-17
branch: dev → main (0535395, changelog 888c150, redeploy f7dba9d)
migrations: 0061 (jobs.lat / jobs.lng) — applied before any code that reads them
release: 18:42 SGT
---

# One rule that answered two open questions

> Feedback item 5 had been waiting since 2026-09-14 and was designed on the
> 15th. Building it took a 12-task plan, and the design changed shape five
> times under Nic's eye while it was being built. The most useful thing to
> record is not the board — it is which decisions turned out to be load-
> bearing, and which problems were only visible against real data.

## 1 — The derived band

A job's container is **computed from its crew on every render and never
stored**: 0 drivers → Unassigned, 1 → that driver, 2+ → Mixed.

That was chosen for simplicity. What it bought was larger than expected. The
spec listed two questions as **still open**:

- "If only one driver is picked the card drops into that driver's own
  container instead."
- "Drag one driver off a Mixed job and it should fall into the other driver's
  container by itself."

Both are the same line of code. Neither needed building, and neither can drift
from the other later. A stored `band` column would have required two explicit
rules that could disagree.

> When a question in a spec says "what happens when…", check first whether the
> data model already answers it.

## 2 — Five changes mid-build, each from Nic

None of these were in the plan. All five improved it.

| Change | Why it mattered |
|---|---|
| Externals get their own containers, and a shared job renders **twice** | "its for visibility purpose" — one job row, two cards, the same object |
| The support crew belongs to the **driver**, not the job | Any drag removing a driver removes their helpers; "its a different team altogether" |
| Mixed Drivers stays, mirrors do not extend to two of our own drivers | Both driver copies would be draggable and could contradict each other; an external mirror cannot, because it has no handle |
| Drag and swipe-to-delete both desktop-only | Arranging a day is a desk job |
| Three drivers side by side | The fixed 2200px breakpoint was set from his scheduler's 32" and left his own 1920 screen wrapping |

The mirror rule is worth keeping in mind: **duplication is safe only because
the duplicate is inert.** Two live cards for one job is how a board starts
contradicting itself.

## 3 — The summaries were rewritten twice, both times by contact with reality

Built first as a full who-added-what roster, faithfully to the sketch. Then:

- **Nic's scheduler described what he actually does** — at 4pm he reads
  whatever still has no driver and assigns it, regardless of how far out, and
  wants it again tomorrow if it is still bare. The roster was **deleted** and
  replaced with an exception report. A message listing everything told him
  nothing to act on.
- **The installer message was a pure change log**, which left a hole named
  only when it was tested: someone whose schedule did not change today got NO
  message, even with a 9am tomorrow assigned three weeks ago. Ten of the crew
  would have been missed that evening. Tomorrow's jobs now lead.

> Both rewrites came from describing the message to a person, not from
> reviewing the code. The code was correct and the message was wrong.

## 4 — Three defects only the live database showed

Each was found by rendering the real thing rather than trusting a unit test.

- **6,374 characters against Telegram's 4,096 limit.** A week of real jobs.
  The message would have been **rejected outright** and silently never
  arrived — and would have failed on exactly the busiest days, when it
  matters most. `splitForTelegram` now breaks at line boundaries, never
  inside a tag.
- **The owner was not a recipient of his own summary.** Nic's account is
  `sales`; the list was role-based on scheduler/admin. He would have shipped
  a daily message he never received.
- **Four of eight roster names had never created a job** — half the message
  was permanently empty lines.

## 5 — "Accepted" was a lock, not a button

Nic asked to remove accept/decline from the external installer page. The
obvious change is deleting two buttons.

`if (link !== 'accepted')` also **gated** `/api/ext/[token]/job/[jobId]` and
`/api/ext/[token]/tasks`. Deleting the buttons alone would have locked every
external installer out of every job with a 403, permanently, with no way to
reach 'accepted' any more.

Gate and buttons changed in one commit. A first attempt at the edit silently
missed the gate — leaving `!== 'accepted'` against a now-boolean return, which
is always true — and the type checker caught it.

## 6 — Vercel reads an env var at build time

The summary webhook secret was added to Vercel, and production still answered
**200** to an unsigned POST. Not a mistake: an environment variable only takes
effect on the next deploy, and the running build predated it.

An empty commit rebuilt it; a **403 was confirmed before the webhook was
registered**, rather than registering first and assuming.

## Facts worth keeping

- **Derive, don't store.** The band rule answered two open spec questions for free.
- **A duplicate is safe only if it is inert** — the mirror card has no drag handle.
- **Telegram refuses messages over 4096 characters**, and refuses to message
  anyone who has not pressed START. Both failures are **silent**, which is why
  `sendSummaryTelegram` returns whether it sent.
- **A Vercel env var needs a redeploy.** Verify the new behaviour, not the deploy.
- **`jobs.lat`/`lng` are deliberately read by nothing** — captured towards a
  future proximity hint because `location` sits in Google's same free field
  tier (checked against their SKU docs, not assumed). Do not delete as dead code.
- **Recipients: 4pm by ROLE, 6pm by ASSIGNMENT.** Deliberate — the Support
  crew bucket takes any role, so a production person can be crewed onto a
  night job and must still be told.
- **Release times come from the deployment's own clock.** This machine reports MPST.

## ⚠ Next session

- **Cron firing for job-form changes** (Nic's call, 2026-09-17). Nobody is
  told when a scheduled job's date moves — a standing gap since 2026-09-07
  that now has a home, since the daily summaries already collect changes and
  send at fixed times. To settle first: which fields are worth a message, and
  whether the job form's instant "Save & notify" folds into the same rule.
- **Twelve people still need to tap Connect Summary**, four of them after
  Connect Telegram — including CK, one of the three drivers.
- **Offered, not built:** the bot's confirmation promises a daily message it
  cannot keep for a designer or HR person; and assigning a driver straight
  from the Telegram message with buttons, deliberately deferred until the
  board has been used for a few days.
