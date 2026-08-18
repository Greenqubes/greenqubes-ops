# Design Load — Designer Traffic Workflow (V2.5)

**Date:** 2026-08-18
**Status:** Approved in-chat by Nic, pending final spec review
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

---

## Roles and access

| Role | Design Load tab | Assign designers | Edit brief | Tick "Design completed" |
|---|---|---|---|---|
| Sales | ✓ | ✓ | ✓ | — |
| Scheduler | ✓ | ✓ | ✓ | ✓ (override) |
| Coordinator | ✓ | ✓ | ✓ | — |
| Designer | ✓ (same shared view) | — | — | ✓ (own assigned jobs) |
| Admin | ✓ (+ AI Scores tab) | ✓ | ✓ | ✓ (override) |
| Installer / Production / External | no tab, no change | — | — | — |

**Designer permission widening (Nic approved 2026-08-18).** Designers are
view-only on the job form today. They gain exactly three abilities on jobs
they are assigned to, nothing else:
1. Upload files into the **Designer JO** bucket
2. Tick **"Design completed"** (action-bar button)
3. Job chat (already had)

No other field edits, no financials, no other buckets.

---

## Job form changes

### Design brief card (Details area)

- **Free text** brief + **file attachments** (PDF/images — floorplans, client
  briefs), uploaded through the existing R2 signed-URL path, stored in `files`
  with a new kind `design_brief`.
- Placeholder coaches scope: *"What exactly does the designer need to produce?
  Which area / items?"* — this is what fixes the
  whole-floorplan-but-only-one-area problem: the text narrows the attachment.
- **Required rule:** when at least one designer is assigned, brief **text** is
  required (attachment alone does not satisfy it — text is what steers the
  AI). Save is blocked with a clear message until text exists. Jobs with no
  designer assigned don't require a brief.
- **Design due date** field inside the card: shows the AI-proposed date with an
  "AI suggested" tag; sales can overtype it. A manually set date is never
  overwritten by the AI again.
- Reserved slot for the future **Whiteboard** button.

### Team card

- New **Designers** picker, same pattern as Coordinators (multiple allowed).
  Sales / scheduler / coordinator / admin can assign.
- Assigning fires a bell notification + Telegram to the designer
  ("New design job assigned" — new template, existing bot).

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

**Triggers.** After a job save that changed brief text, brief attachments,
install date, or designer assignment, the server fires one background scoring
call. A **nightly sweep** (extends an existing Vercel cron) scores anything
missed (e.g. AI outage at save time). Untouched jobs are never re-scored —
time pressure is arithmetic, not AI.

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

**Learning loop.** Each job records assigned-at → JO-uploaded-at →
ticked-done-at. Scoring prompts include similar completed jobs as reference,
so accuracy grows with history (~10–20 completed design jobs before most new
jobs have real look-alikes). Per-job low confidence clears only when the
brief is improved (edit re-triggers scoring); the accuracy chart in AI Scores
is where system-wide convergence is watched.

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
  one Designer JO file exists), confirms in a small modal → job drops off the
  board instantly. Stamped `design_completed_at/by` — feeds the learning
  loop.
- **One tick clears the job for all assigned designers** (collaboration, not
  separate sign-offs).
- **Override:** scheduler + admin can tick it from their own action bar
  (same spirit as the photo-completion override).
- **Forgot-to-tick reminder:** a daily cron finds jobs with a Designer JO
  file, unticked for **3+ days** → bell notification to each assigned
  designer: *"Is your design work on [job] finished?"* Tapping opens a
  **Yes / No** bubble — **Yes** ticks it done on the spot; **No** keeps it
  and snoozes the reminder another 3 days (never nags daily). Snooze state
  kept server-side alongside the notification so it works across devices.
- No silent auto-clear ever (Nic rejected it).

---

## Admin — AI Scores tab

New tab in the Admin page (alongside Users / Digest / Health / Crashes /
Bugs). **English only — no zh strings** (single reader: Nic). Read-only.

- **Summary charts:** open design jobs by urgency (5 colour counts) · load
  per designer (mini bars mirroring the board) · **AI accuracy over time**
  (estimated vs actual turnaround as jobs complete — the trust chart) ·
  scoring activity + cost (calls/day, Haiku vs Sonnet, from the API usage
  log).
- **Detail feed:** newest first, one card per scoring run — job title, when,
  trigger, model, complexity, proposed due date, reason, confidence flag.
  Filterable by job and designer.

---

## Notifications summary

| Event | Channel | Recipients |
|---|---|---|
| Designer assigned | Bell + Telegram | the assigned designer |
| 3-day unticked reminder | Bell (Yes/No bubble) | each assigned designer |

New i18n strings in **en + zh** (Bengali frozen) — except the AI Scores tab,
which is English-only.

---

## Build order & testing

1. **Migration first** — `npx supabase db push` before any code that selects
   the new columns (the standing 42703 lesson).
2. All code to `dev` → Vercel preview.
3. **Smoke test on preview with Nic**, including a **real designer login** —
   preview-as changes the UI role only and exercises neither the RLS nor the
   team-scoped views (standing caveat).
4. Baseline complexity table written with Nic before scoring goes live;
   until then unscored jobs show grey.
5. Type-check + production build green before every push; `dev` → `main`
   only after preview sign-off.

Smoke-test checklist to cover: brief required-on-assign block · designer
three permissions (and nothing more) · scoring fires on brief/assign/date
change · manual due date never overwritten · board colours/heights/hover/tap
· click-through to job · one-tick-clears-all · button gated on JO file ·
3-day reminder Yes/No · overrides · AI Scores tab charts + feed · Telegram
assign message · live updates in two windows.
