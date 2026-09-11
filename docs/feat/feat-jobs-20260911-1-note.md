---
session: feat-jobs (job form revisions + the app refreshes itself)
date: 2026-09-10 → 2026-09-11
branch: dev → main (28ef578, 6a07bb5, a12896f, 4ce2a86)
migrations: none
---

# A screenshot, and the thing the screenshot was standing on

> Nic marked up the Job Details card — eight arrows, two notes at the side.
> Six of them were layout. One of them turned out to be sitting on top of a
> form that had never been validated at all.

## 1 — What the markup asked for

| Marked | Built |
|---|---|
| "Make this required" ×6 | Title, date, company, client, contact no., location |
| "Shift this down" | Field label shares the ✦ Suggest button's row |
| Day → "End Date (Optional)" | Revived `jobs.date_end` |
| Remove "(Optional)" + a call button | Dials the number found inside free text |
| "Open Maps" + address auto-search | Google Places, approved as a new vendor |
| No start time → always Flexible | Strict greys out |
| Jump to the empty field on push | Tab switch, card open, scroll, red message |
| Duplicate copies all Job Details | Location copies too |

## 2 — The finding underneath the required fields

`validateRequired` had been passed to `CoreSection` since the form was built,
attaching `{ required: 'Required' }` to three fields. It had never once run.

`NewJobShell.saveJob` reads `watch()` and writes, directly:

```ts
async function saveJob(mode: 'pending' | 'push_to_schedule') {
  const values = watch()
  ...
```

react-hook-form validates in `handleSubmit`. Nothing on the New Job form went
through it, so **every rule attached to every field there was inert**, and an
empty form could be pushed straight onto the schedule. The rules were not
wrong; nothing was asking them.

So the gate is explicit now, at the button, in one pure function
(`missingRequiredJobFields`) rather than sprinkled through field definitions.
The same function is what the edit form's Push uses, so the two forms cannot
drift apart.

**The order of `REQUIRED_JOB_FIELDS` is load-bearing** — the form scrolls to
the first gap, which has to be the topmost one a person can see, not whichever
key was checked first. That is what the array's order encodes, and it is
tested.

## 3 — Nic's follow-up, and why it needed its own rule

> "when editing job form, the required fields should exist as well. cuz if user
> remove details from the required form, by right they should replace with
> another info. it becomes incomplete if its empty"

He had already chosen "required on Push only, Save stays free" — which is what
lets sales park a half-filled draft. Both are right, and the difference is
**what the field held when the form opened**:

```ts
clearedRequiredFields(original, current)  // had something, now empty
```

The baseline is `formState.defaultValues`, which is accurate for free: every
successful save ends in `reset(values)`. A draft that never had a company is
untouched by the rule; a scheduled job whose location is deleted is refused.

## 4 — The address lookup

Nic's actual ask, after seeing the first version:

> "can it instead show like google maps in detailed address of the location
> instead? like show unit number and all cuz thats what my driver needs"

The suggestion list only carries a label. The full address needs a second call:

```
autocomplete → "Capitol Optical (Great World City)"  + placeId
details      → "#02-110, 1 Kim Seng Promenade, Singapore 237994"
```

Four decisions worth keeping:

- **`formattedAddress` is the only field requested.** It sits in Google's
  Essentials tier; the display name is Pro and costs ~3× — and the suggestion
  already carries the name, so paying for it twice would be pure waste.
- **A session token ties the typing to the lookup**, so Google bills one
  session instead of one call per keystroke.
- **The name goes in front only for a business.** Google's prediction `types`
  say whether it is an establishment or a street address, so "313 Orchard Road"
  is never prefixed with itself. Guessing by string-matching would have failed
  on "Road" vs "Rd".
- **No key → a plain text box.** The feature shipped before the key existed.

This is **the first vendor added to the locked stack since Phase 0** (Nic,
2026-09-10). The key lives only in `GOOGLE_MAPS_API_KEY` on the server, both
routes refuse callers who are not signed in, and results are Singapore-only.

## 5 — The app refreshes itself

> "Actually is there a way to make auto refresh available? It's stupid I have
> to yell whole company to refresh tab everytime. Even installer who's not in
> office about their day."

A deploy cannot reach into an open tab — there is no such button at Vercel or
anywhere else. So the tab asks instead: a hashed build stamp baked in through
`next.config`, `/api/version` reporting the server's, and a watcher in
CompanyBar comparing them on load, on a 3-minute timer, and **whenever the tab
returns to the foreground** — which on a phone is what "opening the app" means.

The decision is a pure function:

| Situation | Action |
|---|---|
| Same build, or the check failed | nothing |
| Newer build, nothing unsaved, tab in background | reload silently |
| Newer build, nothing unsaved, still for 10s | reload |
| Newer build, nothing unsaved, mid-tap | wait, ask again in 3s |
| Newer build, unsaved work | amber bar, wait for the tap |

**The loop guard is the important line.** A build with no stamp (local dev, or
a build where the stamp went missing) can never match the server — without the
guard, every tab would refresh forever. It is the first thing the rules check
and the first thing the tests cover.

Nic chose the hybrid himself, and asked the question that shaped it: *"How does
checking on wake up works on pc web then? If user kept the tab open"* — hence
three triggers rather than one, and the background-tab case, where a stale tab
can be refreshed with nobody the wiser.

## 6 — Verification: three deploys while he watched

No way to unit-test "a real tab refreshes itself", so it was done live: Nic
opened the preview and empty commits were pushed one at a time.

1. **Silent refresh** — tab alone, refreshed itself. ✅
2. **Unsaved work** — typing left in a job form, amber bar appeared, page did
   not move, typing survived. ✅
3. **The bar clearing itself** — work saved, then still, refreshed without a
   tap. ✅

## 7 — Errors have been green since August

`Field` printed its error in `text-terracotta` and `Input` drew its error
border the same way. Since the 2026-08-18 rebrand, `--terracotta` is **moss
green**. Every validation error in the app has been green for three weeks.

That is the third of this exact class — `bg-green` (never compiled),
`Btn`'s forced `lowercase` (silently overrode every capitalised label), and now
this. The pattern is the same each time: **the token's name kept its meaning
while its value changed underneath**. Errors now use `--bad`.

## Facts worth keeping

- **`saveJob` bypasses `handleSubmit`, so react-hook-form rules on the New Job
  form do nothing.** Anything that must hold there is checked at the button.
- **`formState.defaultValues` is a free "what the job holds now" baseline**,
  because every save ends in `reset(values)`.
- **`jobs.date_end` was saved by the form and understood by the schedule for
  months with no box on screen.** Worth checking for other dead-but-wired
  columns before building anything new.
- **When a palette is rebranded by value, re-read every semantic use of the
  token name** — not just the colours. Three bugs, one cause.
- **Google's prediction `types` distinguish a shop from a street address** —
  better than any string comparison for deciding whether to prefix a name.
- **A build with no version stamp must never reload.** It can never match.
- **Anything new that holds unsaved work must claim it** via `useUnsavedWork` /
  `holdUnsavedWork`, or the auto-refresh can take it.
- **CompanyBar returns a fragment now** — the version bar is a sibling after
  the bar, not inside its flex row, so it parks at `sticky top-[45px]` like the
  job form's own banner.

## ⚠️ Next session

- **The changelog timestamp needs settling.** Nic gave 11:26 for the final
  release; decoding the production deployment's `x-vercel-id` epoch gave 12:35.
  One of the two is an hour+ out, and CLAUDE.md currently instructs the decode.
  Check a deployment against the Vercel dashboard (which shows GMT+8 directly)
  and fix whichever is wrong.
- **Watch whether the six required fields annoy anyone** — dropping any of them
  is a one-line edit to `REQUIRED_JOB_FIELDS`.
- **Still open from before:** the Support crew pill filter and the two buckets
  missing from the New Job form (Nic deliberately kept them out of this batch),
  the "scheduled job moved" notification, and the realtime Voice PA vendor
  decision.
