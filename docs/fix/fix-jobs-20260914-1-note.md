---
session: fix-jobs (feedback pass — 13 collected, 6 fixed and live)
date: 2026-09-14
branch: dev → main (790df22, a7178d3)
migrations: none
---

# Thirteen things, one at a time

> Nic asked to go through his feedback item by item and have it written down
> before anything was built. That turned out to matter more than the fixes:
> nine of the thirteen need a decision from him, and most of those decisions
> were invisible until the item was written out properly.

## 1 — What the pass produced

Everything is in
[superpowers/specs/2026-09-14-schedule-feedback.md](../superpowers/specs/2026-09-14-schedule-feedback.md)
— his words, what each item touches, and the questions each still needs
answered. Six shipped the same evening; nine carried to the next session.

| Shipped | Left, and why |
|---|---|
| 3a time picker clipped | 1 job card layout — needs a mockup |
| 4 chat panel gap | 2 sales DO/production-ready — own jobs or all? |
| 10 video uploads | 3b AM/PM picker — needs a mockup |
| 12 photo deletes | 6 support crew pills — data question open |
| green errors, app-wide | 8 tickable buckets — needs a migration |
| address list opening unasked | 9 external page chat — security calls |
| | 11 end-of-day Telegram — four queries open |
| | 13 coordinator lock — collides with 0037 |
| | 5 + 7 driver containers — own design session |

**Classification was worth saying out loud.** Ten items were bounded changes to
existing code; item 5 (driver containers with drag-to-reassign) changes how the
schedule is *organised*, not how it looks, and was separated on that basis
before any design work started.

## 2 — One cause behind the time picker

`CollapseCard` wraps every job-form card in `<Card className="overflow-hidden">`,
which is there so children stay inside the 14px corners. It also scissors
anything absolutely positioned inside the card. The time list showed three
options; the rest was simply cut off.

`overflow-hidden` was **not** removed — it is load-bearing for the corners, and
proving it safe would have meant auditing every CollapseCard. The list portals
to `<body>` instead, positioned against its trigger, which is how the app's
other overlays already work.

**The address box had the identical bug.** It escaped notice only by sitting
higher in the card, where its list usually fitted. Found by reading, not by
report — and it matters, because it is the same trap for anything added later:

> Any dropdown, popover or menu placed inside a job-form card **will** be
> clipped. It has to be portalled.

Two things the portal broke, both now handled in the shared hook:

- A portalled list is no longer a DOM descendant of its wrapper, so
  outside-click handlers that test only the wrapper close the list **before**
  the click on an option lands. Nothing gets picked.
- `scrollIntoView` on a `position: fixed` list scrolls the **page** behind it,
  chasing an element that never moves. Set `scrollTop` directly.

## 3 — The panel that measured the wrong thing

`computeBubbleAnchor` placed the assistant panel's TOP at
`bubble.top − gap − panelHeight`, where `panelHeight` was
`min(520, vh − 160)` — the panel's **ceiling**, not its height. An empty chat
renders ~290px.

Nic's screenshot, worked through: vh 687 → ceiling 520; bubble top 575;
top = 575 − 12 − 520 = 43; panel bottom = 43 + 290 = 333; gap to bubble = **242px**.

The fix is not a better estimate — it is to stop estimating. Anchor the edge
**facing** the bubble (`bottom` when opening above, `top` when below) and cap
`maxHeight` to that side's room. The panel's own height then cannot move it.

**Generalisable:** any floating element positioned by computing its opposite
edge from a maximum height is wrong the moment its content is smaller than the
maximum.

## 4 — A gate that never caught up with its own UI

Video on completion photos failed with a bare "Save failed — try again". The
chain, end to end:

```
validateContentType('completion', 'video/mp4')  → false
  → /api/r2/upload-url returns 400
  → client destructures { url, key } from the ERROR body → url undefined
  → fetch(undefined) throws
  → bare catch { } → generic toast
```

The revealing part: **the file picker already offered video** (`accept`
included `video/*`) and **the file list already drew a video icon**
(`VIDEO_EXT`, `FileVideo`). The interface was built for video throughout. Only
the server allowlist was never updated.

Shipped with it, all in the same few lines:

- 100MB cap (Nic's call), checked in the browser **before** the transfer starts
  — nobody should upload for two minutes on site to then be refused
- The real reason reaches the toast
- **The PUT response is now checked.** `fetch` only rejects on network failure,
  so an HTTP error was ignored and the `files` row written anyway — producing a
  file in the list that opens to nothing. That is also why this bug stayed
  invisible for so long.

## 5 — Reversing a rule, deliberately and out loud

Deleting photos meant touching the rule written on 2026-08-19: *office roles
only, installers never, completed jobs locked*. That was a considered decision,
not a gap, so it was put to Nic as a reversal rather than quietly changed.

Two findings shrank the work:

- **Production could already delete** — it is in `OFFICE_ROLES`, so the route
  always permitted it. Only the button was missing.
- Only the installer case needed a new rule.

His calls: own uploads only, locked once completed. `canDeleteOwnUpload` is
narrow on purpose — installer + kind `completion` + uploader matches caller +
job not completed. A missing id on either side must never match; "unknown
uploader" is not "mine", and that is tested.

## 6 — The green errors were worse than reported

The 2026-09-11 fix covered `Field` and `Input`. Five more places still used
`--terracotta`, which has been moss green since the August rebrand:

- **`Toast`** — *every* error message in the app. Nic's own video screenshot
  shows it, and he never flagged it
- **`HealthTab`** — a failed cron rendered **green**, i.e. a broken thing
  reading as healthy
- `CrashLogTab`, `DesignBriefSection`, `TimeSelect`

All on `--bad` now, brightened #A83D3D → **#C13B3B** at Nic's request.

**Deliberately not `--punct-strict` (#D14545)**, which he initially asked for:
the FCFS legend shows "Strict on-time" and "Strict clash — fix required" side
by side, and making errors that exact red would have merged two legend entries.
Raised with the cost stated; he took the recommendation.

## 7 — Two bugs found by him testing while I worked

Both are the argument for shipping to a preview mid-session rather than at the
end.

**The list could not be scrolled** — *"why is it getting locked?"*. A
regression from my own portal fix an hour earlier. The list re-measures on
scroll, the listener is capture-phase on window, so scrolling **inside** the
list fired it too → new position object each frame → re-ran the
centre-on-selected effect → snapped back. Fixed twice over: ignore scrolls
originating inside the list, and centre only once per opening.

**Suggestions dropped open on every job form open.** *Not* mine — pre-existing
since the address feature shipped in `28ef578`. The query effect could not tell
a person typing from the form loading a saved address, so any stored address of
3+ characters opened the list over the fields beneath. The portal is only why
it became **visible**; before, it was clipped inside the card and happening
unseen. It was also spending a Google Places call every time anyone opened a
job with an address.

`shouldSuggestAddresses` is now a tested rule: suggestions require someone to
have actually typed. Values that merely *arrive* — form load, duplicate
prefill, the detailed-address swap after a pick — are not requests.

## 8 — One reported bug that wasn't one

FCFS "extending out of bound" was investigated and **ruled out**. The board has
its own `overflow-x-auto`, the clash chips have their own, and both slide-in
panels are `fixed inset-0` so they cannot extend the document.

Rather than guess between "genuine overflow" and "working but unusable", Nic
was asked one distinguishing question — does the header slide away too? It does
not. That settled it in one exchange.

The real problem is size: `170 + 24 × 88` = **2,282px** at the AM/PM zoom, so a
phone shows about two hours. Moved to the design pile with item 5, since both
are "how should the scheduler's board work".

## 9 — Found, reported, not fixed

**`ring-X/20` has never compiled anywhere in this app.** The theme colours in
`tailwind.config.ts` are bare `var()` strings with no `<alpha-value>`, so
slash-opacity on them produces nothing. Confirmed against the built CSS: only
`.ring-bad` and `.ring-terracotta` exist — no `focus:ring-*/20` selector at all.

Every field in the app has therefore shown Chrome's **default blue** focus ring
since it was built.

`TimeSelect`'s error state was left matching `Input` exactly rather than
half-fixing one component into inconsistency. This is app-wide, pre-existing,
and outside what was asked — so it was reported for a separate decision.

Fourth find of this family: `bg-green` (never compiled), `Btn`'s forced
lowercase, moss-green errors, and now this.

## Facts worth keeping

- **`CollapseCard` sets `overflow-hidden`** — anything that pops open inside a
  job-form card must portal to `<body>` or it will be clipped.
- **A portalled list is not a descendant of its wrapper** — outside-click
  handlers must test the list separately, or clicks on options never land.
- **Never position a floating element by computing its opposite edge from a
  maximum height.** Anchor the edge facing the thing it belongs to.
- **Re-measuring on scroll must ignore scrolls from inside the element** — a
  new position object per frame re-runs consumers' effects.
- **`fetch` does not reject on HTTP errors.** An unchecked PUT wrote DB rows
  for objects that were never stored.
- **A value arriving in a controlled field is not the user typing** — check
  before firing a paid API call on it.
- **Bare `var()` tokens have no opacity variants.** `bg-x/50`, `ring-x/20` and
  friends silently produce nothing. Use a `-soft` token or an rgba literal.
- **Keep `--bad` and `--punct-strict` different values** — the FCFS legend
  shows them side by side.
- **Tests kept the OLD behaviour alongside the new** — the 242px gap and the
  rejected `video/mp4` are both asserted. Without that a test proves nothing
  about the bug it was written for.

## ⚠️ Next session

**Nine items, ordered in the checklist.** Two need only an answer (2, 13); two
need mockups (1, 3b); four need decisions then building (6, 8, 9, 11); one is a
design session of its own (5 + 7).

The two worth raising first, because they carry constraints Nic has not seen:

- **13 collides with migration 0037**, which grants coordinator **and
  production** blanket `jobs` UPDATE. Locking coordinators in the database
  would cut off ~15 production staff — which is precisely why coordinator
  scope was kept UI-only on 2026-09-07. His wording is also ambiguous: any job
  they created, or only ones handed to a sales person?
- **11 needs a new Telegram bot**, and every recipient must message it once
  before it can message them. That is what caught the digest bot in August 2026.
