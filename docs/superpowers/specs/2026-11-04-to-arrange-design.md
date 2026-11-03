# To arrange: sales marks a job ready, the scheduler proposes the install slot

_Designed with Nic, 2026-11-03 → 04. Mockups: `.superpowers/brainstorm/1380-1793719370/content/` (`where-it-lives.html`, `round-trip.html`), which are local and not committed._

## Why

Some clients don't give an install date. They ask **us** to propose one, and we pick it from our own install schedule. Today nothing supports this:

- **No "ready" signal.** An Ongoing job (`awaiting_date`, since 2026-10-19) means "client confirmed, date to come". It does not mean "ready to install". Design or production may still be running, so the scheduler cannot tell which Ongoing jobs he can start arranging.
- **No alert.** Sales has to chase the scheduler outside the app.
- **No place for the limits sales already knows**, such as "after the 10th" or "night only", and no place for the scheduler's proposal while sales checks it with the client.

Nic: *"once i have a job confirm and ready for installation i can check on my end as sales and it will create a alert which notify scheduler which job can start arranging … a tab which i can insert a date range or fix date or any date option for my scheduler to see at a glance and he will insert accordingly."*

## The round trip (Nic's decisions)

1. **Sales marks an Ongoing job "Ready to install"** and gives a guide. The guide can lock the day, the time, or neither:
   - **Day:** Any day · Between _date_ and _date_ · Fixed _date_
   - **Time:** works like the job form today, with a start time and an optional end time. Left blank means any time. Filled in means it is locked for the scheduler.
   - An optional note to the scheduler.
   - Crew: sales **suggests** as usual (yellow). Only the scheduler confirms crew. Nic: *"crew remains strictly to scheduler to confirm only. sales can only suggest as usual."*

   **Alert:** every scheduler gets a bell notification and a Telegram.
2. **The scheduler offers a slot**: day, start time (optional end time) and crew. Nic: *"day and time and who goes all offers."* **Crew is optional in an offer** (Nic, 2026-11-04, after the builder check). A slot weeks ahead may have nobody realistic yet, so the scheduler can offer just the day and time and add crew closer to the date. Anything sales locked stays locked. The day must sit inside sales' range or equal the fixed day. **Alert:** the job's sales PIC and the coordinators on it get a bell notification and a Telegram.
3. **Sales checks with the client.** Nic: *"come back to me first since its us proposing."* While the client thinks it over, **the job stays OFF the schedule**. Nothing is held and no crew are booked (Nic: *"stay off until client says ok"*).
4. **Client OK → it goes on the schedule** with the offered day/time and the offered crew confirmed. The crew get their usual assignment Telegram at this point and never before.
   **Client said no → back to the scheduler** with sales' reason (Nic: *"sales will alert scheduler to arrange another date then"*). **Alert:** every scheduler, by bell and Telegram. The guide, the reason and the last offer stay visible so he can offer again.
5. **Crew clash at Client OK** (Nic: *"send it back to scheduler instead. sales isnt blocked anyways"*). Nothing is held, so the offered crew may have been booked elsewhere in the meantime. If Client OK finds a hard clash, the job **does not** go on the schedule. It returns to the scheduler marked **"client agreed _day, time_; crew now clashes"**. A hard clash means a driver time overlap or someone on leave. The client has already agreed to the day and time, so the scheduler only fixes the crew and puts it on the schedule himself, with no second trip to the client. Sales' press still counts: their part is done.

## Where it lives (Nic's pick: option A)

- **The Jobs tab (`/job-list`) gets a third list**, and the switch order becomes **Drafts · Ongoing · To arrange** (Nic reordered it from the mockup, so it follows a job's life left to right). Roles without drafts (designer, production, hr) get **Ongoing · To arrange**.
- Inside To arrange, jobs are **grouped by whose turn it is**:
  - **Needs a date** (scheduler's turn), on top. Includes "client said no" (with reason) and "client agreed, crew clashes" (with the agreed slot). Each card shows the guide, the sales person and how long it has been ready. Buttons: **Offer a date** / **Offer another date**.
  - **Offered to client** (sales' turn), below and visibly quieter. Shows the offered day, time and crew. For sales the buttons are **Client OK — put on schedule** and **Client said no** (a reason is required on "no").
- A job marked ready **leaves the Ongoing list** and appears only under To arrange, so it is never in two places.

## Calls Claude made (Nic approved them as a set, 2026-11-04)

- **If sales already knows both the day and the time**, they skip all of this and Push to Schedule as today. To arrange is for when at least one is missing.
- **The offered crew stays with the offer, unconfirmed**, until Client OK.
- **The sales side** (mark ready, Client OK, Client said no, pull back) = the job's creator, its sales PIC, the coordinators on it, and admin. This is the same group as today's Ongoing editing rule minus the scheduler (`canEditAtStage` in `src/lib/utils/job-stage-rules.ts`).
- **The scheduler side** (Offer a date, send back) = scheduler and admin.
- **Who is alerted**:
  - Ready, client-said-no and crew-clash-return go to **all schedulers** (`getSchedulers`, as the push route uses).
  - Offers go to the **sales PIC and the coordinators on the job**.
  - Every alert is both bell and Telegram.
- **Required fields:** the usual push fields **except date** must be filled before **Send to scheduler**: title, company, client, contact no., location. That is Ongoing's existing `REQUIRED_FOR_STAGE.ongoing`, re-checked at that button, so Client OK can never stall on a missing field.
- **Nothing fits:** instead of offering, the scheduler can **send it back to sales with a note** ("fully booked 10–20 Nov"). It returns to sales' side as "scheduler couldn't fit — see note". Sales then adjusts the guide and re-sends, or pulls it back.
- **Not ready after all:** sales can pull a job out of To arrange back to plain Ongoing **at any point before Client OK**. The arrangement is cleared.
- **Who sees To arrange:** everyone who sees Ongoing today (sales, coordinator, scheduler, admin, designer, production, hr). Designers, production and hr see it **read-only, with no buttons**, so ready jobs do not vanish for them. Installers never see it, because it is still an Ongoing job.
- **Default list when opening the Jobs tab:** **To arrange for schedulers** (it is their inbox). Everyone else opens on **Ongoing** as today.
- **The name stays "To arrange"**, even though the 4pm Telegram is called "jobs still to arrange". That message is about **scheduled** jobs with no driver, and it is unaffected by this feature.

### Settled after the builder check (Claude's calls, 2026-11-04)

- **What counts as a clash at Client OK.**
  - "Clash" means whatever the existing crew check counts as one today: firm overlaps, soft overlaps and leave (`assign-installers?checkOnly`). Back-to-back warnings and away never send a job back.
  - **Only NEW clashes count.** When the scheduler makes an offer, he sees the same clash warnings as on Save & notify, and he may knowingly offer past them, as he can today. The offer records what he accepted. Client OK sends the job back only for a clash that was not there when he offered. Without this, a knowingly-accepted clash would bounce the job every time.
- **Outside contractors are part of "who goes".** The scheduler can include them in the offer, and they are confirmed at Client OK like drivers and support crew. While a job is in To arrange, only the scheduler/admin confirm contractors, matching "only the scheduler confirms crew". The external-contacts route's rules for jobs outside To arrange do not change.
- **Bin: the arrangement comes back intact on restore.** A mistaken delete should undo cleanly. A stale offer is safe because Client OK re-runs the crew check anyway.
- **The scheduler can withdraw his offer** while it is with the client, for example if a vehicle or a priority job takes the slot. The job returns to "Needs a date", and sales gets a bell notification and a Telegram saying the offer is withdrawn and not to confirm it with the client. He makes a new offer from there. There is no separate "edit the offer" path: withdraw, then offer again.
- **Left out for now:**
  - offering several dates at once
  - reminders when an offer sits with sales for days
  - a nav-bar badge
  - guided-tour changes

## Goals

- The scheduler sees at a glance every job he can arrange, what limits sales gave, and what is waiting on whom.
- Sales and the scheduler are each told the moment it is their turn, inside the app and on Telegram.
- A proposed slot never reaches the schedule, the crew or the installers until the client agrees.

## Non-goals

- Holding or pencilling a slot on the schedule while the client decides (Nic declined this).
- Letting sales confirm crew (unchanged: suggest only).
- Changing how Push to Schedule, Save & notify, the Drivers board, FCFS, the 4pm or the 6pm summaries work for jobs that never enter To arrange.

## Anti-goals (would be a failure even if it "works")

- **A job in To arrange showing up anywhere a scheduled job shows**: the schedule (all views), the Drivers board, FCFS, the 6pm installer summary, the installer dashboard, `/ext/*` contractor pages, or the assistant's schedule tools. It must remain an Ongoing job in every reader until Client OK.
- **Any crew member hearing about the job before Client OK**, by Telegram, bell, or by being able to open it. Today 0037 lets an installer see a job they are formally assigned to. **The offered crew must therefore never be written as formal `job_assignees` rows before Client OK**, and must not be mixed into sales' yellow suggestion rows either. `formalCrewAllowed` already refuses formal crew on Ongoing; keep that the backstop.
- **A silent failure at any step.** This repo's recurring bug: an UPDATE that RLS filters out returns 204 and the UI says "saved". Every write in this flow must confirm the row came back, and every alert send must be awaited and its failure logged (Vercel freezes a function once it responds).
- **The two sides disagreeing about the date.** While a job is in To arrange there must be ONE source of truth for its proposed day/time. The job form's own Date/Time fields must not be able to silently contradict the offer.
- **Losing the arrangement on delete → restore.** The Bin must bring it back intact.

## Constraints (from the project)

- **Stages.** The status ↔ stage mapping lives only in `src/lib/utils/job-stage.ts`. A job in To arrange is still stage **Ongoing**, raw status `awaiting_date`. Recommendation: do **not** add a job status. Store the arrangement state alongside the job instead, because raw status drives RLS (0037, 0053, 0062), every query filter and the stage route. The builder may disagree with reasons.
- **Client OK reuses the existing push path, not a copy of it.** It runs the crew clash check (`/api/jobs/[id]/assign-installers?checkOnly`, the leave and away rules, `pushCrewPlan` / `saveCrewPicks`), then `/submit`, then writes the crew. Sales cannot write formal crew under RLS, so Client OK must be a **server route** that re-verifies the caller is on the sales side, then writes the scheduler's crew with the service key. Same pattern as the stage route.
  - Hard clash (driver overlap, or leave, which is a red clash everywhere) → the step-5 return.
  - **Away** is amber and never blocks (2026-10-12 rule): it goes through, and the scheduler's alert mentions it.
- **Don't double-notify on Client OK.** The normal push Telegrams all schedulers "New Job — Assign Installer" (see `shouldNotifyOnPush`).
  - **If the offer named crew:** the crew is already chosen, so send the schedulers a short "client agreed, it's on the schedule for _day_" instead. The crew get the normal assignment Telegram.
  - **If the offer named no crew** (allowed, see step 2): the job lands on the schedule with no crew and nothing to clash-check. The schedulers get the **normal** "New Job — Assign Installer" message, and from then on it is an ordinary scheduled job. The 4pm "jobs still to arrange" message lists it until a driver is confirmed.
  - **If the offer named some crew but no driver:** confirm the people named, and still send the normal "Assign Installer" message.
- **Pending privacy (0062).** If the arrangement lives in a **new job-linked table**, it needs the restrictive `job_hidden_from_me` policy, a place in `BIN_CHILD_TABLES` plus the `restore_job_snapshot` RPC's list, and **explicit grants** to `authenticated` + `service_role` (CLAUDE.md hard rule, never `anon`). Columns on `jobs` avoid all three. Builder's call; state which and why.
- **Migrations:** claim the number at implementation time (CLAUDE.md: `migration list`, then every branch). Never reserve one in the plan; write `<N>`. Apply it **before** pushing code that selects new columns. **Previews share the production database**, so keep it additive.
- **UI rules:**
  - Overlays sit at `z-[60]`+, above the bottom nav, and below the toast layer at 100.
  - Tall pop-ups use `Modal`'s opt-in `scrollBody`, and only after checking their dropdowns portal (`TimeSelect` and `LocationInput` do).
  - Anything on the job form that pops up must portal to `<body>` (the `CollapseCard` clipping rule).
  - Theme colours are bare `var()`, so no `/opacity` variants. Tokens are `brand-*`; errors are `--bad`.
  - Date labels are always English.
  - New text goes in `en.ts` + `zh.ts` only; bn falls back.
- **The Jobs tab** is `src/features/stages/StageListShell.tsx` with `stage-view.ts` (`resolveStageView`, `jobListHref`, `?view=`). `/ongoing`, `/pending` and `/drafts` must keep redirecting. `/schedule` is hydration-sensitive (#418), so anything read from browser storage is read after mount.
- **Search.** The Jobs tab search should keep working across the new list. `matchesWords` is the app's single search rule.
- **Tests** follow the repo habit:
  - Pure rules in `src/lib/utils/` with standalone tests, written first and watched failing.
  - For example: guide validation ("offer inside range / equals fixed day / respects locked time"), who may press what, and the Client OK outcome (on schedule vs back to scheduler).
  - Verify against the real database, not only fixtures.

## Left to the builder

- Data shape: how the guide, the offer (including its crew) and the turn/state are stored.
- Whether the offer carries an end date for multi-day jobs. The job form has an End Date, so mirroring the form is the natural default.
- What the job page itself shows while a job is in To arrange. Probably a small card with the guide/offer and the same buttons as the list, so people who open the job from a Telegram link can act there.
- What editing the guide after an offer does. Suggested: it withdraws the offer and returns the job to "Needs a date".
- Moving a To arrange job back to Drafts, or a scheduler using the existing Push to Schedule directly. Each should clear the arrangement, not strand it. (Deleting is different: the Bin keeps the arrangement so a restore brings it back. See "Settled after the builder check".)
- How the scheduler's My Jobs panel ("Not scheduled") marks To arrange jobs, if at all.
- Telegram wording, following the existing templates in `src/lib/telegram/templates.ts`.
