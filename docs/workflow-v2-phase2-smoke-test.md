# Workflow V2 — Phase 2 Smoke Test

> Tick each box as you go. If something fails, note what you saw next to it and tell Claude.
> Phase 2 = role-locked job form + installer **suggestion** (yellow) → **assignment** (green) flow.

## Before you start

- [X] Migration **0037** applied (`npx supabase db push` → confirmed). *(You did this.)*
- [X] You're on the **Phase 2 preview** — the Vercel URL that contains `git-feat-workflow-v2`
      (Vercel dashboard → greenqubes-ops → Deployments → the `feat-workflow-v2` one).
- [X] You know how to switch roles: **User menu → role switcher** (you sign in as admin; switch to
      sales / scheduler / coordinator / designer / production / installer to test each view).
- [ ] For the Telegram checks: at least one **installer** and the **sales POC** need a Telegram ID
      set (Admin → Users). If none are set, the messages just won't send — that's expected, skip those ticks.

---

## Section 1 — Sales suggests an installer (yellow)

- [X] Switch to **Sales**. Create a new job (or open a **pending** one).
- [X] In the Installers grid, tap an installer → the card turns **yellow** with **"You suggested"** underneath.
- [X] Tap it again → the yellow clears (suggestion removed).
- [X] Suggest one installer, then **leave and reopen** the job → the yellow suggestion is still there
      (it saves instantly, no Save button needed).
- [X] On a **scheduled** job as Sales, the installer grid is **view-only** (you can't change picks).

---

## Section 2 — A suggestion stays hidden until it's confirmed

- [X] With an installer only **suggested** (yellow) on a job, switch to that **Installer**.
- [ ] Their **"My Jobs"** does **NOT** show the suggested job. ✅ (This is the key safety check.) - Still shows on installer page even when suggested the moment the job is created
- [ ] Switch to **Scheduler** and open the **Schedule** — the suggested installer does **not** appear
      as a confirmed name/avatar on that job in the calendar. - cant test this without prior working

---

## Section 3 — Coordinator / Scheduler formally assigns (green)

- [X] Switch to **Scheduler** (or **Coordinator**). Open the job with the yellow suggestion.
- [X] The suggested installer shows **yellow** with **"Sales suggested"** underneath.
- [X] Tap that installer → it turns **green** (formally selected). Tap **Save & notify**.
- [X] Reopen the job → the installer is **green**, and the **yellow suggestion is gone** (cleared).
- [X] **Telegram** (if IDs set): the **installer** gets a **"Job Assigned"** message; the **sales POC**
      and any **coordinators** get an **"Installer Assigned"** message listing who was assigned.
- [ ] Switch to that **Installer** → the job now **appears** in "My Jobs". ✅ - cant test this without prior working

---

## Section 4 — Role locks on the job form

Open the **same scheduled job** as each role and check what's editable:

- [X] **Designer** — everything is **view-only**; there is **no Save button** at the bottom (chat still works).
- [X] **Production** — can tick **"Production ready"** and **"DO issued"**, edit **Production instructions**,
      and **upload production photos**; the rest of the form (title, dates, client, installers) is **locked**.
      Has a **Save Changes** button.
- [X] **Production** — tick "Production ready", Save, reopen → the tick stuck.
- [X] **Sales / Scheduler / Coordinator / Admin** — can edit the main job details as normal.
- [X] **Installer** — view-only job details; can still upload completion photos + sign DO + chat; no Save bar.

---

## Section 5 — Action bars are correct per role

- [X] **Sales, pending job** — sees **Save Changes** + **Push to Schedule**.
- [X] **Sales, scheduled job** — sees **Save Changes** only (full width).
- [X] **Scheduler / Coordinator** — sees **Save & notify**.
- [X] **Production** — sees **Save Changes**.
- [X] **Designer / Installer** — no Save button.

---

## Section 6 — Regression (make sure nothing old broke)

- [X] **Sales push to schedule** still works: create a job as sales, Push to Schedule → job becomes
      scheduled, "Pushed to Schedule!" popup, schedulers get the "New Job — Assign Installer" Telegram.
- [X] **Clash detection on push** still works: two jobs, same installer, overlapping time → clash modal
      appears before the push (as in Phase 1).
- [X] **Job chat** works for all roles (send a message, see it live).
- [X] **Existing installer dashboard** still shows jobs the installer is **formally** assigned to.
- [X] **Old preview / live site unaffected** — open the normal `greenqubes-ops.vercel.app` (dev/main
      code): it still works exactly as before (migration 0037 does nothing there).

---

## Noted Bugs

- [] Attachement for Permit-to-Work, BCA, Designer JO, Others - File attachment says upload failed upload. please check if this is preview issue.

## If a test fails

Write what you saw next to the box (e.g. "Section 3: yellow didn't clear after assign") and tell Claude.
All Phase 2 code is on `feat-workflow-v2` (commit `9cfa4d9`); fixes go on the same branch.

**When all sections pass → Phase 3 (FCFS board) is next.**
