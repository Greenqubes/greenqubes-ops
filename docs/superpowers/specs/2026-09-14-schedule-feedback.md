# Schedule + job form feedback — 2026-09-14

> Collected from Nic in one pass at the start of the session, as he went through
> them. Nothing is designed or built yet. Items are recorded in the order he
> raised them, in his words, with what each one touches and the questions that
> have to be answered before anything is written.

**Source:** Nic, relaying the scheduler's and his own observations, with
screenshots, two hand sketches and the team's old Google Sheets jobsheet.

## Status at 2026-09-14 19:11 SGT

**LIVE on production** (`dev` → `main` `790df22`, changelog `a7178d3`; probes
green, `sin1`): **3a** (time picker clipped, plus the scroll regression it
caused), **4** (chat panel gap), **10** (video uploads + the 100MB cap + real
error messages + failed uploads no longer recorded as successes), **12**
(delete buttons for production and installers), the **app-wide green errors**,
and the **address list opening unasked** — a pre-existing bug from 28ef578 that
the portal fix made visible.

**7** was investigated and reclassified as NOT a bug; it joins the design pile.

**Still open:** 1, 2, 3b, 5, 6, 8, 9, 11, 13.

**Added 2026-09-15:** **14** — Duplicate should not carry the location over
(Nic, after an 18-job bulk order). It reverses his own 2026-09-10 call, so it
carries the prior reasoning with it and needs a choice between three options
before anything is built.

---

## 1 — Job card: the right-hand block is too far right (PC)

> "scheduler finds on pc view only that the time, sales, coordinator is too far,
> like the wider the screen the further the scheduler needs to look to the
> right.. attached our old jobsheet overview for your consideration. this is how
> it usually looks like but ofc i dont like that its so small.. maybe can move
> time, sales, coordinator to the left as well?"

**Touches:** `JobRow` — the list card on /schedule, reused on Pending and
Completed. PC / wide viewports only; phones already stack.

**Raised by:** the scheduler. Every office role sees the same card.

**Reading it:** the complaint is eye travel, not the content — nobody asked for
anything to be removed. The reference jobsheet packs everything into fixed
narrow columns so the eye scans straight down; the card stretches to fill the
viewport instead, which is what makes a wide monitor worse than a laptop.

**To check before designing:** whether the right block is genuinely pinned right
or merely pushed there by the card stretching. That decides small change vs
re-layout.

**Open:** cap the card width, or cluster content left and leave the right empty?
They look very different. Nic explicitly does not want the old sheet's density
("ofc i dont like that its so small"). Show mockups, do not guess.

---

## 2 — Sales gets "DO issued" and "Production ready"

> "enable DO issued and production ready to sales roles as well."

**Touches:** the Production card on the job form (new + edit). "Production ✓"
also surfaces on the schedule card, so this changes what sales can make appear
there.

**Today:** those two ticks belong to the production role, which edits only
production-ready / DO issued / production instructions / production photos.

**DECIDED 2026-09-15 (Nic): own jobs only** — sales may tick these where they
are the Person-in-Charge, not on a colleague's job. The boundary earns itself:
"Production ✓" also shows on the schedule card everyone reads, so "any job"
would let one sales person change what the team sees about someone else's work.

**BUILT 2026-09-15, on `dev`, not yet on production.** UI-only, no migration —
sales already holds DB UPDATE on their own jobs (0055/0056), so the database
agrees with the screen. `canTickProductionFlags` in `job-form-rules.ts`, TDD'd
(11 checks), wired through `CoreSection` on both the new and edit forms via a
new `isSalesPoc` prop.

**Verified, per the note above:** these ticks go through `saveValues`, which has
asked for the row back with `.select('id')` since 2026-09-07 — so a write RLS
filters out is a visible failure, not a "Saved successfully" over nothing.

**To verify:** that these two ticks travel the guarded save path. An UPDATE that
RLS filters out is not an error — PostgREST answers 204 and the UI toasts
"Saved successfully" over nothing written. Guarded in `saveValues` since
2026-09-07; confirm these fields go through it.

---

## 3 — The time picker

Two separate things, deliberately kept apart.

### 3a — It is clipped by its card (bug)

> "timer drop down doesnt drop out of bucket; view gets blocked"

The open list is cut off by the card it sits in — three options visible, the
rest unreachable. Same family as the standing overlay rule: something that pops
open must layer above its surroundings, not inside them.

### 3b — Redesign: shape and looks

> "i think the scrolling time drop down is not really useful. maybe change it to
> like select am pm style instead"
>
> "the timer picker style can we beautify it abit? the console style is so ugly"

Today: one scrolling list at 15-minute steps (~96 entries). Proposed: split into
short choices — hour / minutes / AM-PM. Plus a visual pass; it currently reads
as a raw browser dropdown rather than part of the app.

**Touches:** `TimeSelect`, used on the job form **and** in the clash
"shift the time" flow. Whatever is built appears in both at once.

**Constraints:** app aesthetic (warm editorial, 14px radius, `--line` borders,
generous spacing), stroke-only icons, no emoji, must work on a phone.

**Plan:** mock up two or three looks side by side before building. This is
tapped dozens of times a week.

**Note:** 3b may or may not resolve 3a — the new control still has to open over
the card. Whichever is built must handle both.

### 3a — FIXED 2026-09-14 (and a regression, also fixed)

Cause: `CollapseCard` wraps every job-form card in `overflow-hidden` (for its
14px corners), which scissors any absolutely-positioned child. The list now
portals to `<body>` via `anchored-dropdown.ts` / `useAnchoredDropdown.ts`. The
address box had the identical bug and only escaped it by sitting higher in the
card; it was fixed at the same time.

**Regression, same day:** the portalled list re-measured on scroll, and the
capture-phase listener caught scrolls from inside the list itself — each one
produced a new position object, re-ran the centre-the-selected-time effect and
snapped the list back. Nic: *"why is it getting locked? i need to be able to
scroll thru the whole timing"*. Fixed in `bef8127` by ignoring scrolls that
originate inside the list, and by centring once per opening.

### 3b — Nic's clarification, 2026-09-14

> "i need to be able to scroll thru the whole timing. i just want it to change
> to am/pm clicker instead"

**Scrolling the full range is not to be taken away.** The redesign adds a
faster way in (hour / minute / AM-PM), it does not replace browsing all 96
options with something narrower. Both have to work in the same control.

---

## 4 — Floating assistant panel does not sit above its button (bug)

> "pop up chat is not clipping right above the button bug"

**Touches:** the floating Assistant panel (the bubble on every page), not the
full Assistant page.

**Symptom:** panel parks near the top of the screen while its button sits at the
bottom, with a large dead gap between.

**Likely cause:** the floating buttons were made draggable and edge-snapping in
the Design Load work, so the button can be anywhere — but the panel may still be
positioned against the viewport rather than against the button.

**To test:** several window sizes, and after dragging the button around. A fix
that only works in the default corner is not a fix.

---

## 5 — Driver containers on /schedule, with drag-to-reassign ⚠ BIG

> "scheduler need to container for driver assigned jobs so he knows where to go,
> also add a 3-line vertical button on the left side for scheduler role beside
> the red blue line on jobcard so scheduler can drag and reorder any way he
> wants. if scheduler drag out from say driver 1 container to driver 2
> container, the jobcard auto unassign all driver 1 and support crew and auto
> assign all driver 2 and support crew"

**From the sketch:**

- Date strip unchanged at the top
- One coloured container per driver — CK (pastel purple), Rintu (pastel green),
  Xiao Yi (beige) — driver name labelled on the left, their job cards inside
- Unassigned jobs stay as loose cards below, exactly as today
- Drag handle (3-line) on the **left edge** of the card, beside the punctuality
  line, **scheduler role only**

**This is architectural.** It changes how the schedule is organised, not how it
looks. It deserves its own design session and spec.

**Open questions — all must be answered before a line is written:**

- **Support crew is attached to the job, not to a driver.** So does moving a
  card pick up whoever normally rides with driver 2, or does the support crew
  stay and only the driver swap? This decides the whole data design.
- **A drag reassigns people, which normally fires Telegram** to the installer
  and the sales POC. Does a drag notify immediately, or stay silent until the
  shuffling is finished?
- **Drivers are the clash-checked crew.** Dropping onto a driver already booked
  at that time is precisely the clash the app warns about elsewhere — warn, or
  refuse?
- **What does the hand-sorted order mean?** The list is ranked first-come-first-
  served by `scheduled_at` today. A manual order is a different concept and
  needs somewhere to live.
- **Who else sees containers?** Sales, coordinators and HR open the same page.

---

## 6 — Support crew pill filter (already on the checklist since 2026-09-07)

> "support crew need pill filter basically what was recorded in context earlier."

Confirms the item already sitting in `nic-checklist.md`, originally raised by
the scheduler on 2026-09-07. The screenshot shows the bucket listing Nicholas
(sales) and a 3D Artist next to the printers and installers.

**Carried over with it, decisions still open:**

- Pills under the "Support crew" heading; tapping one narrows the grid. Pills
  are right here — unlike the people-picker dropdown, where they were rejected
  because that popup is a fixed 224px. This is a full-width section.
- **Exclude Sales, Designer and Coordinator** (Nic, 2026-09-07). Note this
  partly reverses the 2026-09-04 decision to open the bucket to all roles so
  anyone could be dispatched for a night job or manpower shortage.
- **"Carpentry" is three values in live data** — Carpenter (3), Senior Carpenter
  (1), Assistant Carpenter (1). One pill matching all three (recommended, no
  data change), or tidy the subroles down? Same in miniature for Metalwork (4).
- **The seven pills mix roles and subroles.** Installer and Production are
  roles; Metalwork, Carpentry, Electrician, Painter, Printing are subroles, all
  under production. Installers hold no subroles at all. The row must match on
  either field.
- **Support crew and External installers are missing from the NEW job form** —
  the edit form has both. A job can only get either after being created and
  reopened.

---

## 7 — FCFS board on a phone — ⚠ NOT A BUG, reclassified 2026-09-14

> "bug: fcfs extending out of bound"

**Investigated and ruled out as a defect.** The board already scrolls inside its
own box (`FCFSTimeline.tsx:111`), the clash chips have their own scroller
(`FCFSShell.tsx:178`), and both slide-in panels are `fixed inset-0` so they
cannot extend the document. Nic confirmed the behaviour: **the header stays put
and only the timeline moves**, which is the design working.

**The real problem is usability, not overflow.** At the AM/PM zoom the board is
`JOB_COL_W (170) + 24 × HOUR_W (88)` = **2,282px** wide. On a 360px phone that
is roughly two hours visible at a time.

**Moved to the design pile with item 5** — both are "how should the scheduler's
board actually work". FCFS was built as a desktop planning tool, Day view only
(Nic, July 2026); whether it deserves a phone layout is a design decision, not a
fix.

---

## 8 — Tickable attachment buckets, surfaced on the job card

> "Add check box beside name on the left for all buckets. Rename 'Designer JO'
> to 'Job Order' and keep it greyed out as its required. once check box is
> ticked, it cannot be renamed (disabled). this is for office clerk visibility
> so he knows those that checked out means he need to apply or fill form. this
> check has to appear on jobcard too like production. Job Order will appear on
> job card only once something is attached since its box is checked by default"

**The pieces:**

- A tickable box on every bucket — Permit-to-Work, BCA, Job Order, Others, and
  any bucket someone adds
- Ticked = "this job needs this paperwork"; the office clerk works from that
- "Designer JO" → **"Job Order"**, stays protected from deletion (as today, via
  0049), and is **ticked by default**
- Ticking **locks the name** — no renaming a bucket once marked as needed
- The tick **surfaces on the schedule job card**, the way "Production ✓" does
- **Job Order is the exception on the card** — shows only once a file is
  attached

**The contradiction to settle with Nic:** for Permit-to-Work and BCA a tick on
the card reads as **"still to be done"** (it tells the clerk to go and apply).
For Job Order it appears only once a file exists, which reads as **"done"**.
Those are opposite signals on one card. Likely answer: outstanding and completed
look different, rather than one chip carrying both meanings. Nic's call.

**Needs a migration** — `attachment_buckets` has nowhere to store the tick.
Claim the number properly (check `npx supabase migration list` **and** every
branch) when the time comes.

---

## 9 — Job chat + read-only attachments on the external installer page

> "Feature insert. Insert job chat for external installer linked to job form
> itself. Include section for attachment bucket, view only. no deleting of
> attachement or editing rights."

**Touches:** `/ext/[token]` — the public page an outside contractor opens with
no login.

- The chat is **the job's own chat**, not a separate thread — what the outside
  installer writes lands in the Job Chat the office reads on the job form, and
  the reverse.
- Attachment buckets appear **read-only** — open and download, no upload,
  rename or delete.

**Closes a deferred item** from Workflow V2 Phase 4 (2026-07-30): external-page
chat was explicitly parked; today they only get the call-the-POC card.

**Two decisions needed:**

- **That page has no login — the link is the credential.** Letting it *write*
  into job chat is a materially bigger step than letting it read. Needs care in
  how it is built, and a decided answer for what happens when a contact is
  deleted mid-job.
- **Which buckets should an outside contractor see?** All (simplest) or only
  buckets ticked for them (safer, more work)? This links directly to item 8.

---

## 10 — Video upload fails on Completion photos

> "Attaching video in completion fails. Enable video uploading rights"

**Symptom:** generic "Save failed — try again" toast. The generic error means it
is not yet known whether the upload box rejects the type or the server does —
find the real reason before changing anything.

**Also check:** Production photos and the attachment buckets, which likely share
the rule.

**Flag, not a blocker:** video is 10–50× a photo. A phone clip runs 50–200MB
against 3–5MB. Two knock-ons — the nightly backup mirrors R2 to the server PC's
drive, and installers upload from site on mobile data. Recommend a size cap;
bring Nic a number rather than pick one silently. Downloads cost nothing (R2 has
no egress fee), so only storing and uploading grows.

---

## 11 — End-of-day Telegram summary, on a new bot

> "scheduler wants a sumamry message of the whole day on telegram. need to
> create a new summary bot for this. follow my format, query if unsure"

**Format, from the sketch** (`*` = bold, underline = underline):

```
End of Day Summary (Date)        ← bold + underlined

Nicholas                          ← bold
JOBS ADDED                        ← underlined
1. Name of Job (Status)           ← status = driver assigned
   Link → jumps to the job           (CK / Rintu / Xiao Yi) or *Unassigned*
2. Name
   Link →
────────────
Daniel
JOBS ADDED
1. Name
   Link →
────────────
Charles
NO JOBS ADDED
────────────
Vinz
NO JOBS ADDED
────────────
END OF SUMMARY
```

One message, grouped by the person who added the jobs, everyone listed whether
or not they added anything, each job showing the driver it landed on (or
**Unassigned** in bold), each with a tap-through link.

**Queries Nic invited:**

- **What time does it send?** "End of day" is a decision — 6pm, 7pm, after the
  last job's end time?
- **Who receives it?** Scheduler only, or schedulers + Nic + coordinators?
- **"Jobs added" — created today, or scheduled for today?** His wording says
  added, read as created today whenever they are happening. Confirm: very
  different messages.
- **Who appears in the roster?** Everyone who can create a job, or a fixed list
  of sales people? Charles and Vinz showing "NO JOBS ADDED" implies a fixed
  roster, not just whoever was active.
- **Driver only, or driver + support crew?** The sketch shows drivers, matching
  the Drivers-bucket decision of 2026-09-07.

**Rollout gotcha, from experience:** a new bot means every recipient must message
it once first. Telegram blocks a bot from messaging anyone who has not started
it — exactly what bit the digest bot in August 2026.

**Formatting note:** the app sends Telegram messages as HTML (`<b>`, `<u>`), not
the `*` shorthand. Also standing: user text must be escaped before it goes into
a Telegram message — a crafted job title could otherwise inject formatting or a
fake link. That hardening item is already on the checklist and this feature is a
good reason to do it.

---

## 12 — Deleting wrongly attached photos and videos

> "one more miss out to add for production role. they need to delete wrong
> photos/ videos. same for installer role, they need a button to delete wrongly
> attached completion photo/ video"

**Nic's decisions (2026-09-14):** own uploads only, and locked once the job is
completed.

**Flagged to him before building, because it reverses a deliberate rule:** the
2026-08-19 fix wrote "office roles only, installers never, completed jobs
locked" on purpose, so site photos could not vanish after the fact. This is a
considered exception, not a gap being filled.

**Two findings that made it smaller than expected:**

- **Production could already delete.** `production` is in `OFFICE_ROLES`, so
  `/api/files/[id]` already permitted it — only the button was missing.
- Only the installer case needed a new rule: `canDeleteOwnUpload`, kind
  `completion`, uploader must equal the caller, job must not be completed.

**Built in the same batch as item 10** — same two components, same files.

---

## 13 — Lock Job Details for coordinators ⚠ DECISION NEEDED

> "also can we make it so that job details is locked for coordinator role?
> unless they are the one who created the job form and assign sales as PIC"

**Not built.** Raised mid-batch; recorded for the next design round.

**The prior constraint that has to be shown to Nic first:** on 2026-09-07 the
same question came up for sales closing jobs, and the answer was that
**coordinator scope is UI-only ON PURPOSE**. Migration 0037 grants coordinator
**and production** a blanket `jobs` UPDATE; narrowing that policy to fix
coordinators would cut off roughly 15 production staff. So this can be done in
the interface, but the database will still permit the write.

**Ambiguity to settle:** "unless they are the one who created the job form and
assign sales as PIC" reads two ways —

- (a) a coordinator keeps edit rights on any job **they created**, full stop; or
- (b) only on jobs they created **where the PIC is a sales person** (i.e. they
  handed it over), which is narrower and slightly odd — it would lock a
  coordinator out of a job they created and kept for themselves.

**(a) is the likely intent** and is what `jobs.created_by` (migration 0050)
already supports without any new column.

### Decided 2026-09-15 — and a constraint found while scoping it

**Nic's answers:**

- **Meaning: (a)** — any job the coordinator created stays editable; everyone
  else's Job Details locks.
- **Depth: split the permission.** He rejected screen-only and asked for "a new
  database permission solely for coordinator, separated from production db".
- **The two production ticks stay available to coordinators on EVERY job.**
  They sit inside the Job Details card but are a different permission, and
  locking them was explicitly not wanted.

**The constraint, which changes how this must be built:** RLS policies are
row-level. A policy can say *may this person update this job at all* — it
cannot say *may they change the address but not the team*. "Job Details" is a
set of COLUMNS, so splitting 0037 into a coordinator policy and a production
policy gets an all-or-nothing switch: turn it off and coordinators lose
installer assignment, push-to-schedule and completion, which is their actual
job.

**The mechanism that does work is already in this codebase.** Migration 0044
guards privileged `users` columns with a BEFORE UPDATE trigger that compares
OLD and NEW and raises. The same shape applies here: a trigger on `jobs` that
rejects a change to the Job-Details columns when `get_my_role() = 'coordinator'`
AND `created_by <> get_my_id()`.

**So the migration is two parts:** (1) split "jobs: coordinator and production
can update" into separate coordinator and production policies — production's
behaviour unchanged, which is what Nic asked for; (2) the column guard, which
is what actually makes the lock real.

**Columns in scope** (the Details card, minus the two ticks): `project_title`,
`date`, `date_end`, `time_start`, `time_end`, `client`, `location`,
`description`, `client_poc_name`, `client_poc_phone`, `punctuality`.
Deliberately OUT: `production_ready`, `do_issued` (Nic's call above), and
everything Team/status/design, which coordinators keep on every job.

**⚠ HELD 2026-09-15 at Nic's call** — designed, nothing written, nothing
applied. **Take the migration number at implementation time, not from this
document** (CLAUDE.md rule — reserved numbers go stale; this one was already
checked once and would be wrong by the time it is built). Re-run
`npx supabase migration list` AND the all-branches check before writing it.

---

## 14 — Duplicate should not carry the location over ⚠ REVERSES A 2026-09-10 CALL

> "remove location every duplicate cuz it confuses user like me with bulk order"
> — Nic, 2026-09-15

**Not built.** Raised immediately after an 18-job bulk order, live on
production, watched from the database as he worked.

**This reverses Nic's own decision of 2026-09-10, and the reason he gave then is
the opposite of the reason he gives now.** The comment sitting in
`src/app/api/jobs/[id]/duplicate/route.ts` records it:

> Location copies too since 2026-09-10 (Nic): a duplicate is nearly always
> the same site again, so blanking it made people retype what they had.

Before that date Duplicate deliberately blanked the location. The field has now
been wanted both ways, each time for a sound reason — because **one button is
serving two different jobs**:

- **Same site again** (a return trip, a second phase) — copying the address
  saves retyping. This is what 2026-09-10 optimised for.
- **Many sites, one campaign** — 18 Cold Storage branches on a single date. Here
  the inherited address is wrong *every* time, and dangerously plausible: an
  unedited copy looks finished, and two jobs at the same address are invisible
  on the schedule.

**Observed 2026-09-15, not inferred:** 18 jobs built by duplicating down a
chain, each copy arriving pre-filled with the **previous store's** address, each
one overwritten by hand. Nic's words for it were "ux not so good for bulk order
job". Nothing was actually lost — but the whole session started because three
jobs *had* gone missing that morning, and an address silently inherited from the
job before is exactly the kind of thing nobody would spot.

**Decide between:**

- **(a) Always blank it** — what Nic asked for. Simple; fully reverses
  2026-09-10 and re-imposes retyping on same-site duplicates.
- **(b) Ask at duplicate time** — a small "Same location / Different location"
  choice. Serves both cases honestly; costs one tap per duplicate.
- **(c) Blank it, but offer the old value back** — the box starts empty with the
  previous address beneath it as a tap-to-fill suggestion.

**(c) is the recommendation:** it gives Nic the empty box he asked for, so a
copy can never be silently wrong, without re-creating the retyping problem that
caused the 2026-09-10 change in the first place. **(b)** is the safer pick if he
would rather be asked outright than trust a suggestion.

**Overlap to note:** a proper bulk / multi-site flow (raised 2026-09-15, not yet
an item on this list) would remove the case that prompted this. Worth settling
the cheap fix regardless — same-site duplicates will still exist either way.

---

## Grouping

| # | Item | Kind | Size |
|---|---|---|---|
| 3a | Time picker clipped by its card | bug | small |
| 4 | Floating chat panel not above its button | bug | small |
| 7 | FCFS overflows a phone | bug | small–medium |
| 10 | Video upload fails on completion photos | bug + decision | small–medium |
| 2 | Sales gets DO issued + Production ready | permission | small (own jobs) / medium (all jobs) |
| 1 | Job card right-hand block too far right | layout | small–medium, needs a mockup |
| 6 | Support crew pill filter + 2 missing buckets | feature | medium, decisions open |
| 3b | Time picker redesign | feature | medium, needs a mockup |
| 8 | Tickable buckets, shown on the job card | feature + migration | medium |
| 11 | End-of-day Telegram summary, new bot | feature + new bot | medium, decisions open |
| 9 | External page: job chat + read-only files | feature + security | medium–large |
| 14 | Duplicate should not carry the location over | decision + small build | small, reverses a 2026-09-10 call |
| 5 | Driver containers + drag-to-reassign | **architectural** | large, own spec |

## Cross-item notes

- **8 and 9 touch the same thing.** The bucket ticks (8) are a natural way to
  decide which buckets an outside installer may see (9). Design 8 first.
- **5 and 11 share a definition.** Both hinge on "which driver is this job on",
  and 11's status column is exactly what 5's containers group by. Settle the
  meaning once.
- **5 and 1 both re-lay-out the same card.** Doing 1 first and 5 later risks
  laying out the card twice. Worth deciding the order deliberately.
- **6 partly reverses a 2026-09-04 decision** (support crew opened to all roles).
  Flag it to Nic when building, not silently.
- **3a and 3b overlap.** Build whichever is chosen so that it handles both.
