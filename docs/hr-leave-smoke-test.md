# HR / Finance + Leave — Test Checklist

> Tick these on the **preview link** before anything goes to production.
> Branch `feat-hr-leave`. Nothing here is live yet.
>
> Anything that fails: copy the step number and what you saw, and Claude fixes
> it before the merge.

---

## 0. Before you start — the database (do this first)

The two database files are written but **not applied**. They must go in
**before** the code goes live, or every page that touches leave crashes.

- [ ] Say the word and Claude runs `npx supabase db push` (or you run it) —
      it applies **0057** (the new role name) then **0058** (the leave and
      holiday tables).
- [ ] Both are additive: nothing existing changes, and the site keeps working
      exactly as it does now while they sit there unused.
- [ ] Check the Singapore holidays landed: Admin → the Leave page will show
      **11 dates for 2026**. Compare them against
      https://www.mom.gov.sg/employment-practices/public-holidays and fix any
      that differ (you can edit them right on the page).

---

## 1. The HR account

- [ ] Admin → Users → Provision someone with the role **HR / Finance**.
- [ ] The role reads "HR / Finance" everywhere — never "Hr".
- [ ] Sign in as her. The menu shows **Schedule · Leave · Assistant** only.
- [ ] Typing these addresses by hand all bounce her back to the schedule:
      `/fcfs` · `/pending` · `/jobs/new` · `/design-load` · `/admin`

## 2. Her job pages are look-only

- [ ] Open any job as HR. The heading says **View job**, not Edit job.
- [ ] Every field is locked — nothing can be typed into.
- [ ] There are **no buttons** along the bottom at all.
- [ ] There is **no Job Chat** — not on the phone tabs, not on the desktop
      column.
- [ ] The **prices card is there**, showing quote and cost, view-only.

## 3. Privacy — the important one

- [ ] Sign in as **sales** (or any non-HR role) and open the schedule. You see
      *who* is on leave. You must **never** see the reason or the note.
- [ ] Sales typing `/leave` by hand gets bounced to the schedule.
- [ ] Ask Claude to run the check that a sales account cannot save a leave
      entry even by going around the screen — it should be refused by the
      database, not just hidden.

## 4. Recording leave

On the Leave page, as HR:

- [ ] Add a **full day** for someone. It appears under Upcoming.
- [ ] Add a **morning-only** (AM) single day for someone else.
- [ ] Add a **range that starts from the afternoon** (PM on the first day).
- [ ] Add a second entry overlapping one of the above for the **same person** —
      you should get an amber warning, and pressing Save again should let it
      through.
- [ ] Edit an entry — dates and note both save.
- [ ] Delete an entry — it takes two taps.
- [ ] Public holidays: add one, edit it, delete it.

## 5. The warnings — where this earns its keep

- [ ] **Pushing a new job**: put someone on leave onto a new job and push it.
      A **red "on leave" card** appears in the clash window, with their dates.
- [ ] In that window's replacement list, anyone else who is also away shows a
      **red "On leave"** tag and sits at the bottom of the list.
- [ ] **Editing a job already on the schedule**: move its date onto someone's
      leave. A red card appears **before** it saves. You can still Save Anyway.
- [ ] **FCFS board**: their bar is **red**, the job title is red, and a red chip
      appears in the toolbar. Tapping the chip opens the drawer showing who,
      the dates, and a button to go re-assign.
- [ ] **Assignment panel**: away people are flagged in the crew list, and in the
      "add someone" picker too.
- [ ] **Job form**: a red "On leave" chip beside the name in both the Drivers
      grid and the Support crew bucket — and it appears **as you change the
      job's date**, without saving.

### The one that must NOT warn

- [ ] Someone on **morning-only** leave, put on a **2pm** job → **no warning
      anywhere**. This is the case that proves half days work.

## 6. Who gets told

- [ ] Put someone on a scheduled job, then record leave covering that job.
      The scheduler, the person-in-charge and the coordinators should all get
      a **bell alert and a Telegram**, with a link to the job.
- [ ] Record leave for someone with **no** jobs → schedulers get a **bell only**,
      no Telegram.
- [ ] Neither message ever says the reason — just "on leave".
- [ ] Change a leave entry's **note only** → no new alert.

## 7. On the schedule — everyone sees this

- [ ] A day with someone away shows a **slate "On leave" panel** listing names.
- [ ] A public holiday shows a **green panel** with the holiday's name.
- [ ] Both appear on a day with **no jobs** too.
- [ ] Week view shows the same panels per day.
- [ ] **Sign in as an installer** — they see the same panels on My Jobs and in
      their week view. (Your call, 2026-09-08.)
- [ ] Record leave while the schedule is open on another device — it appears
      **without a refresh**.

## 8. The assistant

- [ ] Ask it: *"Can {name} take a job on {a date they're on leave}?"* — it
      should mention the leave.
- [ ] It must **never** say the reason.

## 9. The tour

- [ ] A fresh HR login is offered the tour.
- [ ] It walks: schedule → the views → date strip → **Leave tab** → prices →
      bell → account → Connect Telegram → done.
- [ ] Chinese and Bengali wording — collect any corrections from the team.

---

## When it all passes

1. Claude merges `feat-hr-leave` → `dev`, you re-check the dev preview.
2. Then `dev` → `main`, and it's live for the team.
3. Claude writes the What's new entry so everyone sees what changed.

---

## 10. Company events (added 2026-09-08)

- [ ] On the Leave page, HR adds an event with a **date range** — e.g.
      "Company retreat", 5–9 Aug.
- [ ] It appears on the schedule on **all five days**, not just the first.
- [ ] The panel is terracotta, separate from the green holiday panel and the
      slate on-leave panel — all three can appear on the same day.
- [ ] Edit the range and the name; delete it (two taps).
- [ ] Installers see it too, on My Jobs and in their week view.
- [ ] It does **not** warn or block when a job is scheduled during it —
      label only, same as a public holiday. (Say if you want it to warn.)
