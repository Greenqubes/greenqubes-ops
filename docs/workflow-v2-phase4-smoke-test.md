# Workflow V2 — Phase 4 Smoke Test

> Tick each box as you go. If something fails, note what you saw next to it and tell Claude.
> Phase 4 = **external installer links** (one permanent link per outside person), the **external
> installers bucket** in the job form, **sub-installers**, and the **task list**. This is the LAST
> phase before the clean-cut switchover.

## Before you start

- [ ] **Run `npx supabase db push` for migration 0039** — creates the external contacts tables and
      the task list table. Nothing works in this phase until it's applied.
- [ ] You're on the **Phase 4 preview** — the Vercel URL for the `feat-workflow-v2` branch
      (Vercel dashboard → greenqubes-ops → Deployments → the latest `feat-workflow-v2` one).
- [ ] Have a **scheduled test job** open as Scheduler (or Coordinator) — most of this phase lives in
      the job edit form's Team card.
- [ ] Keep your **phone** handy — the external link page is built for a phone screen, and the person
      opening it is never logged in (that's the point).

---

## Section 1 — External installers bucket (job form, Team card)

Sign in as **Scheduler** or **Coordinator** and open a scheduled job.

- [ ] Below the installer grid there are two dashed buttons: **+ Sub-installer** and
      **+ External installer**. Tap **External installer** → the bucket opens.
- [ ] **Add new contact** → enter a name + phone → **Add & generate link** → the contact appears,
      already **Assigned** (amber) to this job, and the link is **copied to your clipboard**
      (toast confirms).
- [ ] The little **link icon** on a contact card copies their link again any time.
- [ ] Open a **different** job → External installer bucket → the same contact is listed under
      **Previously used** with their phone and past-job count → tap **+ Assign** — no re-typing
      their details.
- [ ] Tap the **Assigned** chip → the contact is unassigned from this job (their other jobs are
      untouched).
- [ ] **Sales / Designer / Production** do not see the External installers bucket at all — it's a
      scheduler/coordinator tool.

## Section 2 — The external person's link page

Open the copied link **in a private/incognito window or on your phone** (no login!).

- [ ] The page greets the contact **by name**, with **Needs response / Upcoming / Past** sections.
- [ ] A newly-assigned job sits under **Needs response** with **Accept / Decline** buttons right on
      the card.
- [ ] Tap **Accept** → the job moves to **Upcoming** (and in the office job form, the contact's chip
      turns **green "Accepted"** after a refresh).
- [ ] Tap **Decline** on another job → it drops to **Past** as **Declined** (office chip turns red).
- [ ] Tap an **accepted** job → detail view: date/time (with "arrive by" note when strict),
      location, site contact, notes, **attachments** (from the job's document buckets — downloads
      work), **Open in Maps**, and a **person-in-charge card with a Call button** (job chat for
      externals is deferred — calling is the channel for now).
- [ ] A **pending or declined** job does **not** open the detail view — details unlock only after
      acceptance.
- [ ] The link is **permanent**: close everything, reopen the same URL → still works. Same link
      shows any new job you assign them later.

## Section 3 — Delete kills the link, restore revives it

Back in the job form as Scheduler/Coordinator:

- [ ] Tap the **bin icon** on a contact → a confirmation warns their link dies **immediately** and
      shows **how many active jobs are affected** → **Delete contact**.
- [ ] Refresh the contact's link page (incognito) → **"This link is no longer valid"**.
- [ ] The deleted contact stays visible in the bucket — greyed out, struck through, with an amber
      **"N jobs suspended"** strip and a **Restore** button. (They stay restorable forever.)
- [ ] Tap **Restore** → confirmation says the **same link** comes back with all history → confirm →
      refresh the contact's link page → **everything is back exactly as it was** (same URL, same
      jobs, same accept/decline states).

## Section 4 — Sub-installers (job form, Team card)

- [ ] As **Sales** on a **pending** job: tap **+ Sub-installer** → the bucket opens with the same
      installer cards, minus anyone already picked on the main grid. Tap one → **amber**
      (a suggestion, saved instantly — same rules as the main grid).
- [ ] As **Scheduler/Coordinator** on that job: the sales sub-suggestion shows amber with
      **"Sales suggested"**. Tap it → turns **green** → **Save & notify** → the sub-installer gets
      the **Telegram "Job Assigned"** message.
- [ ] The confirmed **sub-installer signs in** → the job appears in **their My Jobs list** like any
      assigned job.
- [ ] A **suggested** (amber, unconfirmed) sub-installer signs in → they must **NOT** see the job.
- [ ] Saving the **main** installer grid does **not** wipe the sub-installers (and vice versa).
- [ ] Give the sub-installer's **main** installer slot on another job a clashing time → **no clash
      warning fires because of a sub** — subs are helpers, they never trigger clash warnings
      (decided in Phase 3).
- [ ] **Remove** on the bucket header clears the sub picks and collapses the bucket.

## Section 5 — Task list (job form)

- [ ] As **Sales or Coordinator**: the **Task List** card shows "No tasks yet" → **Add task list** →
      type a task, press Enter or tap **+** → it appears. Add a few more.
- [ ] **Drag the dots handle** to reorder → refresh → the new order stuck (try this on your phone
      too — drag should work with touch).
- [ ] **X** deletes one task; **Clear all** empties the list.
- [ ] Checkboxes in this edit view are **decorative** — office roles can't tick them.
- [ ] As the **assigned installer** (or sub-installer): the job form shows **interactive
      checkboxes** with a **progress bar** — tick two → bar updates → all ticked → **"All done"**.
- [ ] On the **external contact's link page**, an accepted job shows the same task list — ticking
      there updates the same list everyone sees (refresh the office view to check).
- [ ] A job with **no tasks** shows nothing at all to installers/externals (no empty card).

## Section 6 — Nothing else broke

- [ ] Main installer **suggest → confirm → Telegram** flow from Phase 2 still works.
- [ ] **FCFS board** still loads and shows the day correctly (subs don't add clash chips).
- [ ] **Push to Schedule** on a new job still runs the clash check.
- [ ] Normal login/app pages still require sign-in — only `/ext/...` links are public.

---

## Notes for Claude (fill in during the test)

-
