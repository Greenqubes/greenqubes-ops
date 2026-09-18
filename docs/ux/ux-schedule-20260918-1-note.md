---
session: ux-schedule (the schedule remembers the date you are working on)
date: 2026-09-18
branch: dev → main (8d480ca, changelog bb4bc01)
migrations: none
release: 15:28 SGT
---

# A default nobody had revisited

> Nic: "i press oct 2 to edit arnotts, then either i press back to schedule
> or greenqubes logo to go schedule page, it jumps to today. very repetitive
> any annoying."
>
> Small session, one change. What is worth recording is not the fix — it is
> the shape of the problem, the decision that was Nic's rather than mine, and
> the one way this could have gone wrong.

## 1 — Not a bug

`selectedDate` was initialised to `today` in `ScheduleShell`. Leaving
`/schedule` and returning mounts the shell fresh, so every return re-ran that
initialiser.

Nothing was broken. The code did exactly what it said. It had simply never
been asked whether today was the right answer on the *second* visit, and the
person it was wrong for was the one using it eight hours a day.

> Worth separating from the four "code that reads as though a feature exists"
> finds of 2026-09-15. This is the opposite: the code was honest, the default
> was just never revisited.

## 2 — The decision was Nic's, and it was the load-bearing one

Three lifetimes were offered:

| Option | What it costs |
|---|---|
| Forget when the tab or app closes | Nothing — you are never on a date you did not just choose |
| Never forget | Open on Monday and be quietly shown last week |
| Forget after a few hours | The app behaves differently depending on the time of day |

He took the first. That is why this is `sessionStorage` and not
`localStorage`, and the distinction is now the rule for that page:

- **Per-device settings** — view mode, cards-per-row — are `localStorage`.
  They are preferences and should outlive the tab.
- **Where you are right now** — the selected date — is `sessionStorage`.

Had this been built without asking, `localStorage` was the obvious choice
(the two settings beside it use it) and would have been the wrong one. The
failure mode is silent and delayed: it only bites on the first visit of a new
day, which is exactly when someone is least likely to question the screen.

## 3 — The one real hazard

`/schedule` carries hydration error #418, which CLAUDE.md says to leave alone
without a new hypothesis. Reading browser storage during the first render is
how that gets worse: the server renders today, the browser renders 2 October,
and they disagree.

The two settings already in that file each carry a comment saying to read
**after mount** for this reason. The date now does the same, and carries the
same comment. Three is enough that the next one added carelessly is the real
risk — hence the rule is now in CONTEXT.md, not only in the file.

## 4 — Wrapping the setter instead of editing ten call sites

Ten paths move the date: the paging arrows (three view modes each way), the
date strip, the jump calendar, the month drill-down and the Today button.

Each could have been edited to persist. Instead `setSelectedDate` is a
wrapper around the raw state setter, so a path added later persists without
having to opt in — the inverse of the `useUnsavedWork` register from
2026-09-11, where opting in *is* required and a new form can be refreshed
away by forgetting.

A ref mirrors the state so the updater form (`setSelectedDate(d => shift(d, 1))`)
resolves without putting a side effect inside a React updater, which must
stay pure.

## 5 — A stored value is untrusted input

It comes from the browser. It can be absent, half-written, a stale format, or
edited by hand.

`resolveScheduleDate` rejects all of those, and specifically rejects
**calendar-shaped but impossible** values — `2026-09-31`, `2026-02-29` — which
a regex alone passes. `Date` rolls them forward to 1 October and 1 March, so
the check is a round-trip: format it back and see if it survived unchanged.

This matters because every view does `jobsByDate[selectedDate]`. A nonsense
key is not an error — it is an **empty day with nothing on screen to explain
it**, and the only way out is a Today button the user has no reason to think
is the answer.

## 6 — The test was watched failing against wrong code

The first two checks assert the OLD behaviour's failure: a remembered date
being ignored. They were run against a stub that always returned today, and
watched failing, before the rule was written.

```
✗ a remembered date is what the schedule opens on
    expected: "2026-10-02"
    actual:   "2026-09-18"
```

Same discipline as the 2026-09-14 modules, where each test kept the old
behaviour alongside. A test written after the fix passes immediately, which
proves only that it agrees with the code in front of it.

The "falls back to today" checks passed against the stub, as expected — they
guard the opposite regression (a naive `return stored ?? today`) and only
became meaningful once the real rule existed.

## 7 — Release timestamp, captured not looked up

CLAUDE.md requires the changelog time to come from the production
deployment's own clock, because this machine reports MPST and `TZ=` is
silently ignored.

Refinement worth keeping: the watcher **captured `x-vercel-id` at the moment
the build flipped**, rather than notifying and being probed whenever it was
next read. A first probe before the deploy landed correctly showed the
*previous* build's stamp — which is exactly the "you stamp the previous
release" trap the rule warns about, caught by hashing the commit and
comparing rather than assuming the push had deployed.

## Facts worth keeping

- **`/schedule` is hydration-sensitive (#418): read browser storage AFTER
  mount, never in the first render.** Three settings in `ScheduleShell` now
  depend on this.
- **`sessionStorage` vs `localStorage` is a product question.** Settings
  outlive the tab; *where you are* should not.
- **Browser storage is untrusted input** — validate shape AND that the value
  is a real calendar day, because `jobsByDate[bad]` is a silent empty day.
- **Many call sites for one piece of state → wrap the setter**, so a new path
  cannot forget.
- **Verify a deploy by hashing the commit and comparing the build stamp**, not
  by assuming the push arrived.

## Housekeeping

Three checkboxes on the feedback list were still unticked for work that
shipped on the 15th and 17th — driver containers, the two daily summaries,
and Duplicate dropping the location. Corrected, each recording what it
actually shipped as. The count in that heading was also wrong twice: it read
5-of-14 before the correction and 4-of-14 after my first pass; it is **5**.

## ⚠ Next session

- **Cron firing for job-form changes** (Nic, 2026-09-17), unchanged from the
  last note. Nobody is told when a scheduled job's date moves. To settle
  first: which fields earn a message, and whether the job form's instant
  "Save & notify" folds into the same rule.
- **Twelve people still need to tap Connect Summary**, four of them after
  Connect Telegram — including CK, one of the three drivers.
