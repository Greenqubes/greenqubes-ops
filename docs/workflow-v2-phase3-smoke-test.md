# Workflow V2 — Phase 3 Smoke Test

> Tick each box as you go. If something fails, note what you saw next to it and tell Claude.
> Phase 3 = the **FCFS Board** at `/fcfs` (day timeline + clash warnings + assignment panel),
> plus a clash warning when **editing** an already-scheduled job.

## Before you start

- [x] **No new migration this phase** — nothing to `db push`. (0037 from Phase 2 is still the latest.)
- [x] You're on the **Phase 3 preview** — the Vercel URL for the `feat-workflow-v2` branch
      (Vercel dashboard → greenqubes-ops → Deployments → the latest `feat-workflow-v2` one).
- [x] You have at least **2 scheduled jobs on the same day** to play with (create test jobs if needed —
      they'll be wiped with the rest of the test data before go-live).
- [x] For the Telegram checks: the scheduler / installer / sales POC involved need Telegram IDs set
      (Admin → Users). If none are set the messages just won't send — skip those ticks.

---

## Section 1 — The board opens and shows the day

- [x] Tap **FCFS** in the bottom nav → the board opens (no more 404).
- [?] Today's **scheduled** jobs are listed as rows, numbered **#1, #2, …** in the order they were
      created (first come, first served). Pending / completed jobs do **not** appear. - check if pending jobs will not appear here? and numbering sense if scheduler confirms a job will it change the ranking of which job? or is it based on whoever pushed job first?
- [x] **‹ / ›** moves a day back/forward; **Today** jumps back (and is greyed out while on today).
- [?] The **AM / PM / AM/PM / 9am–6pm** buttons change the visible hours; your pick is remembered
      after a refresh. 
- [x] A day with no scheduled jobs says **"No jobs scheduled this day"**.
- [x] On your phone (or a narrow window): the timeline **scrolls sideways** inside the board — the
      page itself doesn't stretch. - 9-6pm is broken on full width web view. the bar runs to the far right 

## Section 2 — Bar colours match the legend

- [x] A **flexible-window** job shows a **blue** bar for its installer.
- [x] A **strict on-time** job shows a **red** bar.
- [x] A **sales suggestion** (yellow pick, not yet confirmed) shows an **amber** bar — and its rank
      number is amber too if nobody is formally assigned yet.
- [x] A job with **no time set** (whole-day floater) spans the visible range and says **"All day"**. - do update the schedule tab for when the job has no timing to indicate 'All-Day' as well
- [x] A job with **no installer at all** shows **"No installer yet"** under its name.

## Section 3 — Clash warnings on the board

- [x] Give the **same installer** two **strict** jobs that **overlap** on the same day → both bars turn
      **bright red**, both job names turn red, and a red chip appears in the toolbar:
      **"{installer} — 1 clash"**.
- [x] Make one of the two jobs **flexible** instead → only the **flexible** bar changes (blue with an
      **amber dashed border**); the strict bar stays normal red; the chip turns **amber**.
- [x] Two **flexible** jobs overlapping → **no warning at all** (that's intended — they can stagger).
- [?] Tap the clash chip → a panel slides up showing the two jobs **side by side**, with the
      earlier-created one marked **"Created first (priority)"**. - Make the created priority text for both cards slightly larger and in bold to make it obvious. and another issue is that the card slides up is hindered by the bottom nav. make the clash chip scrollable for multiple clashes as well if there are alot.
- [?] **"Re-assign #N"** opens the later job's assignment panel. **"Dismiss"** hides that clash chip
      (it comes back after a refresh — dismiss is just for your current session). - it is also hidnered by bottom nav. can u make a hard rule that any design works must be above the bottom nav instead and record it down in the future...

## Section 4 — The assignment panel

- [x] As **Scheduler** (or Coordinator), tap any job row → a panel slides in with the job name, rank,
      punctuality chip and time.
- [x] A **suggested** installer shows amber with **"Suggested by {name} · Unconfirmed"** and
      **Confirm / Remove** buttons.
- [x] Tap **Confirm** → the tick turns green ("Added — not saved yet"). Tap **Save & Notify** →
      the board updates: that installer's bar is now a real (blue/red) bar, amber gone.
- [x] **Telegram** (if IDs set): the confirmed installer gets **"Job Assigned"**; the sales POC and
      coordinators get **"Installer Assigned"**.
- [x] **Add** lists the installers not yet on the job; adding + saving puts them on the board.
- [x] An installer with a same-day overlap shows a small red **"Has clash today"** line on their card.
- [x] Saving an assignment that **creates a clash** first shows the **"Installer Clash Detected"**
      prompt (see Section 5 for the buttons).
- [x] Switch to **Sales / Designer / Production** → tapping a job still opens the panel, but it's
      **view-only**: no Confirm/Remove/Add, no Save bar.

## Section 5 — Clash warning when editing a scheduled job (the old gap)

- [x] As **Scheduler**, open a **scheduled** job in the normal job form. Change its **time** so it
      overlaps another job of the same installer → **Save & notify** → an **"Installer Clash
      Detected"** box appears with **Save Anyway** / **Go Back**.
- [x] **Go Back** → nothing was saved. **Save Anyway** → it saves as normal.
- [ ] As **Coordinator**, do the same → the buttons are **"Alert Scheduler & Save"** /
      **"Re-assign a Different Installer"**.
- [x] **Alert Scheduler & Save** saves the job **and** the schedulers get a Telegram asking them to
      review the clash.
- [x] Editing something harmless (e.g. notes only) on a clash-free job → **no** prompt, saves as before.

## Section 6 — Who can see the board

- [x] The FCFS tab shows for **Sales / Scheduler / Coordinator / Designer / Production / Admin**.
- [x] **Installer** has **no FCFS tab**, and typing `/fcfs` into the address bar bounces them to
      **My Jobs**.
- [x] The old `/approvals` address now lands on the **FCFS board**.
