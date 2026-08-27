# Design Load — Designer Traffic Workflow (V2.5)

**Date:** 2026-08-18 (addendum 2026-08-27 — see final section)
**Status:** Approved in-chat by Nic; build complete through final review; addendum approved 2026-08-27
**Source:** Nic's "Workflow V2.5 Designers" PDF diagram + brainstorming session 2026-08-18

---

## Purpose

Give the company a live view of every designer's workload — which jobs each
designer holds, how urgent each one is, and how close its design deadline is —
so sales/schedulers can assign design work sensibly and designers can
prioritise. An AI scores each job's design complexity from the sales brief;
urgency colour is computed live from that score plus deadline pressure and
relative load.

## Scope

**In:** designer assignment on the job form, Design brief card, AI complexity
scoring, Design Load panel (new bottom-nav tab), designer completion flow with
3-day reminder, admin AI Scores tab.

**Out (parked, own future sessions):**
- **Live whiteboard** inside the Design brief (sales + designer draw together,
  call/notify to join). The brief card reserves a button slot; whiteboard
  snapshots will arrive as ordinary brief attachments the AI already reads.
- Low-confidence "improve this brief" nudge to sales — superseded for now by
  making the brief required.
- Per-designer separate sign-offs on one job (one tick clears the job for all
  assigned designers).
- Mid-flight manual score correction by admin/sales — considered 2026-08-26,
  dropped in favour of the designer completion rating (below). The complexity
  score is read-only everywhere.

---

## Roles and access

| Role | Design Load tab | Assign designers | Edit brief | Tick "Design completed" |
|---|---|---|---|---|
| Sales | ✓ | ✓ | ✓ | — |
| Scheduler | ✓ | ✓ | ✓ | ✓ (override) |
| Coordinator | ✓ | ✓ | ✓ | — |
| Designer | ✓ (Board + My Jobs) | — | — | ✓ (own assigned jobs, rating required) |
| Admin | ✓ (+ AI Scores tab) | ✓ | ✓ | ✓ (override) |
| Installer / Production / External | no tab, no change | — | — | — |

**Designer permission widening (Nic approved 2026-08-18; buckets widened
2026-08-26).** Designers are view-only on the job form today. They gain, on
jobs they are assigned to:
1. **Full access to the Files tab** — upload images/attachments/URL links to
   any bucket, add buckets (same as other office roles)
2. Tick **"Design completed"** (action-bar button, with a required 1–5
   complexity rating — see Completion flow)
3. Job chat (already had)

No other field edits, no financials.

---

## Job form changes

### Design brief card (Details area)

- **Free text** brief + **file attachments** (PDF/images — floorplans, client
  briefs), uploaded through the existing R2 signed-URL path, stored in `files`
  with a new kind `design_brief`.
- Placeholder coaches scope: *"What exactly does the designer need to produce?
  Which area / items?"* — this is what fixes the
  whole-floorplan-but-only-one-area problem: the text narrows the attachment.
- **Required rule (two-stage, Nic 2026-08-18):**
  - **First push / pre-booking is exempt** — sales can create a job and push
    it to the schedule, even with a designer already selected, with no brief.
    Booking the slot fast comes first.
  - **Afterwards, on the edit form:** once the job is scheduled and has at
    least one designer assigned, **every save requires brief text**
    (attachments alone don't satisfy it — text is what steers the AI). Save
    blocks with a clear message until text exists. Attachments are never a
    precondition. Jobs with no designer assigned never require a brief.
  - **Leave guard:** back / refresh with unsaved changes (including an
    unfilled required brief) prompts "Leave page? Your changes won't be
    saved" — no silent loss; the requirement catches them on the next save.
  - **Scoring waits for text:** no AI call fires while brief text is empty —
    a pre-booked job simply renders grey on Design Load until the brief is
    written.
- **Design due date** field inside the card: shows the AI-proposed date with an
  "AI suggested" tag; sales can overtype it. A manually set date is never
  overwritten by the AI again.
- **Due date follows the install date (Nic, 2026-08-26):** when the install
  date moves, the design due date — manual or AI-proposed — **shifts by the
  same number of days**, preserving the lead-time gap. Example: install 20 Sep,
  due 15 Sep (5-day gap); install pulled to 12 Sep → due auto-shifts to 7 Sep.
  If the shifted date would land before today, it clamps to today (urgency
  maxes out). Every auto-shift sends the assigned designers a bell
  notification ("Design due date moved: 15 Sep → 7 Sep — install date
  changed"), plus Telegram when the date moved *earlier* (bad news must
  arrive). The manual flag survives the shift — the AI still never re-proposes
  over a manual date.
- Reserved slot for the future **Whiteboard** button.

### Team card

- New **Designers** picker, same pattern as Coordinators (multiple allowed).
  Sales / scheduler / coordinator / admin can assign.
- Assigning fires a bell notification + Telegram to the designer
  ("New design job assigned" — new template, existing bot).

### Other job-form rules (2026-08-26)

- **The Designer JO bucket is protected** on every job — no rename, no delete,
  for any role. The completion tick and the 3-day reminder both key off a file
  existing in it; a renamed bucket would silently break both.
- **Duplicate** copies the **brief text + brief attachments** into the new job
  (reusable content, same spirit as buckets copying) — but never the
  designers, due date, AI score, completion state, or rating. The copy starts
  unassigned and unscored.

---

## Data model (new migration)

```
job_designers      — job_id, user_id, assigned_at        (M:N, mirrors job_coordinators;
                     plain uuid user column or safe FK per the 0035 lesson —
                     NEVER a second embed-breaking FK onto users)

jobs (new columns) — design_brief          text
                     design_due_date       date
                     design_due_manual     boolean default false
                     design_complexity     int (1–5, null = unscored)
                     design_confidence     text ('ok' | 'low', null = unscored)
                     design_score_reason   text
                     design_scored_at      timestamptz
                     design_completed_at   timestamptz
                     design_completed_by   uuid
                     design_rated_complexity   int (1–5, the completing designer's rating)
                     design_rating_suspect     boolean default false (failed the trust check)
                     design_rating_resolution  text ('kept' | 'discarded', null = unreviewed)

design_scores      — id, job_id, trigger ('brief_change' | 'assign' | 'date_change'
                     | 'nightly'), model, complexity, proposed_due, reason,
                     confidence, created_at        (append-only history for the
                     AI Scores tab)
```

- `files.kind` gains `design_brief`.
- `job_designers` added to the realtime publication (replica identity full)
  so Design Load updates live.
- RLS: `job_designers` readable by office roles + the designer; writes by
  sales/scheduler/coordinator/admin. `design_scores` readable by admin only.
- **PostgREST rule respected:** Design Load queries embed `job_designers`,
  `job_coordinators` (child tables) — never `users` directly onto `jobs`.

---

## AI scoring engine

**Triggers.** After a job save that **actually changed** brief text, brief
attachments, install date, or designer assignment (a save that merely
resubmits the same brief does NOT re-score — the server diffs old vs new
before firing), one background scoring call runs. A **nightly sweep** (new
daily Vercel cron) scores anything missed (e.g. AI outage at save time).
Untouched jobs are never re-scored — time pressure is arithmetic, not AI.

**Model routing.** Brief text only → **Haiku**. Brief has attachments →
**Sonnet** (reads floorplans/PDFs properly). Both logged in the existing API
usage tracker.

**Output per run** (written to `jobs` + one `design_scores` history row):
- **Complexity 1–5** — judged from the brief against a **baked-in baseline
  table** (written with Nic before launch: e.g. LED signage = heavy, vinyl
  print = light) plus, once history exists, similar completed jobs and their
  actual turnarounds.
- **Proposed design due date** — install date minus estimated production lead
  time; skipped when `design_due_manual` is true.
- **One-line reason** — what the score was based on.
- **Confidence** — `low` when the brief doesn't narrow a broad attachment;
  shown on the hover bubble and in AI Scores.

**Urgency colour is computed, not stored.** At render time:
complexity + days until due date + this designer's load relative to the other
designers → one of 5 levels (red → amber → yellow → green → blue). Jobs
redden as deadlines approach with zero AI calls; colours only reshuffle when
something real changed. Unscored jobs render **neutral grey**.

**Learning loop (amended 2026-08-26 — no survey, no mid-flight correction).**
Four signals, none costing anyone a form:
1. **Draft baseline table** baked into the scoring prompt as the day-one
   prior (Claude's draft numbers — refined away by the signals below; no
   team survey).
2. **Designer completion ratings** — the required 1–5 slider at tick time
   (see Completion flow) is the ground truth. Trusted ratings become the
   primary teaching examples: *"brief like this → designer rated 4, took 3
   days."*
3. **Rating trust check** — every rating is cross-examined against two
   witnesses the designer doesn't control: the AI's own prediction from the
   brief, and the actual time taken (system-stamped). A rating that
   disagrees sharply with BOTH is **quarantined** (`design_rating_suspect`):
   stored, excluded from learning, listed in the AI Scores "Flagged ratings"
   strip for one-tap **Keep / Discard** by admin. Unreviewed quarantined
   ratings simply stay excluded — the system stays true without admin
   action. A rating can never affect the live board either way (the job is
   already completed when rated).
4. **Real turnaround times** (assigned-at → JO-uploaded-at → ticked-done-at)
   accumulate automatically.

Accuracy grows with history (~10–20 completed design jobs before most new
jobs have real look-alikes). Per-job low confidence clears only when the
brief is improved (edit re-triggers scoring); the accuracy charts in AI
Scores are where convergence is watched.

**Failure handling.** Scoring call fails → job stays grey/unscored, nightly
sweep retries; the save itself never blocks on scoring (fire-and-forget).

---

## Design Load panel

- **Route** `/design-load`, new bottom-nav tab **Design Load** for
  sales / scheduler / coordinator / designer / admin. Installers and
  production don't see the tab (installers hitting the URL are bounced, same
  as `/fcfs`).
- **One shared view for everyone** (designers see all bars, not just their
  own — Nic's call).
- **Designers get a second view (Nic, 2026-08-26):** for the designer role
  the page opens with a **Board | My Jobs** toggle at the top (no new nav
  button — Nic's pick over a dedicated tab). **Board** = the shared bars.
  **My Jobs** = their personal queue with three filter chips:
  - **To-do** — assigned to them, design not ticked done
  - **Ready to install** — design ticked done, install date today or ahead,
    job not completed ("my part's finished" confirmation)
  - **Past** — design ticked done and the job is completed or its install
    date has passed
  Other roles see only the Board (admin preview-as designer shows the
  toggle).
- **Bars:** one vertical bar per designer, side by side, horizontally
  scrollable. Segments = that designer's open design jobs (assigned, not
  design-completed): **newest on top, oldest at the bottom**. Segment
  **colour** = urgency level; segment **height** ∝ deadline proximity (closer
  due date = taller slice). Total bar height ≈ how loaded the designer is.
- **Hover bubble (desktop):** project title, sales/POC, company, install
  date, sales input date, AI reason line, low-confidence marker. **Click
  jumps to the job form.**
- **Phone:** first tap opens the same bubble (layered `z-[60]`+, above
  BottomNav per the hard rule) with an "Open job" button; tap-away closes.
- **Legend** at the bottom (5 colours + grey = not yet scored), matching the
  FCFS board's legend pattern.
- **Empty designers still shown** — name with an empty slot, so free
  designers are visible.
- **Live:** subscribes via the shared `useLiveChannel` hook (jobs +
  job_designers + files); assignments, brief edits and completion ticks
  appear without refresh. 2-min poll fallback like the other boards.

---

## Completion flow

- **Normal path:** designer uploads the JO PDF into the **Designer JO**
  bucket, presses **"Design completed"** (button enabled only once at least
  one Designer JO file exists). **Pressing it slides open an inline panel —
  NOT a popup (Nic, 2026-08-26)** — with a required **1–5 complexity slider**
  ("How heavy was this design work?", 1 = quick prep · 5 = multi-day) and a
  Confirm button that stays disabled until the slider is touched. Confirm →
  job drops off the board instantly. Stamped `design_completed_at/by` +
  `design_rated_complexity` — the ground truth for the learning loop.
- **One tick clears the job for all assigned designers** (collaboration, not
  separate sign-offs). Whoever ticks, rates.
- **Override:** scheduler + admin can tick it from their own action bar
  (same spirit as the photo-completion override) — **no slider on the
  override path** (they didn't do the work; no fake ratings).
- **Reopen (2026-08-26):** scheduler + admin get a **"Reopen design"** action
  on design-completed jobs — clears the tick and the rating, the job returns
  to the designer's bar. Covers fat-fingered ticks (mirror the existing
  `revert-complete` route pattern).
- **Forgot-to-tick reminder:** a daily cron finds jobs with a Designer JO
  file, unticked for **3+ days** → bell notification to each assigned
  designer: *"Is your design work on [job] finished?"* Tapping opens a
  **Yes / No** bubble — **Yes** reveals the same inline 1–5 slider in the
  notification card (rating required there too) and then ticks it done;
  **No** keeps it and snoozes the reminder another 3 days (never nags
  daily). Snooze state kept server-side alongside the notification so it
  works across devices.
- No silent auto-clear ever (Nic rejected it).

---

## Admin — AI Scores tab

New tab in the Admin page (alongside Users / Digest / Health / Crashes /
Bugs). **English only — no zh strings** (single reader: Nic). Read-only.

- **Summary charts:** open design jobs by urgency (5 colour counts) · load
  per designer (mini bars mirroring the board) · **AI accuracy over time**
  (two comparisons as jobs complete: estimated vs actual turnaround, and
  **AI-predicted vs designer-rated complexity** — the trust charts) ·
  scoring activity + cost (calls/day, Haiku vs Sonnet, from the API usage
  log) · **per-designer rating deviation** (average gap between their
  ratings and the evidence, plus how many of their recent ratings were
  flagged — the anyhow-rater detector).
- **Flagged ratings strip (2026-08-26):** each quarantined rating shown with
  its evidence ("AI said 2 · took 0.5 days · designer rated 5") and one-tap
  **Keep / Discard**. Keep admits it to the learning examples; Discard
  drops it for good; untouched stays excluded.
- **Detail feed:** newest first, one card per scoring run — job title, when,
  trigger, model, complexity, proposed due date, reason, confidence flag.
  Filterable by job and designer.

---

## Notifications summary

| Event | Channel | Recipients |
|---|---|---|
| Designer assigned | Bell + Telegram | the assigned designer |
| 3-day unticked reminder | Bell (Yes/No + slider) | each assigned designer |
| Due date auto-shifted | Bell (+ Telegram if moved earlier) | each assigned designer |

New i18n strings in **en + zh** (Bengali frozen) — except the AI Scores tab,
which is English-only.

---

## Build order & testing

1. **Migration first** — `npx supabase db push` before any code that selects
   the new columns (the standing 42703 lesson). NB the migration number is
   **0048** — 0046/0047 were taken by the assistant-upgrade session.
2. All code stays on `feat-designer-load-flow` → its own Vercel preview
   (clean-cut; `dev`/`main` untouched until Nic green-lights the merge).
3. **Smoke test on preview with Nic**, including a **real designer login** —
   preview-as changes the UI role only and exercises neither the RLS nor the
   team-scoped views (standing caveat).
4. Baseline table ships with Claude's draft numbers (no survey — Nic,
   2026-08-26); completion ratings refine it. Unscored jobs show grey.
5. Type-check + production build green before every push; merges are Nic's
   call only after preview sign-off.

## Addendum (Nic, 2026-08-27 — approved before the smoke test)

**Owner decisions confirmed:**
- Clearing a due date counts as manual forever — the AI never re-proposes for
  that job (as built).
- Pre-booking exemption covers ONLY the brief text. The installer clash check
  runs on every push to schedule, including pre-books with suggested
  installers — never skipped (as built; smoke-test item added).

**1. Same-save due-date conflict → confirm prompt.** When one save both
changes the install date AND carries a due date the user typed this session,
the app asks before saving: keep your typed date, or let it shift with the
install date (show both dates). Keep → the save carries `keepManualDue: true`
and the PATCH skips the auto-shift for that save. Decline / dismiss → the
automatic shift wins (current behaviour). Only that one save is affected;
later install-date moves shift as normal.

**2. Coordinator gains sales-level job access (Nic's explicit role
confirmation).** Coordinators can create jobs and push to schedule, and get
the sales action bars on pending jobs (Save / Push to Schedule / Duplicate —
Delete stays scheduler-only, Nic 2026-08-27), while keeping their existing
scheduler-level powers on scheduled jobs. On the New Job form the
Person-in-Charge dropdown defaults to the creator and stays changeable
(coordinators explicitly may hand PIC to a salesperson). Nav: coordinators
gain the Pending tab. RLS: jobs INSERT + pending→scheduled transition extended
to coordinator; files SELECT + INSERT extended to coordinator (sales parity —
closes the empty-Files-tab gap).

**3. "Created by" on the job.** New `jobs.created_by` (plain uuid, no FK —
the 0035 lesson), stamped at creation by a BEFORE INSERT trigger reading the
caller's `users` row via `auth.uid()` (0038/0042 pattern); service-client
create paths (duplicate, assistant job-create) set it explicitly. Shown on
the edit form's Details card as a muted "Created by {name}" line (name via a
follow-up users query — never an embed). Pre-existing jobs show nothing.
The PIC dropdown is unaffected — creator and PIC are independent.

**4. Production reads files.** files SELECT extended to production (read
everything on jobs, same as other office roles); production's existing
write abilities (production photos / instructions) verified to still work
under the current INSERT policies and extended only if genuinely missing.
Production keeps: production-field edits + job chat; still no Design Load
tab.

Migration **0050** carries all schema/RLS changes above (additive only, on
the shared DB).

Addendum smoke-test items: same-save conflict prompt (keep vs decline) ·
coordinator creates a job, sets PIC to a salesperson, pushes to schedule ·
coordinator + production Files tab shows files · "Created by" line on a new
job (old jobs blank) · pre-book with a double-booked suggested installer →
clash modal appears.

---

Smoke-test checklist to cover: pre-book push with designer + no brief
(allowed) · edit-save on scheduled job with designer + empty brief (blocked)
· leave-guard prompt on back/refresh · designer full Files access but no
other field edits · scoring fires on real brief/assign/date change (and NOT
on a no-change save) · manual due date never AI-overwritten · install-date
move auto-shifts the due date by the same gap (+ designer notified; clamps
at today) · board colours/heights/hover/tap · Board \| My Jobs toggle with
To-do / Ready to install / Past chips (designer login) · click-through to
job · one-tick-clears-all · tick gated on JO file · required slider before
confirm (form AND bell-Yes path; override path skips it) · a wildly-off
rating lands in the Flagged strip; Keep/Discard both work · Reopen design
returns the job to the bar · Designer JO bucket cannot be renamed/deleted ·
Duplicate copies brief text + files but not designers/score/rating · 3-day
reminder Yes/No · AI Scores tab charts + flagged strip + feed · Telegram
assign message · live updates in two windows.
