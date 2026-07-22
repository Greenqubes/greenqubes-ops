# Workflow V2 — Phase 3 Smoke Test

> Tick each box as you go. If something fails, note what you saw next to it and tell Claude.
> Phase 3 = the **FCFS Board** at `/fcfs` (day timeline + clash warnings + assignment panel),
> plus a clash warning when **editing** an already-scheduled job.

## Before you start

- [ ] **No new migration this phase** — nothing to `db push`. (0037 from Phase 2 is still the latest.)
- [ ] You're on the **Phase 3 preview** — the Vercel URL for the `feat-workflow-v2` branch
      (Vercel dashboard → greenqubes-ops → Deployments → the latest `feat-workflow-v2` one).
- [ ] You have at least **2 scheduled jobs on the same day** to play with (create test jobs if needed —
      they'll be wiped with the rest of the test data before go-live).
- [ ] For the Telegram checks: the scheduler / installer / sales POC involved need Telegram IDs set
      (Admin → Users). If none are set the messages just won't send — skip those ticks.

---

## Section 1 — The board opens and shows the day

- [ ] Tap **FCFS** in the bottom nav → the board opens (no more 404).
- [ ] Today's **scheduled** jobs are listed as rows, numbered **#1, #2, …** in the order they were
      created (first come, first served). Pending / completed jobs do **not** appear.
- [ ] **‹ / ›** moves a day back/forward; **Today** jumps back (and is greyed out while on today).
- [ ] The **AM / PM / AM/PM / 9am–6pm** buttons change the visible hours; your pick is remembered
      after a refresh.
- [ ] A day with no scheduled jobs says **"No jobs scheduled this day"**.
- [ ] On your phone (or a narrow window): the timeline **scrolls sideways** inside the board — the
      page itself doesn't stretch.

## Section 2 — Bar colours match the legend

- [ ] A **flexible-window** job shows a **blue** bar for its installer.
- [ ] A **strict on-time** job shows a **red** bar.
- [ ] A **sales suggestion** (yellow pick, not yet confirmed) shows an **amber** bar — and its rank
      number is amber too if nobody is formally assigned yet.
- [ ] A job with **no time set** (whole-day floater) spans the visible range and says **"All day"**.
- [ ] A job with **no installer at all** shows **"No installer yet"** under its name.

## Section 3 — Clash warnings on the board

- [ ] Give the **same installer** two **strict** jobs that **overlap** on the same day → both bars turn
      **bright red**, both job names turn red, and a red chip appears in the toolbar:
      **"{installer} — 1 clash"**.
- [ ] Make one of the two jobs **flexible** instead → only the **flexible** bar changes (blue with an
      **amber dashed border**); the strict bar stays normal red; the chip turns **amber**.
- [ ] Two **flexible** jobs overlapping → **no warning at all** (that's intended — they can stagger).
- [ ] Tap the clash chip → a panel slides up showing the two jobs **side by side**, with the
      earlier-created one marked **"Created first (priority)"**.
- [ ] **"Re-assign #N"** opens the later job's assignment panel. **"Dismiss"** hides that clash chip
      (it comes back after a refresh — dismiss is just for your current session).

## Section 4 — The assignment panel

- [ ] As **Scheduler** (or Coordinator), tap any job row → a panel slides in with the job name, rank,
      punctuality chip and time.
- [ ] A **suggested** installer shows amber with **"Suggested by {name} · Unconfirmed"** and
      **Confirm / Remove** buttons.
- [ ] Tap **Confirm** → the tick turns green ("Added — not saved yet"). Tap **Save & Notify** →
      the board updates: that installer's bar is now a real (blue/red) bar, amber gone.
- [ ] **Telegram** (if IDs set): the confirmed installer gets **"Job Assigned"**; the sales POC and
      coordinators get **"Installer Assigned"**.
- [ ] **Add** lists the installers not yet on the job; adding + saving puts them on the board.
- [ ] An installer with a same-day overlap shows a small red **"Has clash today"** line on their card.
- [ ] Saving an assignment that **creates a clash** first shows the **"Installer Clash Detected"**
      prompt (see Section 5 for the buttons).
- [ ] Switch to **Sales / Designer / Production** → tapping a job still opens the panel, but it's
      **view-only**: no Confirm/Remove/Add, no Save bar.

## Section 5 — Clash warning when editing a scheduled job (the old gap)

- [ ] As **Scheduler**, open a **scheduled** job in the normal job form. Change its **time** so it
      overlaps another job of the same installer → **Save & notify** → an **"Installer Clash
      Detected"** box appears with **Save Anyway** / **Go Back**.
- [ ] **Go Back** → nothing was saved. **Save Anyway** → it saves as normal.
- [ ] As **Coordinator**, do the same → the buttons are **"Alert Scheduler & Save"** /
      **"Re-assign a Different Installer"**.
- [ ] **Alert Scheduler & Save** saves the job **and** the schedulers get a Telegram asking them to
      review the clash.
- [ ] Editing something harmless (e.g. notes only) on a clash-free job → **no** prompt, saves as before.

## Section 6 — Who can see the board

- [ ] The FCFS tab shows for **Sales / Scheduler / Coordinator / Designer / Production / Admin**.
- [ ] **Installer** has **no FCFS tab**, and typing `/fcfs` into the address bar bounces them to
      **My Jobs**.
- [ ] The old `/approvals` address now lands on the **FCFS board**.
