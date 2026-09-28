# Nic's Checklist — Archived Pending Section (2026-09-28)

> The full "Pending — Next Session" section as it stood before Nic tidied it on 2026-09-28 (~85 items → about 25). Kept word for word for the reasoning behind each item. **The live list is in [nic-checklist.md](nic-checklist.md) — do not work from this file.**

## Pending — Next Session (as of 2026-09-28, before the tidy)

### Your feedback list — 5 of 14 still to do (from 2026-09-14, one added 2026-09-15)

_You went through 13 things one at a time. A fourteenth was added on 2026-09-15 after your 18-job bulk order. **Nine are now live on production.** Items 2 and 14 shipped 2026-09-15; item 1 decided (Option A + cards-per-row) and shipped; **items 5 (driver containers) and 11 (the two daily summaries) shipped 2026-09-17** — their boxes below were left unticked at that session's close and are corrected here on 2026-09-18. **The five still open, all below:** Lock Job Details for coordinators (held on your call) · the time picker's AM/PM clicker · Support crew pills · tickable attachment buckets · job chat + files on the external installer page. Everything is written down in full — nothing depends on either of us remembering it._

**Two that only need your answer, then they're quick:**

- [x] **[Nic] Sales gets "DO issued" and "Production ready" — DECIDED and BUILT 2026-09-15.** Your call: **their own jobs only** (where they're the Person-in-Charge), not everyone's. Built the same day, on `dev` awaiting your preview — no database change was needed, and on a colleague's job the two ticks stay greyed out exactly as now. Worth knowing why own-jobs-only is the safer answer: "Production ✓" also shows on the schedule card the whole team reads.
- [ ] **Lock Job Details for coordinators — ⏸ HELD 2026-09-15 (your call), fully designed.** You chose the proper fix: a new database permission for coordinators, split off from production, rather than just greying out the screen. **What I found while scoping it, and why it's bigger than it looks:** a database permission covers a whole job, not individual boxes — it can say "may change this job" or "may not", but not "may change the team but not the address". Switched off, coordinators would lose installer assignment, pushing to schedule and marking complete. So it needs a second piece: a guard that watches *which boxes changed* and refuses the save — the same kind of rule that already stops anyone making themselves an admin. Also decided: **any job a coordinator created stays theirs to edit**, and **the two production ticks stay available to them on every job**. Nothing written, nothing applied — say go when you want it.

- [x] **[Nic] Duplicate no longer carries the location over — DONE and LIVE 2026-09-15.** You chose **(c)**: the box comes up blank, with the old address offered underneath as a one-tap fill. The original item is kept below because it reverses an earlier call of yours and the reasoning is worth keeping. ~~**Duplicate should stop carrying the location over**~~ (added 2026-09-15, after your 18-store Arnotts order) — **heads up: this reverses your own call of 2026-09-10.** Back then you asked for the address TO be copied, because a duplicate is usually the same site again and blanking it made people retype what they already had. For a bulk order it's the opposite: the address is wrong every single time, and a copy you forget to change looks finished — two jobs at the same address are invisible on the schedule. Three ways to go: **(a)** always blank it, what you asked for; **(b)** ask "same location or different?" when you press Duplicate; **(c)** blank it but show the old address underneath so one tap puts it back. **I'd suggest (c)** — you get the empty box, without bringing back the retyping that caused the September change. Your call.

**Two I'll mock up for you before building:**

- [x] **[Nic] Job card — time / sales / coordinator too far right on PC — DECIDED 2026-09-15, not yet built.** You picked **Option A: stop the card getting wider.** The cause turned out to be simple — nothing on the schedule list ever had a maximum width, so the card grows to fill whatever monitor it lands on and drags the right-hand block out with it. That's why your scheduler feels it on a 32″ and you don't. You also extended it: with the card capped there's spare room, so the list shows **two or three jobs side by side** depending on screen size, reading **down then across**. Mockup: https://claude.ai/artifact/Sz7XKcZyXfxp3SZxHD4RrB
- [ ] **Time picker — AM/PM clicker, and make it less ugly.** Noted properly: **scrolling through the whole day stays**, the clicker is a faster way in on top of it, not a replacement.

**Four that need decisions, then building:**

- [x] **[Nic] Support crew filter — DONE and LIVE 2026-09-28, 9:01pm.** Your call replaced the 7 Sept version: **role buttons only, like Admin → Users** (All · Scheduler · Coordinator · Installer · Production — no trade buttons, no subrole dropdown), and **Sales, HR / Finance, Admin and Designer are off the list entirely**. Coordinator stays in. Anyone from those four roles already on a job's crew still shows on that job, so they can be taken off. **Support crew is also on the New Job form now.** ~~Still undecided: is "Carpentry" one pill… Plus excluding Sales/Designer/Coordinator…~~ — both questions are void.
- [ ] **External installers are still missing from the New Job form** — the one half of the old item not done today. An outside contractor can only be added after the job is saved and reopened.
- [ ] **Tickable attachment buckets** — Job Order rename, ticks locking the name, ticks showing on the job card. **One thing to settle:** for Permit-to-Work and BCA a tick means "still to do", but Job Order only appears once a file is attached, which means "done". Opposite signals on one card — I'll bring you a way to show both. Needs a database change.
- [ ] **External installer page — job chat + read-only files.** Two calls needed: that page has **no login** (the link is the key), so letting it write into your job chat is a bigger step than letting it read; and **which** attachments should an outside contractor see — all of them, or only ones you tick for them? That links to the buckets item above.
- [x] **[Nic] End-of-day Telegram summaries — BOTH LIVE on production 2026-09-17.** A 4pm gaps report to schedulers and a 6pm per-person summary to crew, on the new @gq_summary_bot. The two "still open" questions were answered in the build: one bot for both, and the job form's instant messages stay for now — folding them in is the next session's item. What remains is people tapping Connect Summary, tracked in its own section below. The original item is kept: ~~**End-of-day Telegram summary — now TWO summaries (your call, 2026-09-15).**~~ Your format is captured exactly, and the driver-container design ended up needing the same mechanism, so they merged. **Answered:** it sends at **6pm**, and there are **two different messages** — a **scheduler summary** (the whole-day overview you sketched) and an **installer summary** (each person's own: what was assigned to them, what came off). **Jobs dated today are the exception — those notify immediately**, so a change made at 2pm never lands after the job should have started. **Still open:** one new bot for both or two, and whether the job form's existing instant messages fold into the same rule (a quiet board plus a noisy job form would be inconsistent). **One practical step:** everyone who should receive it has to message the new bot once first — Telegram blocks bots from messaging people who haven't started them. That's what caught the digest bot in August.

**One that's a design session of its own — ✅ THE DESIGN IS NOW DONE (2026-09-15), ready to build:**

- [x] **[Nic] Driver containers + drag-to-reassign — LIVE on production 2026-09-17.** Built from the design below, which is kept word for word because every decision in it still describes how the board behaves. **Both of the "two things still to settle" at the end were answered by the build itself** — hand-sorting runs in time order, and a job that stops being shared drops into the remaining driver's container on its own, because a job's container is worked out from its crew every time rather than stored. ~~**DESIGNED 2026-09-15, nothing built yet.**~~ We went through it properly from your two sketches and your marked-up card. Everything below is settled; say go and it gets built. Mockup: https://claude.ai/artifact/Sz7XKcZyXfxp3SZxHD4RrB
  - **Three fixed bands:** Mixed Drivers on top (jobs with 2+ drivers) · your three drivers across the middle · Unassigned at the bottom. More drivers push Unassigned further down. Each band is always in the same place, so nobody hunts for anything.
  - **It fits your crew exactly** — Rintu, Xiao Yi and CK are the only three ticked as Driver, confirmed against the live data. Three across on the scheduler's 32″ is a natural fit, and it drops to two or one on smaller screens so nobody else is affected.
  - **The card is rebuilt to your sketch** — bigger title, description over two lines, support crew and driver as name pills, and **the full address at last**. That last one turned out to be a real bug: the address is cut off at 150 pixels, so ever since address lookup went in you have been saving unit numbers and postcodes that the card then hides.
  - **All five drag rules decided**, each asking before it acts, and nothing saved until you confirm. Dropping a job into Unassigned confirms first, because it clears everyone off.
  - **The big one: dragging does NOT Telegram anybody.** Arranging tomorrow would otherwise buzz an installer ten times for a day that isn't settled, each message contradicting the last. Instead a **6pm summary** per person — except **jobs dated today, which notify immediately**, so a 2pm reassignment never arrives after the job should have started.
  - **Scheduler and admin only** can drag; everyone else sees the board read-only.
  - **Two things still to settle when you're ready:** hand-sorting jobs *inside* a container (the list is ranked first-come-first-served today, so a manual order needs somewhere to live), and what happens when a job stops being shared — drag one driver off a Mixed job and it should drop into the other driver's container by itself.
  - **FCFS joins this** — not a bug, just 2,282px wide at the AM/PM zoom, so a phone shows two hours.

### Photo deletes + Translate (from 2026-09-28, feat-installer)

- [ ] **Worth deciding: should the Files-tab attachment folders get the same 24 hours?** Today they still lock the moment a job is completed — your rule covered the three photo sections only. A one-line change if you want it.
- [ ] **Bengali translation left "level 6 warehouse" in English** on the real test, treating it like a place name; Chinese translated it. If the team finds Bengali leaves too many ordinary words in English, it is a small wording change to the AI's instructions.
- [ ] **Awareness:** the Translate button's own label reads "Translate" in English for Bengali users (the Bengali freeze); the translation itself is in Bengali.
- [ ] **Xiao Yi's 25 Sept job still has its wrong Signed DO photos** — you said to leave it. Its 24 hours had already passed, so only a manual clean-up would remove them.

### Driver board + daily summaries — ✅ LIVE on production 2026-09-17

_The board, the drag rules and both daily messages all went live at 6:42pm. The bot is wired up end to end. What's left is getting your people connected to it._

- [x] **[Nic] Summary bot created — DONE 2026-09-17.** @gq_summary_bot, token in `.env.local` and Vercel.
- [x] **[Nic] Webhook secret set in Vercel — DONE 2026-09-17.** Worth knowing for next time: **Vercel only picks up a new setting on the next deploy**, so production ignored it until a rebuild. Claude pushed an empty commit, then confirmed the webhook was actually refusing unsigned callers before registering anything.
- [x] **Webhook registered — DONE 2026-09-17.** Points at production, queue cleared, no errors. The bot can now record who has connected, so the tick in your menu is real.
- [ ] **Tell the team: profile picture → Connect Summary.** One tap each. **Telegram refuses to let a bot message anyone who has not pressed Start, and the failure is silent** — their summary simply never arrives and nobody finds out. **Four people need Connect Telegram FIRST** (they have no Telegram linked to the app at all): Firoz, Aroze, Halim and **CK — one of your three drivers**, who would otherwise miss his own jobs.
- [ ] **Watch the first real runs: 4pm and 6pm tomorrow.** Anyone who has not connected shows up in Vercel → Logs as `chat not found` against their chat id, so you can chase by name rather than guess. Today there were 12 such people.
- [ ] **Worth deciding: the bot promises something it cannot keep for some roles.** Anyone can tap Connect Summary, but a designer or HR person will realistically never receive anything — the 4pm goes by ROLE (schedulers/admins/you) and the 6pm by ASSIGNMENT (whoever is on a job). They would connect, see the tick, and reasonably decide it is broken. Claude offered to make the bot's confirmation say what each person will actually get; not built, your call.
- [ ] **Two questions the board left open, neither urgent:** whether a scheduler should be able to assign a driver straight from the Telegram message with buttons (possible — the Monday digest already works that way — and deliberately deferred until your scheduler has used the board for a few days); and hand-sorting jobs inside a container, which today runs in time order.
- [x] **[Nic] Who gets what — DECIDED 2026-09-17.** The 4pm gaps check goes to schedulers, admins and you (your account is `sales`, so you are named explicitly rather than by role). The 6pm summary goes to each installer about their own jobs. GreenqubesAI is hidden from the roster — it is not a person.
- [ ] **Heads up for your outside contractors:** the Accept and Decline buttons are gone from their link page, and every job they're on now opens straight away. Anyone who was sent a job and never pressed Accept couldn't open it before and can now — worth knowing if one of them mentions seeing more than they used to.
- [ ] **Drop `job_external_contacts.status`** — accept/decline was removed 2026-09-16, so the column is written once at creation and never read again. Small migration in a quiet session; same housekeeping as the years/skills columns below.

### Leftover files in storage (found 2026-09-15)

- [ ] **Old deleted jobs left their files behind — worth a clean-up when convenient.** Until today, deleting a job removed the record but **not the actual files**, which are still sitting in Cloudflare: invisible, unreachable, still costing you a little. That's every job ever deleted, including the 46 wiped in August. **Deleting a job now cleans up properly**, so this only concerns the old ones. Clearing them is a one-off script with a dry run first, same as the previous clean-ups — say the word.
- [ ] **One stray test file** from your first attachment test this evening, uploaded before the Cancel button learned to clean up after itself. Harmless, and the nightly sweep removes it within 7 days on its own. Mentioned only so it isn't a surprise if you go looking.

### Focus rings have never been the brand colour (found 2026-09-14)

- [ ] **Not urgent, and not something you reported — but worth knowing.** Every box in the app is written to show a soft green ring when you tap into it. That instruction has **never worked** — the way the colours are defined, see-through versions of them don't exist — so every field has shown Chrome's default blue ring since the app was built. It's the fourth thing of this exact kind after the invisible buttons, the lowercase labels and the green errors. Small job whenever you want it; say the word.

### AI importance scoring — keep revising it (from 2026-09-10, Nic)

_You said you'll keep revising this "because it's still early phase", and asked to keep being asked about it at every session start. That question is in `CLAUDE.md` and stays there — and from now on it comes with the live data and a recommendation, not just the question._

- [ ] **Watch what the Monday digest actually offers you over the next few weeks.** That is the real test of the new scoring, and it can only happen with time and real conversations. If it offers something you don't care about, or misses something you do, tell Claude the example — it's a one-line change to the AI's instructions, no database work.
- [ ] **One judgement call worth revisiting:** the AI is now told that anything it answered out of the knowledge base or from job data can never rate above a 2. That is what stopped your digest recycling notes it already had. But it also means a conversation where someone asks a question AND adds something new gets held down. Worth watching for.
- [ ] **Awareness, not a task:** the tagger is also what decides who may ever read a promoted note. It can now file under all 8 roles (it could only manage 4 before), and anything naming a person's leave, medical situation, pay or discipline is locked to HR and never remembered.

### Vault housekeeping (from 2026-09-10)

- [x] **[Nic] Both test notes deleted from the knowledge base — DONE 2026-09-10 (your call).** The 2026-05-25 greeting note (whose own text read "no information was exchanged") and the 2026-08-18 plywood weight note. Both removed from the vault and pushed; the Digest folder is now empty and the Table of Contents no longer links them.
- [ ] **Nothing to do — just confirming:** the greeting note still has one leftover row in the searchable database. You chose to let the 2:30am sync clear it, which is exactly what that clean-up step is for. Worth a glance at Admin → Health after tonight if you want certainty.
- [x] **[Nic] Vault sync confirmed healthy 2026-09-10** — Claude wrongly flagged it as broken and then checked properly: it has run every night at 02:30 without a miss, most recently that morning. No action needed. (The standing offer of a Telegram watchdog for silent failures is still in the Backup section below — that was never about this.)

### Job form — your marked-up screenshot (from 2026-09-10, DONE and LIVE)

- [x] **[Nic] Everything on the screenshot built and tested by you on the preview, 2026-09-10 → 11.** Required fields, End Date replacing the Day box, the call button, Open Maps, address suggestions, flexible-window rule, labels moved up, and Duplicate copying the address.
- [x] **[Nic] Google account set up and the key added to Vercel — DONE 2026-09-10.** Billing on, Places API (New) enabled, key restricted to that one service, and a $5 monthly budget alert created.
- [ ] **Worth a glance at some point: Admin → Health shows every address lookup.** Your budget alert emails you long before money is involved, so this is curiosity, not a task.
- [ ] **Tell Claude if the six required fields start annoying anyone.** If sales regularly pushes a job before they have the client's number, any one of the six can be dropped in a minute — it is one list in one file.
- [ ] **The "log out and log in again" notice is in the popup, not a message from you.** Anyone who does not read it still gets the new version the ordinary way; they just keep needing a manual refresh until they do a full reload once.

### Auto-refresh everyone after an update — ✅ CLOSED 2026-09-14 (from 2026-09-08)

_You asked whether a command can be sent to Vercel after each merge to `main` to hard-refresh everyone's browser. **It can't** — a deploy never reaches out to tabs that are already open, so a phone keeps running the copy it downloaded when the person first opened the page. There is no such button at Vercel or anywhere else; that is exactly why this checklist keeps saying "refresh your tabs after a deploy". **The app can be built to notice a new version itself**, though — a small build, no database change._

- [x] **[Nic] Your decision — (c), the middle one, chosen 2026-09-10 and built.** The app refreshes itself when nothing is half-written, and shows a bar to tap when something is. Nobody has to be told to refresh any more.
- [x] **[Nic] Tested live by you on the preview, 2026-09-11.** Three deploys were fired while you watched a real tab: it refreshed itself, it held off and showed the amber bar while a job form had typing in it, and it refreshed on its own once the work was saved.
- [x] **Instant-the-second-it-deploys was ruled out** — that needs Vercel to call us on every deploy, which is a paid-plan feature. It checks every 3 minutes and, more importantly, the moment a tab or app comes back to the front — which on a phone is indistinguishable from instant.
- [x] **[Nic] The one last refresh shout is done with — CLOSED 2026-09-14.** Anyone still on the pre-auto-refresh code needed one manual reload; three days on, any tab that has been closed and reopened has already picked it up by itself. Verified live the same day: production reports build `46b55d8f34ce`, which matches the current production commit, so the check every tab makes is answering correctly.
- [x] **Known limit, noted not fixed:** this only helps someone who has the app open. A tab closed for days picks up the new version when it next opens — which is what already happened before.
- [x] **Recorded for Claude, not a task for you:** anything new that holds unsaved work (a new form, a new upload path) has to say so, or it can be refreshed away mid-typing. The two job forms, job chat and every upload already do. This is written into `docs/context.md` and the 2026-09-11 session note so it survives.

### Changelog wording — too long (from 2026-09-07, Nic)

- [x] **Changelog entries tightened — DONE 2026-09-08, live on production.** You were right that they read too chatty: the first entry ran 30–47 words a bullet, a paragraph where a line would do in a popup people skim. The 2026-09-07 entry was rewritten to 9–17 words a bullet — you read it and approved the new wording — and the rule is now in `CLAUDE.md` so future entries start short instead of being trimmed later: **one line per item, say what changed and stop**, with extra words spent only in "Heads up", where someone has to act differently. Cut on purpose: the *why* behind sales closing their own jobs, the picker how-to, "Cancel is reachable again", and the note that the silent-save bug hit every field. Merged `dev` → `main` the same day (type-check + build green, production probes green) — **this was also the What's new popup's first trip to production**, so the team sees it on their next reload.
### Support crew — role/subrole pill filter + the two missing buckets (from 2026-09-07, requested by the scheduler) — ✅ REPLACED 2026-09-28

_Superseded by your 2026-09-28 call — see "Support crew filter" at the top of Pending. Kept for the record; the open boxes below are closed by it, except External installers on the New Job form, which is carried up there._

- [x] ~~**Add selectable role/subrole pills under the Support crew title**~~ — replaced by role buttons 2026-09-28 — the scheduler says finding someone in a list of the whole company is a mess. Pills sit directly below the "Support crew" heading; tapping one narrows the grid. (Note for Claude: pills are right HERE, unlike the people-picker dropdown earlier today where they were rejected — that popup is a fixed 224px, this bucket is a full-width section with room.)
- [x] ~~**Exclude Sales, Designer and Coordinator from the Support crew list**~~ — replaced 2026-09-28: Sales, HR / Finance, Admin and Designer are out; Coordinator stays. — Nic, 2026-09-07. Worth a moment's thought first: that bucket was deliberately widened to ALL roles on 2026-09-04 so anyone could be dispatched for a night job or a manpower shortage, and this partly reverses that. Everyone else stays (installers, production, scheduler, admin).
- [x] **[Nic] Electrician spelling fixed** (Nic, 2026-09-07) — verified live: Thoa now reads `Electrician`, and the misspelled `Electrcian` is gone. An earlier check the same evening still showed the typo because the edit had not been saved yet; the admin user form itself is fine and saves correctly, contrary to a suspicion raised at the time. The Electrician pill will match.
- [x] ~~**"Carpentry" is not one value, it is three**~~ — void 2026-09-28 (no trade buttons). — the live data has `Carpenter` (3), `Senior Carpenter` (1) and `Assistant Carpenter` (1). Decide: one Carpentry pill that matches all three (recommended, no data change), or tidy the subroles down to one value. Same question in miniature for `Metalwork` (4) — Nic wrote "metalworks", the data says `Metalwork`.
- [x] ~~**The seven requested filters are a MIX of roles and subroles, not all roles**~~ — void 2026-09-28. `installer` and `production` are roles; `metalworks`, `carpentry`, `electrician`, `painter` and `printing` are subroles, and every one of them sits under the production role. Installers currently have NO subroles at all (all 7 blank), so the Installer pill can only filter by role. The pill row therefore has to match on either field.
- [x] **[Nic] `Printing` confirmed as a seventh pill** (Nic, 2026-09-07) — 3 people hold that production subrole. So the pill row is: Installer, Production, Metalwork, Carpentry, Electrician, Painter, Printing.
- [x] **[Nic] Add Support crew AND External installers to the NEW job form** — Support crew DONE 2026-09-28; External installers carried to the top of Pending. — confirmed missing: the new-job form has neither, while the edit form has both. So a job can only get support crew or an outside installer after it has been created and reopened.
### Job changes after scheduling — ⚠ NEXT SESSION (Nic, 2026-09-17)

_Your call at the end of the 17th: **"next session we will do cron firing for job form changes"**. This is that item, and it now has a natural home — the two daily messages built on 2026-09-17 already gather up changes and send at fixed times, so edits made on the job form can ride the same mechanism instead of inventing a second one._

- [ ] **Two things to settle before anything is built:** which changes are worth telling someone about (date and time almost certainly; address probably; notes almost certainly not — a message for every keystroke trains people to ignore it), and whether the job form's existing instant "Save & notify" Telegram folds into the same rule. A quiet board and a noisy job form is the inconsistency to resolve.
- [ ] **Nobody is told when a scheduled job's date moves** — Claude found this while fixing your director's "says saved but doesn't save" bug. If a job is already on the schedule and someone changes its date, **the assigned crew get no Telegram and no alert at all**. That is true today for everyone — sales, scheduler, coordinator — not just the new sales permission. There is no message for it in the system. **You asked for this to be fixed next session.** It needs a short design first: who gets told (installers on the job? the person-in-charge? coordinators?), what the message says, and whether moving it a day matters as much as moving it a week.
### HR / Finance role + leave tracking — ✅ LIVE on production 2026-09-09

_Built and shipped in one session. The role, the Leave page, half-day leave, the red on-leave warnings, company events and the 2026 Singapore public holidays are all live for the team._

- [x] **[Nic] Build — DONE 2026-09-09.** All 14 planned steps, plus company events (your addition partway through) and a round of layout changes from your marked-up screenshot.
- [x] **[Nic] Database applied — DONE 2026-09-09** (you said go; Claude ran it). Three changes: the new role name, the leave + holiday tables, and company events. Applied **before** the code went live, which is the order that matters.
- [x] **[Nic] Privacy verified — DONE 2026-09-09, by you.** Signed in as sales, you confirmed the system refuses to save leave (403), refuses to show HR's leave list (403), and that the *reason* appears nowhere in the page. From Claude's side the database itself refused the write and returned nothing for the reason while a record existed. **The reason never leaves the database** — it isn't hidden by the screen.
- [x] **[Nic] Provisioning the HR account and checking the 2026 holiday dates — yours to do, 2026-09-09.** Not tracked here any more at your request. For reference when you get to it: Admin → Users → role "HR / Finance", she signs in and taps Connect Telegram, and the guided tour runs on her first visit. The two holiday dates most worth a glance against MOM are Chinese New Year (17–18 Feb) and Hari Raya Puasa (21 Mar) — the moving ones — and any of the 11 can be edited straight from the Leave page.
- [ ] **Every January, HR adds that year's public holidays** — about 11 entries from the MOM list, once a year, done from the Leave page. There is deliberately no automatic feed: Claude offered one (Google publishes a Singapore list) and you declined it. Worth knowing the reason it wasn't just laziness — a general holiday feed shows the actual festival date, while MOM gazettes the day off you actually get, including the Monday when a holiday lands on a Sunday. For scheduling installs, MOM's version is the one that matters.
- [ ] **Not done on purpose, for a future session:** leave balances (days used vs entitlement), automatic entitlement counting, staff requesting leave themselves for HR to approve, and a yearly nudge when next year's holidays haven't been entered. Today HR simply records what's already been agreed.
- [ ] **Awareness, not a task:** HR sees **every job's prices** — deliberate, she's the finance role — but view-only; sales still enters them. And leave, public holidays and company events are visible to **everyone including installers**, which was your call. Only the *reason* for an absence is restricted.

### Test run — ✅ COMPLETE 2026-09-09

_Your tick-through page: https://claude.ai/code/artifact/68d57154-b1a7-44b2-bb40-50d7f57ad032_

- [x] **[Nic] Whole checklist tested and passed on production, 2026-09-09.** Including the four that needed the live site: the Telegram escalation when leave lands on someone's job, the assistant answering about leave without ever giving the reason, the HR guided tour, and the half-day case — someone on morning-only leave put on a 2pm job correctly produces **no warning anywhere**, which is the one that proves half days actually work.
- [ ] **Still worth doing when convenient:** collect Chinese and Bengali corrections for the HR tour wording from whoever uses those languages — both were written unvetted, same as the rest of the tour.

### Voice PA — realtime voice agent (from 2026-09-04, feat-voice-pa — built, parked, NOT live)

_You asked for a "big shiny button everywhere" that salespeople can just talk to, because the job form has too many fields to key. A browser-based version was built and you tested it the same day: it understood you and created jobs, but the speech was choppy and it misheard words, so we parked it. Nothing reached production — it lives only on a preview link._

- [ ] **Your decision next session: allow a voice company into the locked stack.** Claude cannot listen or speak — Anthropic sells no voice service, so a proper realtime voice agent (the ChatGPT-voice-mode feel: half-second replies, natural voice, you can interrupt it) **must** use an outside voice provider. This is the one thing that unblocks the whole feature, and the stack rules say only you can approve it.
  - **Recommended: LiveKit** — free plan covers this team (1,000 talking-minutes a month; about 1 cent a minute after). Claude stays the brain, and — importantly — the code stays ours, so each person still only sees what their login allows. All-in guess including the voice and listening services: **US$15–30/month**.
  - Runner-up: **ElevenLabs** — the best-sounding voices and the least work, but about 8 cents a minute and the conversation runs on their servers, which makes our per-person privacy rules fiddlier to wire.
  - Ruled out: **Deepgram** — its voices are English-only, so Mandarin would be lost.
- [ ] **Optional: keep or bin the browser version.** It can stay as a free fallback for people whose phones can't do the new one, or be replaced outright. Your call during the design session.
- [ ] **The parked preview** is on branch `feat-voice-pa` (never merged): https://greenqubes-ops-git-feat-voice-pa-greenqubes-projects.vercel.app — tick-through guide at `docs/voice-pa-smoke-test.md` if you want to poke it again. Known and accepted in that version: robotic voice, mishearings, a pause before it answers, no interrupting, and on iPhone it drops to "tap, then speak".
- [ ] **Housekeeping — a third code folder now exists on this PC:** `C:\Greenqubes_GitHub\greenqubes-ops-voice-pa`. Same situation as the V3 folder below — the branch is safe on GitHub, the folder is just a second copy. Say the word and Claude removes either or both (only possible when no Claude session is running inside them).

### Guided tour (from 2026-09-04, feat-tour — live on production)

- [ ] **Collect 中文 + বাংলা corrections at the demo** — both are unvetted (your call). The tickable checklist page has a "Notes for Claude" box: https://claude.ai/code/artifact/8a1134df-9e73-4fec-b695-96894df61659 — paste whatever the team flags to Claude for a same-day wording pass.
- [ ] **The full smoke checklist was skipped at go-live** (your call after your preview pass) — the tickable page above remembers whatever you or the team tick later, so it can be chipped away at any time.
- [ ] **Post-demo polish, none urgent (parked from the final review):** keyboard Escape + screen-reader labels on the tour cards · browser Back during a tour is clunky (the tour pulls you forward again) · the bug-report window shares the tour's screen layer (works today, worth headroom) · a double-tap guard on the language chooser buttons.
- [x] **~~When Workflow V3 merges: add Projects steps to the tour scripts~~ — VOID (V3 cancelled 2026-09-04).** The standing rule at the bottom of `docs/guided-tour-smoke-test.md` still stands for any future redesign: run the tour once per affected role; a centred card where a glowing ring used to be means a tag needs re-homing.

### Provisioning overhaul (from 2026-09-04, feat-provision-organisation — launch-day build)

- [x] **[Nic] Run `npx supabase db push` for migration 0052 BEFORE the code deploys** — VERIFIED APPLIED 2026-09-04 pre-merge (Claude probed the live DB: subrole / is_driver / qualifications columns all present, driver flag already in use). Gate satisfied before dev → main.
- [ ] **Drop `users.years_experience` + `users.skills` columns** — hidden from every screen 2026-09-04 (your call: redundant); needs a small migration + type cleanup in a quiet session. Claude's memory also holds this reminder.
- [ ] **Bengali note:** the Support crew bucket still shows the old "সাব-ইনস্টলার" (Sub-installer) label — bn is frozen (boss decision), so it was left untouched. Say the word if that one label should be updated as an exception.
- [ ] **Delete the stale `feat-provision-organisation` branch on GitHub** — an identical duplicate left over from the rename (the original name was too long for a preview web address; work continued as `feat-provision`, now merged). One tap on GitHub → branches, or approve the delete command for Claude.

### Workflow V3 — project containers — ⛔ CANCELLED 2026-09-04

_Your call after the demo launch: too much feedback and too many coming changes for the V3 scope to still make sense. Round 1 stays exactly as it was built (never merged); rounds 2 and 3 are dropped. Nothing about projects ever reached production — no undo needed. One housekeeping item is left:_

- [x] **[Nic] Test projects cleared — DONE 2026-09-04 (your instruction).** Your 2 Sept smoke test's **"Test 1" (Fossil)** and **"FOS" (FOS TOS)** are gone from the shared database, along with their 8 default folders and the uploaded screenshot (removed from Cloudflare first, then the records). The dry run was checked against exactly what you approved before anything was deleted, and the script was built to refuse if any real job had been attached to either project (none were). Confirmed afterwards by a separate check: 0 projects, 0 folders, 0 files left, every job untouched. One-off script deleted after use, as usual.
- [ ] **Remove the V3 working folder** `C:\Greenqubes_GitHub\greenqubes-ops-workflow-v3` — the branch it held is now **deleted (2026-09-07)**, so this folder is pure leftover. **Confirmed safe to delete.** You asked about this mid-session; Claude verified the folder holds nothing unsaved (no uncommitted edits, every commit already on GitHub, and the three saved stashes live in the main folder, not this one). It was still there at session end, so the decision is still open. Two notes for when you do it: use `git worktree remove "C:/Greenqubes_GitHub/greenqubes-ops-workflow-v3"` rather than deleting the folder by hand (a manual delete leaves a leftover registration needing `git worktree prune`), and do it when no Claude session is running inside it. The `feat-workflow-v3` branch stays safe on GitHub either way — the folder is just a second copy of the code.
- [x] **[Nic] Branch deleted — DONE 2026-09-07 ("kill this v3 branch").** `feat-workflow-v3` is gone from this PC and from GitHub. This reverses the earlier plan to keep it forever as a record like Workflow V2 — your call, made after the cancellation. **The round-1 code is not retained**: roughly 3,700 lines across 39 files. It could only be brought back from GitHub's short grace period for deleted branches, and only if done soon (last commit `5ea130b`). What survives, all on `dev`: the design document, both build plans and the feedback log — each stamped "cancelled, do not build from this" — plus the approved mockup and the database migration file. If project containers ever come back, it starts with a fresh design session.
- [x] **[Nic] Migration 0051 stays on the database (deliberately)** — the `job_projects` table and the two extra job columns are unused and invisible, and later migrations (0052, 0053) are numbered on top of them. Removing it would disturb that chain for no gain.
- [x] **Round-1 smoke checklist page** (kept for reference only): https://claude.ai/code/artifact/91a9f0e5-a9f2-4b3f-9d01-9d83ae187246

### Auth (from 2026-08-31, fix-auth)

- [ ] **If anyone is ever bounced to `/login?error=auth` again** — the reason is now written to Vercel → Logs as a `[auth/callback] …` line; copy it to Claude. Expected to be rare now (the stale-cookie cause is fixed and the gatekeeper keeps sessions fresh).

### Design Load — designer workflow (from 2026-08-18 → 2026-08-28, feat-design)

- [ ] **First production morning check (2026-09-02):** Admin → Health should show the `design_daily_cron` run at 08:30 SGT — the reminder cron couldn't be exercised on the preview (Vercel's login protection blocks it), so this is its first real run. If it's missing, tell Claude.
- [x] **[Nic] Three queued fixes — DONE 2026-09-01** — **B3** turned out not to be a broken send: your earlier-move test's only designer was Wan Jun, whose test account has no Telegram link; the later move was blocked by the old "earlier only" rule. Rule is now Telegram on **every** shift, and any failure writes a `[jobs/patch] …` line to Vercel → Logs. **Edit 15** (edge snap) and **edit 16** (modal copy) done. Your re-test passed.
- [x] **[Nic] Merge decision — MERGED 2026-09-01**: `feat-designer-load-flow` → `dev` → `main`, live on production, probes green. Branch kept for history (no new pushes, like Workflow V2).
- [ ] **Seven small decisions (none blocking):** may sales and coordinators delete *each other's* installer suggestions (currently yes)? · should coordinators keep confirming **external** installer contacts, or become suggest-only there too? · want a non-destructive bulk "mark as read" back (Clear All now deletes)? · show *who* moved the date on due-shift cards? · give the job-form pages the new mobile top bar (hamburger)? · hide "Reopen design" on jobs whose *installation* is already completed? · check the drawer on an iPad in portrait if the team uses tablets.
- [x] **[Nic] Test-data cleanup — DONE 2026-09-01** — 9 test jobs (Test DL*, Test1 + dupe, teset g1, testest, "test design completed…", "test 1/9 tele fire designer") deleted with every attached row (files, buckets, chat, assignments, AI scores, bell rows incl. the planted reminders and the backdated JO file) and all 10 R2 files (13.5 MB). Dry run shown to you first — it caught **8 real client jobs** (Luxottica, Fossil, Onitsuka Tiger, ASICS, Aydan Co) that a blanket wipe would have taken; all kept. Script deleted after use.
- [ ] **Standing rule — replacing a departed designer (or anyone):** create a NEW Google account for the replacement (old address as alias/forward), provision fresh, reassign their open jobs while the old bar is still on Design Load, THEN remove the old account. Never rename the old account's email over — it hands the replacement the old person's private assistant chats, history attribution and Telegram link.
- [x] **[Nic] CRON_SECRET confirmed set in Vercel** (2026-08-27) — the new daily cron deliberately refuses to run without it.
- [x] **[Nic] Post-migration policy sanity query run** (2026-08-27) — the NULL on the "jobs: sales and scheduler can insert" row was expected (insert rules live in a different column); the files/jobs rules carried the new roles.

### Assistant upgrade (from 2026-08-24, chore-assistant — spec approved)

- [x] **[Nic] Phase 1 build session — SHIPPED 2026-08-25** — Sonnet 5 + thinking, Claude-grade sidebar/composer/mobile drawer, smooth streaming, Stop button, web sources; built, smoke-tested by you on the preview (incl. your phone feedback round) and merged to main same day. No migration was needed. Plan: [superpowers/plans/2026-08-24-assistant-upgrade-phase1.md](superpowers/plans/2026-08-24-assistant-upgrade-phase1.md).
- [x] **[Nic] Phase 2 build session — SHIPPED 2026-08-25** — live schedule/job/team lookups (always under the asker's own permissions), the assistant searches the knowledge base itself, real memory with the Memory view. You ran `npx supabase db push` (migration 0046) BEFORE the code deployed; preview smoke test passed and merged to main same day. Plan: [superpowers/plans/2026-08-25-assistant-upgrade-phase2.md](superpowers/plans/2026-08-25-assistant-upgrade-phase2.md).
- [x] **[Nic] Phase 3 build session — SHIPPED 2026-08-25** — chat attachments (photos + PDF) → quick confirm → pending job with auto-filed buckets + a tappable job chip, Move-to-bucket on the job form, and the 30-day scratch cleanup built in the same session (your pick). No migration was needed. Smoke-tested by you on the preview (phone) and merged to main same day. Plan: [superpowers/plans/2026-08-25-assistant-upgrade-phase3.md](superpowers/plans/2026-08-25-assistant-upgrade-phase3.md).
- [x] **[Nic] Phase 4 build session — SHIPPED 2026-08-26 (the last one — upgrade COMPLETE)** — Projects: folders in the sidebar/drawer, per-project instructions + reference files (10 files / 20 MB) the assistant knows in every chat inside the project, linked memory, Move-to-project. Migration 0047 was applied BEFORE the code deployed (Claude ran `npx supabase db push` at your request — you were away from the PC). Your caps decision: 10 files / 20 MB (100 MB isn't possible — the AI service caps one request at 32 MB and re-reads every project file on every message). Health-tab usage window filter (30 days / 7 days / Today) shipped in the same session. Smoke-tested by you on the preview (phone) and merged to main same day. Plan: [superpowers/plans/2026-08-26-assistant-upgrade-phase4.md](superpowers/plans/2026-08-26-assistant-upgrade-phase4.md).
- [x] **[Nic] Phase 3 smoke test 4 — unsupported file rejection, on PC** — PASSED 2026-08-26: the red "Only images … and PDF files can be attached" message shows and nothing uploads.
- [x] **[Nic] Deferred Phase 2 security checks — ALL PASSED on production 2026-08-26**: (1) real installer login asked about an unassigned job → the assistant found nothing and said so (the assigned job's details were correct); (2) two accounts — no chats, memories or projects crossed between accounts. Side-catch during the installer test: the assistant wrongly "confessed" to not having verified an earlier (correct) answer — root cause: its past lookups aren't kept in the conversation history, so it speculated. Fixed same day with a standing-instruction line (never speculate about past checks; just re-check) — shipped dev→main.

### Mobile app (from 2026-08-18, chore-mobile — the new roadmap)

- [ ] **Review the mobile app spec** — read [superpowers/specs/2026-08-18-mobile-app-design.md](superpowers/specs/2026-08-18-mobile-app-design.md) and give the go-ahead (or changes). Nothing gets built until you approve it; the implementation plan is written right after.
- [ ] **Ask the directors for the Apple Developer greenlight** — US$99/year, one company account, covers the whole team; installing is free for everyone. Without it the iPhone half of the team stays on the webapp and **Telegram cannot be retired**. If they say yes: request a **D-U-N-S number** for GreenQubes first (free, takes days–weeks — the longest lead-time item in the project), then enroll in the Apple Developer Program **as an organization**, set to auto-renew. A lapsed subscription stops iPhone notifications and new installs (installed apps keep working; nothing is lost permanently).
- [ ] **Create a free Expo account when the build starts** — Expo is the build service that produces the .apk and handles updates. Free tier; needs an email. Claude will tell you exactly when it's needed.
- [ ] **(Optional, anytime) Google Play account — US$25 once** — only if you ever want store auto-updates instead of sending .apk links. Skippable for a 10-person team.

### Team onboarding (was "alpha testing prep" — Sessions 21–23 closed, webapp launched v1.0.0)

_The whole-company rollout pack is ready (built 2026-08-18). Follow the runbook: [rollout/rollout-runbook.md](rollout/rollout-runbook.md) — deck + printable role cheat sheets are linked at the top of it._

- [ ] **Collect everyone's exact Google email** — one group-chat message (template in the runbook). Copy-pasted, not typed: an email typo = "account not set up" on the day.
- [ ] **Fill the roster + pre-provision everyone** — Admin → Users → Provision (email + name + role), tick digest where wanted. No one needs to have signed in first.
- [ ] **Rollout meeting** — present the deck, everyone signs in with Google + taps **Connect Telegram** (self-service now — no more chat-ID pasting); digest subscribers also press START on @Greenqubes_digest_bot once. Fallbacks for every failure mode are in the runbook.
- [ ] **After: verify every user row has a Telegram chat ID** (Admin → Users) and chase gaps while it's fresh.

### Backup — fixed 2026-08-12, two follow-ups

- [x] **[Nic] Nightly backup now working end to end** — R2 files **and** database dump both verified. `SUPABASE_DB_URL` switched from the direct host (`db.<ref>.supabase.co`, now **IPv6-only** and unreachable from this PC) to the **IPv4 session pooler** on port 5432. Set in **machine** scope; the user-scope copy was deleted so there's one source of truth.
- [x] **[Nic] Database password rotated** — done 2026-08-12, machine env var updated to the new pooler URI and verified. Note: a Supabase password reset takes ~15–30 seconds to reach the pooler; an immediate connection attempt after resetting will fail with "password authentication failed" even when the new password is correct. Wait before assuming it's wrong.
- [x] **[Nic] Both scheduled tasks now run whether logged in or not** — done 2026-08-12 via `Set-ScheduledTask` with stored credentials (the Task Scheduler GUI dialog silently reverts if the password prompt is cancelled). `Greenqubes Nightly Backup` and `Greenqubes Obsidian Sync` are both `LogonType: Password`, `RunLevel: Highest`; both test-run clean. **If the `GQAdmin` Windows password ever changes, both tasks stop working with no warning** — the stored credential must be re-entered.
- [ ] **[Nic] Check whether the old DB password is used anywhere else** — anything still holding the pre-2026-08-12 password is now broken: Vercel environment variables, Bryan's `.env.local`, any other script on the server PC. Do before go-live.
- [ ] **Nothing alerts you if the backup stops** — this is exactly how it went unnoticed for three months. The Obsidian sync and overdue cron both write a row to the `events` table, which the Admin → Health tab reads to show "last run". The backup writes nothing. Small piece of work: have `backup.sh` log an event on success, and show it on the Health tab alongside the others.
- [ ] **Decision — Telegram watchdog for silent failures** (offered 2026-08-12, infra-config) — the vault sync died for 57 days and nobody noticed because the Health tab only shows the problem if someone looks. Proposal: a small addition to an existing Vercel cron that Telegrams you when no vault-sync (and, once it logs events, backup) row has appeared for ~2 days. Runs on Vercel so it works even when the server PC is down. Say the word and it gets built in a session.
- [ ] **The R2 backup is a mirror, not history** — `rclone sync` makes the local copy match the bucket exactly, so a file deleted in R2 disappears from the local copy on the next run. It protects against Cloudflare being unavailable, not against someone deleting a file. If you want to recover deleted files, that needs dated snapshots or R2 object versioning — a separate decision.


### Future planning notes (from 2026-08-25, Phase 3 session)

- [ ] **Assistant chat: filing-only Office attachments** — let the chat paperclip accept Word/Excel/PPTX files that the AI cannot read but CAN still file into the job's buckets when it creates a pending job (today the chat accepts only images + PDF, because those are the only formats the AI service can read; the job form itself accepts everything, unchanged). Small build — say the word.
- [ ] **Assistant chat: read Office files** — convert Word/Excel/PPTX to readable text before handing them to the AI, so it can answer questions about them like it does for PDFs. Bigger build and needs a new software dependency (stack is locked, so this needs your explicit OK first). Workaround today: export the file as PDF and attach that.

### Future planning notes (from 2026-08-18, rollout session)

- [ ] **Instant promotion to the assistant's brain** — when a digest vote promotes a note to the vault, also feed it into the assistant's knowledge base immediately (embed + upsert at promotion time). Today the assistant only learns it after the server's 2:30 AM sync. Small build — needs a session. (Nic requested 2026-08-18.)

### Future planning notes (from 2026-07-22, Phase 3 session)

- [x] **[Nic] Schedule tab: list view scrolling UX** — DONE 2026-08-05, live on production. Windowed week↔month strip, jump calendar, Today button, Monday-start weeks, chips removed. Smoke test passed desktop + mobile ([schedule-list-ux-smoke-test.md](schedule-list-ux-smoke-test.md)). See [ux/ux-schedule-20260805-1-note.md](ux/ux-schedule-20260805-1-note.md).
- [x] **[Nic] Port to mobile apps — Android (.apk) + iOS (.ipa) — PLANNING DONE 2026-08-18.** Full design session held: React Native + Expo, one codebase, same backend, 3 build stages, Android-first, iPhone gated on the Apple Developer greenlight. Spec: [superpowers/specs/2026-08-18-mobile-app-design.md](superpowers/specs/2026-08-18-mobile-app-design.md). Build sessions follow once you approve the spec (see "Mobile app" section at the top).
- [ ] **Desktop apps — Windows (.exe) + macOS (.dmg)** — once live, package the system as installable desktop apps if possible. Explicitly deferred in the 2026-08-18 mobile spec — separate decision after the mobile app ships.
- [x] **[Nic] Full security + integrity audit — code/access-control portion DONE 2026-08-13.** Full-app review of access control (RLS), auth, all API routes, exposed secrets, file storage, webhooks/crons and injection surfaces. Found **4 real holes and fixed all of them live on production** — headline: any logged-in user could make themselves admin. Full write-up in [security-audit-20260813.md](security-audit-20260813.md); session note [fix/fix-auth-20260813-1-note.md](fix/fix-auth-20260813-1-note.md).
- [ ] **Security audit — remaining piece: service-outage resilience** — the code/access-control audit is done (above). Still not exercised: what actually happens if each service (Vercel / Supabase / R2 / Telegram) goes down mid-operations, and the recovery drill for each. Worth a dedicated session before go-live. (Backup/recovery itself was covered in the 2026-08-12 infra sessions.)

### Security hardening — lower priority (from the 2026-08-13 audit, fix whenever)

_None of these are blockers; the 4 real findings are already fixed. Details in [security-audit-20260813.md](security-audit-20260813.md)._

- [ ] **Make webhook/cron secret checks fail-closed** — the Telegram webhooks and the cron routes only enforce their secret *if* the secret env var is set (`if (secret) { check }`). If one were ever left unset, that endpoint would be wide open (e.g. someone could forge digest votes → auto-promote a note to the vault, or trigger Telegram blasts). Assuming the secrets are set in Vercel this is inert today — but it should refuse when the secret is missing rather than allow.
- [ ] **Stop notification-insert spoofing** — the in-app notifications table lets any logged-in user insert a notification into anyone's bell drawer (no owner check on insert). Nuisance-level only; reads/deletes are already locked to the owner.
- [ ] **Escape user text in Telegram messages** — notifications are sent with HTML formatting and drop in user text (project titles, chat text) unescaped. Not an app security hole, but a crafted title could inject a fake link/formatting inside a Telegram message.
- [ ] **Telegram notification tracker on the job form** (noted 2026-08-05, ux-jobs) — build the real notification tracker behind the "Notifications — coming soon" placeholder card (bottom of the Team tab in the new job-form layout): show which Telegram notifications were sent for the job (assignments, clash alerts, chat batches), to whom, and when. Needs its own design session.
- [ ] **Sub-jobs under a main job** (noted 2026-08-05, ux-jobs) — a job should be able to belong to a parent job (picked via a "parent job" dropdown), so one big project can hold several sub-jobs. Big piece: touches the data model, schedule/FCFS display, installer views, and possibly duplication. Needs its own design session before any build.

### Workflow V2 (from 2026-06-05, chore-jobs)

- [x] **[Nic] Workflow V2 implementation — Phase 1 (roles + workflow simplification)** — implemented 2026-06-12 on `feat-workflow-v2` (migrations 0033–0036 applied; approval workflow removed; Push to Schedule live; FCFS tab in nav for all roles). See [feat/feat-jobs-20260612-1-note.md](feat/feat-jobs-20260612-1-note.md).
- [x] **[Nic] Finish Phase 1 smoke test — sections 3–5** — PASSED 2026-06-24. Found + fixed 4 things: New Job screen wasn't running the clash check on push; clash modal now clears when you shift the time + button reworded to "Push to Schedule"; chat photo attachments showed "Unknown" sender (fixed); installer My Jobs cards weren't showing the project title (fixed). See [fix/fix-jobs-20260624-1-note.md](fix/fix-jobs-20260624-1-note.md).
- [x] **[DEFERRED to Phase 3] Clash check when editing an already-scheduled job** — moving a scheduled job's time/installer onto another scheduled job currently shows NO clash warning (the check only fires when first pushing a pending job to the schedule). This is the FCFS board's job (Phase 3) — leave it for now.
- [x] **[Nic] Clean-cut switchover (strategy reminder)** — executed 2026-08-03; see the regression test → switchover item below.
- [x] **[Nic] (Optional, for testing) See push notifications yourself** — resolved by 2026-08-18: a data check during the digest debugging confirmed **no other user row carries a Telegram chat ID anymore** (only your own account has one), so there's nothing to remove before go-live. Going forward everyone links their own via the Connect Telegram button.
- [x] **[Nic] Run `npx supabase db push` for migration 0037** — applied 2026-07-22. Installer visibility now ignores suggestions; coordinator + production can save job changes.
- [x] **[Nic] Workflow V2 — Phase 2 (job form role permissions + installer assignment)** — implemented + smoke test PASSED 2026-07-22. All 6 sections green. See [feat/feat-jobs-20260722-1-note.md](feat/feat-jobs-20260722-1-note.md) and the tick-through checklist at [workflow-v2-phase2-smoke-test.md](workflow-v2-phase2-smoke-test.md).
- [x] **[Nic] Decision — FCFS tab for installers** — dropped 2026-07-22. Installers only need their own jobs; FCFS is a scheduler/coordinator planning tool. Still shown to all other roles.
- [x] **[Nic] Workflow V2 — Phase 3 (FCFS board)** — built + smoke test PASSED 2026-07-22, all feedback fixes verified on preview. See [workflow-v2-phase3-smoke-test.md](workflow-v2-phase3-smoke-test.md).
- [x] **[Nic] Run `npx supabase db push` for migration 0038** — applied 2026-07-22. FCFS rank now counts from push-to-schedule (your decision: sales can't see each other's pending jobs, so creation order would be unfair).
- [x] **[Nic] Workflow V2 — Phase 4 (external persistent links + sub-installer + task list + external POC bucket)** — built + smoke test PASSED 2026-07-30, including your feedback fixes (bucket for every office role with sales suggestions; "Supporting Role" sub-installer Telegram). See [workflow-v2-phase4-smoke-test.md](workflow-v2-phase4-smoke-test.md).
- [x] **[Nic] Run `npx supabase db push` for migrations 0039 + 0040** — applied 2026-07-30. External contacts (lifetime links), job task list, sales-suggestion flag.
- [x] **[Nic] Full V2 regression test → clean-cut switchover** — regression test passed (Nic, on the preview); switchover done 2026-08-03: `feat-workflow-v2` → `dev` → `main`, production verified live on V2 (`/ext` + `/fcfs` serving). `feat-workflow-v2` kept for historical record (Nic's call) — no new pushes to it. See [chore/chore-config-20260803-1-note.md](chore/chore-config-20260803-1-note.md).
- [ ] **External page job chat (deferred)** — outside installers currently call the person-in-charge from their link page; live chat there needs its own session if you want it.
- [ ] **FCFS board — extra views (deferred)** — the approved mockup shows Day / Week / Month / By Project / By Installer toggles; only **Day** is built (your call, 2026-07-22). The other four need designs before a build session.

### Test data to wipe before go-live (from Phase 1 + 2 testing)

- [x] **[Nic] Delete the test jobs** — DONE 2026-08-13, went further than planned: **all 46 jobs wiped** (every test job plus the stale backlog), together with all attachments, chats, buckets, tasks and assignments, plus all job files in R2. Verified zero remaining.
- [x] **[Nic] Remove the test installer account** — KEPT (your call 2026-08-13): the wipe preserved every user account for logins.
- [ ] **Delete the test external contacts** created during Phase 4 testing — remove them from the External installers bucket on any job form (delete + their links die with them). _Note (2026-08-13): the wipe removed their job links but kept the contact pool, so their lifetime links still open (showing no jobs). Delete them from any job form's External installers bucket if you want the links dead._

### Setup (from 2026-05-29, feat-admin-3)

- [x] **[Nic] Run `npx supabase db push`** — migration 0032 applied. `deleted_at` column + partial index live on remote DB.

### Features (from 2026-05-26, vault-convention)

- [x] **[Nic] R2 human-readable folder names** — DONE 2026-08-06 with a simpler design that supersedes the June plan: new jobs get `{YYYY-MM-DD}_{Project-Title}_{8-char-code}` folders stamped by a DB trigger at creation (migration 0042); no compulsory form fields, no renaming of existing files (your call — old jobs keep code folders), titles stay optional (`Untitled` fallback). See [feat/feat-files-20260806-1-note.md](feat/feat-files-20260806-1-note.md).

### Onboarding (from 2026-05-25, chore-onboarding)

- [x] **[Nic] Add Bryan as GitHub collaborator** — done 2026-05-28
- [x] **[Nic] Send Bryan the `.env.local` file** — done 2026-05-28
- [x] **[Nic] Add Bryan's Google account to Supabase** — done 2026-05-28

### Polish (from 2026-05-20, fix-assistant-history)

- [x] **[POLISH] Assistant history sidebar refresh has a noticeable delay** — fixed: optimistic "New Conversation" entry appears immediately on first send; live title update via Haiku after first reply; `liveOptimisticIdRef` prevents duplicate entries.

### Bugs (from 2026-05-20, feat-digest-bot)

- [x] **[MAJOR] Assistant history sidebar doesn't show latest saved chat** — fixed: `refreshTrigger` prop re-fetches sidebar after save.
- [x] **[MAJOR] Clicking a history item creates duplicate conversation entries** — fixed: `isDirtyRef` + `existingId` path updates existing row in place; original topic preserved.

### Bugs (from 2026-05-18, feat-clash-resolution)

- [x] **[MAJOR] Approval page: Save failed on Approve & Schedule click** — fixed.
- [x] **[MINOR] Friday bar missing in WeekWorkloadChart** — fixed.

### Features (from 2026-05-29)

- [ ] **Scheduler: view-only of all sales jobs (including unconfirmed)** — scheduler currently only sees scheduled jobs and the approvals queue. Add a read-only view of all pending/awaiting_approval jobs so scheduler has full visibility. Placement TBD: either a new tab in the Approvals bottom nav, or a separate section. Spec + placement decision needed before coding.

### Features (from 2026-05-18, feat-clash-resolution)

- [ ] **Schedule page visual overhaul** — Nic to share screenshot of target design. Full visual redesign of the /schedule page. Spec + plan needed before coding.

### Bugs (from 2026-05-14)

- [x] **Notification: submit/approve/send-back don't fire** — not a code bug. Test accounts (seed data) have no `telegram_chat_id`. Routes work correctly; notifications will fire once real users have TG IDs added via Admin → Users tab.
- [x] **Notification: overdue cron doesn't fire** — cron entry was missing from `vercel.json` (fixed). Manual test requires `Authorization: Bearer <CRON_SECRET>` header. To test manually: `curl -H "Authorization: Bearer <CRON_SECRET>" https://greenqubes-ops.vercel.app/api/notifications/overdue`
- [x] **Bug report fails when image attached** — root cause: R2 bucket had no CORS config. Fixed: CORS configured on R2 bucket (PUT + GET from Vercel + localhost). Code hardened: screenshot upload failure no longer blocks the report submission.
- [x] **Voice note requires microphone permission every time** — fixed: stream is now requested once per component lifecycle and reused across recordings. Tracks stopped on unmount.
- [x] **Job chat: attachment doesn't trigger anything** — fixed: R2 CORS was blocking the upload (resolved by CORS config). Added `kind: 'attachment'` handler to messages route so file attachments now send Telegram notifications like voice notes do.

### Bugs (from 2026-05-14)

- [x] **[Nic] AdminRoleModal double-Yes bug** — not a code bug; modal just needed time to load. Confirmed working.

### Features (added 2026-05-14, feat-design)

- [x] **Dark mode** — Claude Warm palette; next-themes; UserMenu Moon/Sun toggle; persists in localStorage; auto-detects system preference on first visit; contrast fixes across 8 components.
- [x] **Installer clash warning** — ClashResolutionModal with substitute selection, travel-time warning, keep-anyway flow (done in feat-clash-resolution).
- [x] **Bulk delete jobs** — fully implemented: checkboxes in list view, delete bar at bottom, confirm step, parallel DELETE calls per job. Already live on dev preview.

### Features (added 2026-05-12)

- [x] **Admin role (4th role)** — `admin` added to DB enum; RLS updated; email gates replaced; AdminRoleModal in UsersTab; migrations 0018–0020 applied.
- [x] **CLAUDE.md: roles rule update** — updated to "never add or remove roles without explicit user confirmation."
- [x] **Role name capitalisation (UI)** — Pill labels, UserMenu override chip, and UsersTab select options all updated to title case. DB enum values unchanged.
- [x] **Session timeout config** — keeping forever (free Supabase tier doesn't allow timebox config). Revisit when upgrading to paid tier.
- [x] **Admin page: back arrow to schedule** — added ArrowLeft link to `/schedule` in AdminShell header.

### Features (from pre-alpha test 2026-05-11)

- [x] **Voice note: live audio waveform while recording** — show an animated audio bar (waveform / level indicator) during recording so the user knows it's capturing.
- [x] **Job creation/edit/pending: time end optional** — removed required validation from `time_end` in CoreSection. Always optional now.
- [x] **Job creation/edit/pending: job description optional** — removed required validation from `description` in CoreSection. Always optional now.
- [x] **Job creation/edit/pending: time fields persist on edit** — fixed: `reset(values)` called after successful save so form baseline syncs with saved data and `isDirty` resets correctly.
- [x] **Job creation/edit/pending: AI "Suggest" button per text column** — SuggestField component added; /api/ai/suggest route (Haiku, SUGGEST_CONFIG for easy style edits); Project Title, Description, Notes, Production Instructions all wired. Preview-first UX with Accept/Dismiss.
- [ ] **Scheduler tab: send scheduled job back to sales** — when editing a scheduled job, add a "Send Back" button (left of Mark Complete). Opens same send-back flow as approvals queue.
- [ ] **Scheduler tab: delete job** — when editing a job, add a "Delete Job" button (left of Send Back). Hard-deletes from DB + removes from site. Confirmation modal required.
- [x] **Sales tab: recall job** — when editing a job in awaiting_approval status, whole form locked + single amber "Recall" button; recalls to pending status, normal pending layout resumes automatically.
- [x] **Sales tab: pre-send popup** — reimagined as full clash resolution system: installer double-booking detection (proper time-overlap logic), ClashResolutionModal with substitute selection (free/busy badges), keep-anyway flow, time-shift picker, travel-time warning for back-to-back jobs, team workload chart with week navigation.
- [x] **`NEXT_PUBLIC_APP_URL` in Vercel** — added to all 3 environments (Production, Preview, Development).

---

