# Nic's Checklist — Things Only You Can Do

> Claude handles the coding. This file tracks every manual action, setup step, or decision that needs a human. Read this at the start of every session.

_Last updated: 2026-09-10 (fix-assistant — **the AI's importance scoring is fixed and live.** It was marking the wrong things important: every conversation it rated highly was about supplier prices, and two of those were just someone ASKING a price the system already knew — so your Monday digest was offering to save notes the vault had already written. It now judges whether something NEW arrived that nobody had written down. Your 14 saved conversations were re-scored: **the Monday digest now offers 1 conversation instead of 3**, and it's the right one — the lightbox pricing you told it to capture. Also fixed quietly: the AI could only file knowledge under 4 of your 8 roles, so anything for HR, designers, production or coordinators had nowhere to go — and an HR chat mentioning why someone was on leave would have defaulted to "everyone can read this". Both test notes are cleared out of your knowledge base. **Nothing for you to test** — there's no screen to look at, and it was checked against your real conversations four times. **I raised one false alarm and want it on the record: I said your vault sync looked broken since August. It isn't — it has run every single night without a miss.** A note looked missing because you had already deleted it on 18 August and my copy was out of date.)_
_Last updated: 2026-09-09 (feat-admin — **HR / Finance role + leave + company events LIVE and fully tested on production.** Built and shipped in one day: the role, the Leave page, half-day leave, red on-leave warnings everywhere crew get assigned, company events across a date range, and the 2026 Singapore public holidays. You verified the privacy yourself from a sales login — the reason for an absence never leaves the database. Three database changes applied first, on your go. Also app-wide: buttons and status labels now read properly instead of all-lowercase. **Next:** provision the HR account, and check the 11 holiday dates against MOM.)_
_Last updated: 2026-09-04 (feat-provision — **provisioning overhaul LIVE on production for launch day.** Name cards without emails (attach later), link dots (red = no email / amber = waiting for sign-in / green = linked), subroles + Driver + licences on every card, admin filters + rename, and the Support crew bucket for dispatching production staff onto install teams. Shipped together with the guided tour (your test) in one dev → main merge; production probes green. Demo is today — refresh any open tabs before using them.)_
_Last updated: 2026-09-04 (feat-tour — **Guided app tour LIVE on production**, all 6 roles in English/中文/বাংলা. First sign-in offers the walkthrough, "Start tour" leads to a language chooser that sets the person's whole app language, and it finishes on Connect Telegram. Both translations are unvetted (your call) — collect corrections at the demo. Your go-live merge also shipped the provisioning overhaul; its migration-0052 gate was verified applied by a live-DB probe before the merge and ticked below. New "Guided tour" section under Pending: demo corrections + post-demo polish.)_
_Last updated: 2026-09-04 (chore-workflow — **Workflow V3 (project containers) CANCELLED and archived**, your call after the demo. Round 1 stays exactly as built but was never merged, so nothing about projects ever reached production — no undo needed, nothing to check. Rounds 2 and 3 are dropped. The branch is kept forever as a record, the design documents are stamped "cancelled — do not build from this", and the guided-tour follow-up about Projects is void. The two leftover test projects were cleared the same day on your word (dry-run checked first; jobs untouched). **One small decision left** in the Workflow V3 section below: removing the second copy of the code folder from this PC.)_
_Last updated: 2026-09-04 (feat-installer — **installer completion flow LIVE on production.** Installers now finish their own jobs: the Completed button on the job page is grey until a completion photo is uploaded, green after, and Telegrams the sales person-in-charge when pressed. "Signed DO (Optional)" only appears once production ticks DO issued. Every installer can browse ALL past completed jobs from the Completed tab (photos, files, chat, tasks, crew) — pending/scheduled stay private, money stays invisible. Your "button not visible in daylight" catch also uncovered 30 colour classes across the app that had never worked — all restored. Refresh any open tabs before using the app.)_

_Last updated: 2026-09-04 (feat-assistant — **Voice PA built, tested by you, and PARKED — nothing went live.** A big glowing mic button on every page opens a talk-to-it voice mode that creates jobs through the existing assistant. It works, but on your Android test it was choppy and misheard you, so the browser-based approach is set aside. **Next session designs the real thing: a realtime voice agent.** One decision is waiting for you there — it needs a new voice company added to the locked stack (Claude has no voice service of its own). Recommendation and costs are in the new Voice PA section below.)_

_Last updated: 2026-09-07 (fix-schedule — **Mobile fixes LIVE on production.** Your phone report turned out to be two problems, not three: long job titles were stretching the schedule cards wider than the screen (that's the sideways sliding — and the reason you could suddenly pinch-zoom out), and both slide-out panels were being told to be "full screen height", which on Android means the height with the address bar hidden — so Account sat just below what you could see. Both fixed and merged to production on your say-so; probes green. Pinch-zoom was deliberately left switched on — see the note below. Anyone with the app open should refresh their tab.)_
_Last updated: 2026-09-07 (chore-admin — **HR / Finance role + leave tracking DESIGNED and PLANNED — nothing built.** Your eighth role: she records who's on leave and from when to when, and she can see every job's prices (view only — sales still enters them). Leave then shows as a **red "on leave" warning** wherever anyone gets put on a job, half days included, and the *reason* for the leave (annual / medical / emergency) stays visible only to her and you — everyone else just sees "On leave". Singapore public holidays get their own list she keeps up to date yearly. Also today: the V3 folder was checked and cleared for deletion — it holds nothing unsaved — but it was still on this PC at session end, so that decision stays open. Nothing has changed on the website or in the database. New **HR / Finance role** section at the top of Pending; say go and the build starts.)_
_Last updated: 2026-09-07 (chore-config — **the Workflow V3 branch is now deleted**, your call. It is gone from this computer and from GitHub, which reverses the earlier plan to keep it forever as a record — so the work built in round 1 is not kept. Nothing on the website or in the database changed: V3 code never went live, and the two leftover test projects were already cleared on 4 Sept. The design documents and the mockup are still saved for reference, each marked "cancelled". One tidy-up is left: deleting the leftover V3 folder from this PC, which can only happen when no Claude session is running inside it.)_

---

_Last updated: 2026-09-14 (fix-jobs — **six of your thirteen are live; nine are waiting for tomorrow.** You went through the list one at a time and every item is written down in your own words — nothing depends on either of us remembering it. Fixed tonight: the time picker is no longer cut off and scrolls properly, videos attach to completion photos (up to 100MB), production and installers can delete photos they attached by mistake, the chat window opens beside its button after you move it, address suggestions stopped popping up every time a job is opened, and error messages are red again — they had been green since August, **including a broken cron showing green on the Health page**. **Two of those you caught yourself while testing**, and one of them was a fault I introduced an hour earlier — that back-and-forth is what found them. **The FCFS "out of bound" is not a bug** — you confirmed only the board slides, which is it working as built; the real problem is it's too wide for a phone, so it moves to the design session with your driver containers sketch. Nine items and their open questions are at the top of Pending, in the order I'd suggest.)_

_Last updated: 2026-09-11 (feat-jobs — **your job form screenshot is built and live, and the app now updates itself.** Six fields must be filled before a job can go on the schedule (title, date, company, client, contact number, address) — a half-filled draft still saves, and on an existing job those details can be changed but not emptied. Typing an address now suggests real Singapore places and fills in **the unit number and postcode**, there is a call button beside the contact number and an Open Maps button beside the address, the Day box became End Date, and duplicating a job brings the address along. **Two things I found while in there that had been wrong for a while:** nothing on the New Job form had ever actually been checked — the rules existed but the buttons walked past them, so an empty form could go straight onto the schedule; and every error message in the app had been showing in green instead of red since the August rebrand. **The refresh problem is solved**: after a deploy, a tab notices within about three minutes, or the instant someone comes back to it, and refreshes itself — unless they are mid-typing, in which case it waits and shows a bar. You tested all three cases live. **One last shout to the team:** the popup now asks everyone to log out and log in once, because today's copy of the app is too old to know how to check.)_

_Last updated: 2026-09-15 (feat-jobs — **a long one: nineteen changes live across two releases, and your driver containers are finally designed.** We started on your missing jobs. The answer took minutes: **4 of the 7 were in the database, the other 3 were never saved at all** — so not a display problem, and nothing was hiding. You then tried to make it happen again while I watched the database every 4 seconds, and **all 18 duplicates worked**. So I still don't know what caused it, and I'd rather say that than invent a reason. **What the watching did show was the real cost:** every duplicate was carrying the previous store's address forward, which is where your "remove location on duplicate" came from — now built. **Your two sketches turned into a full design** for the driver containers: Mixed Drivers on top, your three drivers across the middle (Rintu, Xiao Yi, CK — the only three ticked as Driver, checked against the real data), Unassigned at the bottom, and all five drag rules. **Your best call of the day was the 6pm summary** — a drag tells nobody, so arranging tomorrow doesn't buzz an installer ten times, except jobs happening today which still go out at once. **Live now:** the job card you sketched (including **the full address, which had been cut off at 150 pixels** — you'd been saving postcodes the card then hid), 1/2/3 job cards per row, attaching files while creating a job, sales ticking DO issued and Production ready on their own jobs, and your admin-only red "no Telegram" push. **Four things I found that had quietly never worked:** your admin menu never had Pending or Leave because the app was showing you the scheduler's menu; schedulers could save a draft with no Pending tab to find it in; schedulers and admins had **no Push to Schedule button on the job page at all**; and **deleting a job left its files in storage forever** — every job ever deleted, including the 46 from August. **One bug was mine and you found it:** attaching a file to a new job failed and said nothing. It now tells you. Two housekeeping items are below.)_

_Last updated: 2026-09-17 (feat-schedule — **your driver containers are live, and so are two new daily Telegram messages.** The board is on the schedule as a new **Drivers** view: three fixed rows — Mixed Drivers on top, your three drivers across the middle in their own colours, Unassigned at the bottom. Drag a job from one driver to another and it asks before anything is saved; cancel and nothing happened. **Your calls along the way changed it for the better three times:** external installers got their own containers, and a job shared with one now shows **twice** — once under your driver, once under the contractor, the same job either way; the support crew comes off whenever the driver does, because they are a different team; and dragging is desktop only. **Swipe-to-delete is gone** — sliding a card sideways used to open a delete box, which is too easy to do by accident for something that also takes the job's files with it. Delete from the job page instead. **The two messages: 4pm and 6pm.** At 4pm your schedulers get every job that still has nobody on it, grouped by whose job it is, repeating each day until someone is assigned. At 6pm each of your crew gets their own — what they are on tomorrow with the time, full address, who they are with and who to ring, plus anything that changed. **Three problems were found by testing against your real data rather than trusting the code:** a week of your jobs came to 6,374 characters when Telegram refuses anything over 4,096, so the message would have silently failed on your busiest days; **you were not on the list for your own summary**, because your account is sales; and four of the eight names on it had never entered a job in their lives. All three fixed. **What is left is people, not code:** twelve of your team still need to tap profile picture → **Connect Summary**, and four of them — Firoz, Aroze, Halim and **CK, one of your drivers** — need Connect Telegram first. Until they do, their message silently never arrives. **Next session: telling people when a job on the schedule changes**, your call.)_

_Last updated: 2026-09-18 (ux-schedule — **the schedule stays on the date you are working on. Live on production at 3:28pm.** Your report: "i press oct 2 to edit arnotts, then either i press back to schedule or greenqubes logo to go schedule page, it jumps to today. very repetitive any annoying." It does not any more — open a job from 2 October, come back by the back arrow or the logo, and you are still on 2 October. Same on the Drivers board and the Week and Month views, and on the Pending and Completed tabs, where each remembers its own date so browsing Pending cannot drag your schedule along with it. **Close the tab, or open the app tomorrow, and it is back on today** — your call, so nobody is ever left stranded on a date they set last week. The Today button is unchanged. No database change. **Also tidied: three boxes on your feedback list were still unticked** for work that shipped on the 15th and 17th — the driver containers, the two daily summaries and Duplicate dropping the address. Corrected, with what each one actually shipped as.)_

_Last updated: 2026-09-28 (feat-installer — **installers can now bin wrong photos, and anyone on Chinese or Bengali can translate a job description. Both live at 8:36pm.** Your screenshot was Xiao Yi's job from 25 Sept: he put site photos into Signed DO by mistake and pressed Completed half a minute later. There was no way out — **Signed DO had never had a delete button for anyone**, and the completion-photo bin locked the moment the job was completed. Now, on your rules: anyone on the job can remove any wrong photo in Completion Photos or Signed DO, **up to 24 hours after completion**; office staff get the same, plus Production Photos; and a finished job always keeps one completion photo. The **Translate** button sits beside Suggest and shows the description in the person's own language, just for them — the original is never changed. Four small things are in Pending below.)_

_Last updated: 2026-09-28 (feat-jobs — **Support crew has role buttons, and it's on the New Job form. Live at 9:01pm.** Under Support crew: All · Scheduler · Coordinator · Installer · Production, like your Admin → Users filter. Sales, HR / Finance, Admin and Designer are no longer in that list at all — except anyone already on a job's crew, who stays on that job so they can be taken off. On the New Job form, Support crew sits under Drivers; sales and coordinators suggest, schedulers and admins assign, the same as Drivers. **Earlier today: the 4pm "jobs still to arrange" message was checked and is working correctly.** Charles's Headboard job went on the schedule on Friday at 11:38am with no confirmed driver, sat on the 4pm list Friday to Monday, and CK was confirmed at 4:35pm Monday — 35 minutes after that day's message. Charles is sales, so he can only *suggest* crew; the scheduler has to confirm it before it counts. The system keeps no record of suggestions once they're confirmed, so that part is the likely explanation rather than proven. **Also seen: the 6pm message reached nobody on the 27th or 28th** — the Connect Summary item further down.)_

_Last updated: 2026-09-28 (feat-jobs — **deleted jobs now go to a Bin, and drafts are private. Both live at 9:23pm.** Your Aydan jobs for 2–3 Oct had been deleted, and nothing in the app recorded who or when — so you asked for a trash can. Now every delete goes to the Bin (profile picture → Bin), can be restored exactly as it was for 3 months (you can change that in Admin → Settings), and records who deleted it. **You spotted the bigger problem while we designed it:** every sales person, coordinator and scheduler could see everyone's drafts. Now a draft is seen only by the person who made it, its sales person-in-charge and its coordinators — admin sees all. That part went live the moment the database change was applied, on your go. You checked everything on the preview except two things that need real logins; they are at the top of Pending.)_

_Last updated: 2026-09-28 (chore-config — **your checklist is short again.** We went through it one item at a time and it came down from about 85 things to about 25, sorted into what's left to build, clean-ups for a quiet day, things only you can do, parked projects, and a short "someday" list. Nothing was thrown away — the old version is kept in a separate archive file. Also tidied: two old copies of the code removed from this PC and one stale branch deleted on GitHub. Nothing on the website changed. The one thing you said yes to that I held back — the 24-hour delete window for the Files-tab folders — is first under To build.)_

_Last updated: 2026-09-30 (infra-config — **a Supabase notice handled, and the Speed Insights button undone.** Supabase is changing how NEW database tables get opened up to the app from 30 October. Your existing tables are unaffected and nothing needed changing today; a rule is now in Claude's instructions so every future table gets the right access written in — signed-in users and our server only, never signed-out visitors unless you say so. The Speed Insights setup you pressed by accident had made two branches on GitHub; neither ever reached the app, and both are deleted. You downgraded Speed Insights Plus. Nothing on the website changed.)_

## Pending — Next Session

_Tidied with Nic 2026-09-28: ~85 items went through one by one and came down to about 25 plus a Someday list. Dropped items and the full reasoning behind every kept one are in [nic-checklist-archive-20260928.md](nic-checklist-archive-20260928.md)._

### Pending privacy + the Job Bin — ✅ LIVE on production 2026-09-28

_Checklist page (your ticks and notes are saved there): https://claude.ai/artifact/FV3Dt9w3v2vWZiJZeZ6m2z_

- [ ] **Two checks only a real login can do, now that it's live:** from your own sales login, Wei Qing's three drafts are gone from Pending and her draft link does not open; and a coordinator makes a test draft with you as PIC, you hand it to another sales person, and you're taken back to your list.
- [ ] **Tell the team, briefly:** deleted jobs are in profile picture → Bin for 3 months; and drafts are now private, so a sales person no longer sees a colleague's drafts. The "What's new" popup says both, but a word in the group chat avoids "where did my job go".
- [ ] **Glance at Admin → Health tomorrow** — the new "Bin cron" line shows its first 4am run. Until then it reads "no run recorded yet", which is expected.
- [ ] **Three small things the review left for later, none urgent:** a restore could wrongly leave someone off once you have over 1,000 staff or contractors; a chat message sent in the second a job is being deleted could be lost; and "Put it back in the bin" restarts that job's 3-month countdown.
- [ ] **Worth knowing:** the Aydan jobs from 2–3 Oct can still be recovered from the server PC's nightly backups (`E:Greenqubes-Archive`) until about mid-October, if you change your mind. After that the backups roll over.

### Housekeeping done 2026-09-28
- [x] **[Nic] Old `greenqubes-ops-voice-pa` folder deleted from this PC** — it matched GitHub exactly, nothing unsaved; the `feat-voice-pa` branch itself is still on GitHub. The `greenqubes-ops-workflow-v3` folder was already gone.
- [x] **[Nic] Old `greenqubes-ops-hr-leave` folder deleted from this PC** — nothing unsaved, and its code was already in `dev` and `main` (HR/leave live since 9 Sept).
- [x] **[Nic] Stale `feat-provision-organisation` branch deleted on GitHub** — checked first: everything on it was already in `main`.
- [x] **[Nic] Test external contacts — nothing left to delete.** Only two contacts remain, CK and Fu, both real contractors on real completed jobs (Fossil Westgate 4 Sept, Sunglass Hut Tangs 17 Sept).

### To build
- [ ] **Files-tab attachment folders get the same 24-hour delete window** as the photo sections — you said yes 2026-09-28; held because that day was housekeeping only. A one-line code change.
- [ ] **Tell the crew when a scheduled job changes** (a date move currently tells nobody)
  - Which changes are worth a message (date, time, address — not notes)?
  - Does the job form's "Save & notify" follow the same rule?
- [ ] **Time picker** — AM/PM clicker, and make it less ugly (scrolling through the day stays)
- [ ] **Tickable attachment buckets** — rename to Job Order, ticks lock the name, ticks show on the job card
  - Settle: for Permit-to-Work/BCA a tick means "to do", for Job Order it means "done"
- [ ] **External installer page** — job chat + read-only files
  - Settle: can a no-login page write into job chat? Which attachments can a contractor see?
- [ ] **External installers on the New Job form** (currently only on the edit form — Support crew went on it 2026-09-28, along with the Support crew role buttons)
- [ ] **Focus rings** — show the brand green instead of Chrome's blue

### Quiet-session cleanups
- [ ] Remove unused database columns: `job_external_contacts.status`, `users.years_experience`, `users.skills`
- [ ] Clean up files left in storage by old deleted jobs (dry run first)
- [ ] Security tidy-up — 3 small fixes (secret checks refuse by default, block fake notifications, escape text in Telegram messages)
- [ ] Telegram watchdog: alert when the backup or vault sync silently stops

### Only you
- [ ] Get the team to tap profile picture → **Connect Summary** (Firoz, Aroze, Halim and CK need Connect Telegram first); watch Vercel logs for `chat not found`
- [ ] Watch the Monday digest; tell Claude about any wrong pick
- [ ] Every January: HR adds that year's public holidays from the Leave page

### Parked
- [ ] **Voice PA** — needs your OK on adding a voice company before it can restart
- [ ] **Mobile app** — review the spec when you're ready (Apple/Expo/Play accounts come later)

### Someday ideas
- Assistant chat: accept Office files for filing, and later for reading
- Instant promotion of digest notes into the assistant's knowledge base
- Desktop apps (Windows / Mac)
- Test what happens when a service goes down
- Telegram notification tracker on the job form
- Sub-jobs under a main job
- FCFS extra views (Week / Month / By Project / By Installer)
- Schedule page visual overhaul

## Done This Session ✓ (2026-09-30, infra-config — Supabase Grants Rule + Speed Insights Cleanup)

- [x] **[Nic] Supabase's 30 October notice — checked, nothing to change today.** Existing tables keep their access. Only tables created after that date need access written in.
- [x] **[Nic] New rule added to Claude's instructions** — every new table gives access to signed-in users and our server only; signed-out visitors never, unless you approve it. Pushed to GitHub.
- [x] **[Nic] Both Speed Insights bot branches deleted on GitHub** — neither was ever part of the app.
- [x] **[Nic] Speed Insights Plus downgraded** in Vercel. Optional: press Disable in the Speed Insights tab if you want it fully off — it records nothing either way.

## Done This Session ✓ (2026-09-28, feat-jobs — Pending Privacy + Job Bin, LIVE)

- [x] **[Nic] Your missing Aydan jobs for 2–3 October — answered.** They were deleted, not hidden, and at the time nothing recorded who deleted a job. You chose to leave them (the nightly backups on the server PC could still bring them back, for about 30 days from 15 Sept).
- [x] **[Nic] Pending privacy — LIVE, database change applied on your "apply both".** A draft is now seen only by whoever created it, its sales person-in-charge and the coordinators on it — plus admin. Schedulers see only their own. You caught this one yourself: everyone could see everyone's drafts.
- [x] **[Nic] The Bin — LIVE on production 9:23pm, after you checked the preview.** Delete sends a job to the Bin; profile picture → Bin restores it exactly as it was, files and all. Every delete now records who and when. Admin → Settings sets how long it keeps them (3 months to start); a 4am job empties the rest.
- [x] **Checked against the real database, not just tests** — a throwaway job was deleted, restored and emptied for real (15 of 15 checks), then cleaned up. An independent review found three problems, all fixed before it went live: handing a draft to another sales person failed, a restore at the same moment as "Delete forever" could lose files, and the retention warning could miss a job by a day.
- [x] **[Nic] "What's new" updated** — two new heads-up lines on today's entry, time moved to 9:23pm.

## Done This Session ✓ (2026-09-28, feat-jobs — Support Crew Filter + New Job Support Crew, LIVE)

- [x] **[Nic] 4pm message checked against Charles's Headboard job — working correctly, nothing changed.** Listed Fri–Mon because no driver was confirmed until 4:35pm Monday.
- [x] **[Nic] Role buttons under Support crew — LIVE 9:01pm.** Sales, HR / Finance, Admin and Designer are out of the list.
- [x] **[Nic] Support crew on the New Job form — LIVE 9:01pm.** Tested by you on its own preview, then dev, then production.
- [x] **What's new entry** — added to today's entry, time moved to 9:01pm from the deployment's own clock.

## Done This Session ✓ (2026-09-28, feat-installer — Photo Deletes + Translate Button, LIVE)

- [x] **[Nic] Delete bins on Signed DO and Completion Photos — LIVE 8:36pm.** Anyone on the job can remove a wrong photo, whoever uploaded it, while the job is open and for **24 hours after it is completed**. Office staff get the same, plus Production Photos. A completed job always keeps at least one completion photo; Signed DO can go to zero. You tested it on the preview.
- [x] **[Nic] Translate button on Job Description — LIVE 8:36pm.** Beside ✦ Suggest, and on the installer's read-only box. Translates into the person's own profile language — Chinese or Bengali; English profiles have no button. Shown only to that person, never saved over the original. You tested it on the preview.
- [x] **Checked on a real job description, not made-up text** — names and shop names stayed in English in both languages.
- [x] **What's new entry written** for today, timed from the deployment's own clock.

## Done This Session ✓ (2026-09-18, ux-schedule — The Schedule Remembers Your Date, LIVE)

- [x] **[Nic] The schedule keeps the date you are working on — LIVE on production 3:28pm, 2026-09-18.** Your report, in your words: it jumped back to today every time you came back from a job. The cause was plain once found — leaving the page and returning builds it fresh, and the date was simply being set to today each time it was built.
- [x] **[Nic] You chose when it should forget — 2026-09-18.** When the tab or the app is closed. It holds the date through everything you do inside the app, and tomorrow morning opens on today. The alternative — remembering forever — risked opening on Monday and quietly showing you last week.
- [x] **[Nic] Tested by you on the dev preview before it went to production, 2026-09-18.**
- [x] **Works everywhere the date appears** — the list, the Drivers board, Week and Month. Pending and Completed each remember their own date, so moving around in Pending cannot shift your schedule underneath you.
- [x] **Nothing in the database changed**, and nothing on the server. Three files.
- [x] **Checked before it shipped** — all 35 automated checks green, and the new one was deliberately run against wrong code first to prove it would actually catch the problem. A check written afterwards only ever agrees with whatever the code already does.
- [x] **Three stale boxes on your feedback list corrected** — driver containers, the two daily summaries and Duplicate dropping the address all shipped on the 15th and 17th but were left unticked at those sessions' close.
- [x] **[Nic] Changelog entry written and live** — two lines under Improved, your call to include the second one so nobody reports the reset-to-today as a fault. The team sees the What's new popup on their next load.

## Done This Session ✓ (2026-09-17, feat-schedule — Driver Board + Two Daily Summaries LIVE)

- [x] **The driver board is live** — three fixed rows on a new **Drivers** view, your three drivers in their own colours side by side, drag to move a job, a prompt every time, nothing saved until you confirm.
- [x] **[Nic] Your calls during the build**, each of which changed the design: external installers get their own containers and a shared job shows twice (same job, two cards); the support crew comes off whenever the driver does; Mixed Drivers stays; dragging is desktop only; the counts got bigger then smaller.
- [x] **Swipe-to-delete removed.** Too easy to trigger by accident for something that permanently takes the job's files with it. The job page's Delete button covers every device.
- [x] **4pm message: every job still without a driver**, grouped by whose job it is, no cut-off date, repeating daily until someone is assigned — your scheduler's own description of how he works.
- [x] **6pm message: each person's own jobs tomorrow** — time, full address, who they are with or following, and who to ring — plus anything that changed for them today.
- [x] **Three problems caught by testing against your real data**: the message was 6,374 characters against Telegram's 4,096 limit and would have failed silently on busy days; you were not a recipient of your own summary; four of eight names on it had never entered a job.
- [x] **[Nic] Summary bot created, secret set, webhook registered** — all verified live, including confirming the webhook actually refused unsigned callers before it was switched on.
- [x] **Outside contractors no longer accept or decline a job.** The trap underneath: "Accepted" was not a button, it was the lock on their job page — removing the buttons alone would have shut every contractor out of every job.
- [x] **Job cards finally show outside contractors.** A job crewed only by a contractor used to read "Driver: nobody yet" and look unstaffed.

## Done This Session ✓ (2026-09-15, feat-jobs — 19 Changes Live, Driver Containers Designed)

- [x] **[Nic] Your missing jobs — answered, and it was not a display problem.** 4 of the 7 were in the database; the other 3 were never saved. Searched every way there is — by title, client, date, and everything created that day — with the permission rules bypassed so nothing could hide.
- [x] **[Nic] You tried to reproduce it live while I watched the database.** 18 duplicates in a row, all of them fine. **So the cause is still unknown**, and I would rather leave it open than invent one. Nothing was lost either way.
- [x] **[Nic] Duplicate no longer carries the address over** — your call, from watching that bulk order. It offers the old address as a one-tap fill instead, so the same-site case still costs no typing. **This reverses your own decision of 10 Sept**, and the reasoning from then is recorded beside it so nobody quietly flips it back.
- [x] **[Nic] The job card rebuilt to your sketch** — bigger title, description over two lines, support crew and driver as name pills, time and people in their own column. **The full address shows at last**: it had been cut off at 150 pixels, so since address lookup went in you had been saving unit numbers and postcodes the card then hid.
- [x] **[Nic] 1, 2 or 3 job cards per row** on a wide screen, your choice, remembered per device. Phones and laptops are untouched.
- [x] **[Nic] Attach files while creating a job** — no more saving first and reopening. Files wait in a holding area and move onto the job when you save; Cancel throws them away immediately, and anything abandoned is swept after 7 days. They go into the **same four buckets** as the job form, so nothing appears to move on its own.
- [x] **[Nic] Sales can tick DO issued and Production ready on their own jobs** — your call: own jobs, not everyone's.
- [x] **[Nic] Your admin-only red "Push — no Telegram" button**, on both the new job form and the job page. The server decides whether to honour it, so nobody else can silence the schedulers by pretending.
- [x] **[Nic] Design brief locked until a job is on the schedule**, and moved to the Team tab on phones. It follows from designers no longer seeing draft jobs — a brief written on one would be invisible to the person it is for.
- [x] **[Nic] Database change applied (0060) on your go** — designers and production can no longer read draft jobs. They never had a Pending tab but could reach every draft by typing the address; the database now agrees with the screen.
- [x] **[Nic] Four things that had quietly never worked**, all found while doing the above: your admin menu was showing you the scheduler's menu (no Pending, no Leave); schedulers could save a draft with nowhere to find it; schedulers and admins had **no Push to Schedule button on the job page at all**; and **deleting a job left its files in storage forever**. All fixed, and three dead files deleted.
- [x] **[Nic] One bug was mine, and your testing found it** — attaching a file to a new job failed and said nothing at all. It now reports the real reason. The likely cause was a stale browser tab, which I have written down as likely rather than proven.
- [x] **[Nic] Your driver containers are designed** — three fixed bands, your three real drivers, all five drag rules, and the 6pm summary. Nothing built yet; it is the next big piece and wants its own session.

## Done This Session ✓ (2026-09-14, fix-jobs — Your Feedback Pass: 6 Fixed and LIVE)

- [x] **[Nic] You went through 13 things one at a time and I wrote every one down** — in your words, with screenshots and your two sketches. Six are live on production tonight; the other nine are at the top of Pending, each with the question it still needs from you. Nothing is relying on memory.
- [x] **[Nic] Time picker fixed, then fixed again after you caught it.** It was being cut off because every card on the job form is set to keep its contents inside its rounded corners — which also chops anything that pops open. It now draws on top of the page. **Your "why is it getting locked?" was a fault I'd introduced with that fix** — it was re-checking its position every time you scrolled and snapping you back. Both fixed; the full list of times still scrolls end to end.
- [x] **[Nic] Address suggestions no longer pop up when you open a job.** This one had been happening since the feature shipped last session — you simply couldn't see it, because the list was hidden inside the card. It was also spending a Google lookup **every time anyone opened a job with an address**, for nothing. Now suggestions only appear when someone actually types.
- [x] **[Nic] Videos upload to completion photos, up to 100MB** (your call). The app was already built for video — the file picker offered it and the list had a video icon ready — but the server was quietly refusing it. Oversized videos are now refused **straight away** rather than after a long upload on site, and failed uploads say what went wrong instead of "Save failed — try again". Also fixed underneath: a failed upload used to be recorded as a success, leaving a file that opened to nothing.
- [x] **[Nic] Production and installers can delete wrongly attached photos/videos.** Production could already do it — the button was simply missing. Installers are a deliberate exception to the rule written on 19 Aug ("installers never"), flagged to you before building: **their own uploads only, and not once the job is completed**, both your calls.
- [x] **[Nic] Error messages are red again, everywhere.** The fix on 11 Sept only covered the job form. Five more places were still green — including **every error message in the app**, and Admin → Health, where a **broken cron was showing green**. Red brightened at your request, but kept separate from the strict-on-time red so the FCFS legend still reads.
- [x] **[Nic] FCFS "extending out of bound" — checked, and it is not a bug.** You confirmed the header stays put while only the board slides, which is it working as designed. The real problem is that the board is about 2,282px wide at the AM/PM zoom, so a phone shows roughly two hours. Moved to the design session with the driver containers.
- [x] **Live on production 19:11 SGT**, `dev` → `main`, probes green. Changelog written and dated today. **Your auto-refresh did its first real job** — anyone with a tab open got this without being told.

## Done This Session ✓ (2026-09-10, fix-assistant — AI Importance Scoring Fixed + LIVE)

- [x] **[Nic] You asked for a recommendation instead of a checklist question** — so the answer came from your live data, not from opinion: all 14 saved conversations pulled and read. **Every conversation the AI rated highly was about supplier prices**, because "supplier prices" was the only example it had ever been given. Two of those three were people ASKING a price the vault already held — so the Monday digest was offering to write notes that duplicated notes you already had.
- [x] **[Nic] Scoring rewritten and approved by you** — it now asks whether something NEW arrived that nobody had written down, with a firm rule that anything the AI answered from the knowledge base or from job data can't rate above a 2.
- [x] **[Nic] Your 14 conversations re-scored — DONE 2026-09-10 (your instruction).** The Monday digest now offers **1 conversation instead of 3**, and it's the lightbox pricing you explicitly told the assistant to capture. Checked straight from the live database afterwards, not taken on trust. Each person's private memory was deliberately left alone — that's a separate question from what the whole company should see.
- [x] **[Nic] Merged to production without a preview — your call, and correct.** There is no screen to look at, and preview and production share the same database, so a preview would have been the same code on the same data. It was instead run against your real conversations four times.
- [x] **[Nic] Both test notes deleted from the vault — DONE 2026-09-10 (your call).** Digest folder now empty.
- [x] **[Nic] "What's new" popup pulled — DONE 2026-09-10 (your call).** The entry was written because the rule says anything reaching production gets one, then removed because you judged it too small to interrupt the team with. Nobody gets a popup.
- [x] **[Nic] Clock problem found and fixed in the instructions.** This PC's clock reports the wrong timezone, so release times in the changelog could have been stamped hours out — the same mistake that once put 07:33 on a release that went live at 15:24. Future sessions now read the time from the deployment itself.
- [x] **Correction logged:** Claude wrongly told you the vault sync had been broken since August. It hasn't — it runs nightly without fail. The note that looked missing had been deleted by you on 18 August.

## Done This Session ✓ (2026-09-07, fix-jobs — Live-Issue Day: 7 Fixes on Production)

- [x] **[Nic] Sales can add and remove coordinators again** — it had been failing with "Save failed" for every sales person on every job. A permissions rule from June had quietly dropped sales from the coordinator list while still letting them see it. You tested and confirmed.
- [x] **[Nic] Your director's "it says saved but nothing saves"** — found and fixed. It was never about the date: **every field** a sales person edited on an already-scheduled job was being thrown away while the screen said "Saved successfully". Sales can now edit their own scheduled jobs, and get a clash warning if they move a date onto a booked crew.
- [x] **[Nic] Sales can close off their own jobs**, and assigned coordinators can close theirs — the overdue reminders go to the sales person, so they were being nagged about jobs only the scheduler could finish.
- [x] **[Nic] Drivers bucket** — the job form's Installers list now shows only people ticked as Driver; your other 4 installers moved to Support crew. Nobody lost a job: 17 existing assignments across 5 upcoming jobs were moved across with a dry run first, checked before and after.
- [x] **[Nic] Filter people by role** when picking Person-in-Charge or Sub POC / Coordinators. You approved the mockup before it was built.
- [x] **[Nic] A closed job no longer offers "Push to Schedule"** — you found this one. Pressing it had reported success, changed nothing, **and told your schedulers the job had been pushed**. It now shows "Reopen job" instead. Worth a glance at your scheduler chat for a stray notification from today.
- [x] **[Nic] The buttons at the bottom of a job no longer run off the edge on a phone** — Cancel is reachable again, and Mark job complete moved next to Save.
- [x] **Saves that get refused now say so** — this is the quiet one that matters most. Three separate bugs today were the same underlying trap, where the system reported success over a write that never happened. It is now guarded in all three places, which protects every screen going forward.
- [x] **[Nic] Migration numbering rule** — Claude must now claim a number before writing a migration, and check every branch. Six consecutive numbers had collided. The HR/leave plan no longer reserves numbers at all.

**Built but NOT live — waiting on your preview check:**

- [ ] **The "What's new" changelog popup** — your director's request. Opens by itself once per person when there is something new, reopens any time from your profile picture → What's new, scrolls inside itself. Today's entry is already written. **Please read the wording** — it is what your whole team sees, and you know how they talk better than Claude does. Say the word and it goes live.
## Done This Session ✓ (2026-09-07, chore-config — Workflow V3 Branch Killed + Session Close)

- [x] **[Nic] "Kill this v3 branch" — DONE.** `feat-workflow-v3` is deleted from this PC and from GitHub. This reverses the 4 Sept decision to keep it forever as a record (like Workflow V2), so **round 1's work is not retained** — roughly 3,700 lines across 39 files. It could only be recovered from GitHub's short grace period for deleted branches, and only if done soon.
- [x] **[Nic] Nothing live was affected** — V3 code never reached the website or your team. The database is untouched by the deletion; the two leftover test projects were already cleared on 4 Sept.
- [x] **What was deliberately kept** — on the main line of work: the design document, both build plans and the feedback log (each stamped "cancelled — do not build from this"), the approved mockup, and the database migration file. The migration must never be renumbered or dropped: it is already applied, and the two migrations after it are numbered on top of it. Nothing in the app reads it any more.
- [x] **[Nic] Health tab — no action needed after all.** Yesterday's fix (the new Design cron row, and stopping the false amber warning on the overdue cron) turned out to be **already live on production** — it rode along in the go-live merge. Checked directly rather than assumed. Admin → Health should show "Overdue cron — ok" and a "Design cron" row.
- [x] **Docs squared away** — the branch rules, build plan, context file and this checklist all now say deleted rather than archived, so no future session goes looking for a branch that is gone.
- [ ] **Last leftover:** the V3 folder on this PC (see the Workflow V3 section above) — safe to delete, just not from inside a running session.

---

## Done This Session ✓ (2026-09-07, chore-admin — HR / Finance Role + Leave: Designed and Planned, Nothing Built)

- [x] **[Nic] Your eighth role is designed end to end.** You asked for HR, and because she also handles finance the role sees **all prices** — view only, sales keeps entering them. Beyond that she gets the schedule (look, don't touch), any job page read-only, her own Leave page, and the assistant. She can't edit jobs, join job chats, see the planning board, reach Admin, or see jobs that haven't been scheduled yet.
- [x] **[Nic] Your decisions, recorded** — leave is a **hard red clash**, not a gentle warning (same weight as double-booking someone); it covers the **whole team**, not just installers; **half days** (morning or afternoon) are supported at either end of a date range; the **reason** for leave is locked to HR and admin at the database level, so it can't leak through any screen; leave shows up **on the schedule now** rather than waiting for the V3 rebuild (a decision that turned out well — V3 was cancelled days later); **Singapore public holidays are included**, shown by name but with no warning attached, since your team does work on holidays.
- [x] **[Nic] Also agreed: no outside service for the holiday list.** Claude pre-fills the 11 gazetted 2026 dates and HR adds each new year herself — about 11 entries once a year. Nothing new joins the locked stack.
- [x] **[Nic] Held back on purpose, for a future session** — leave balances, automatic entitlement counting, and staff requesting leave themselves for HR to approve. Today HR just records what's already been agreed. All three are ledgered under Pending.
- [x] **[Nic] Before writing the build plan, Claude mapped the existing code properly** — four searches running at once, covering how roles are wired, how double-booking warnings work, how the schedule pages are built, and how notifications are sent. That check **corrected the design twice**: the "one clash system" the design assumed doesn't exist (there are four near-copies of the same logic), and the new role needs its database change split in two for a Postgres reason. Both are handled in the plan. It also caught two things that would have looked like bugs later — HR would have shown up in the "person in charge" picker, and one permission check would have quietly failed for admins.
- [x] **[Nic] V3 folder checked and cleared for deletion (you asked mid-session whether an agent was inside it — it was this one).** Claude verified it holds no unsaved work: nothing uncommitted, every commit already on GitHub, and the three saved stashes belong to the main folder rather than this one. The folder was **still present at session end**, so the decision stays open in the Workflow V3 section above — with the safe way to do it written down.
- [x] **[Nic] Migration numbering slipped again — third time.** The leave tables were pencilled in as 0053, but the installer completion flow took that number days earlier, so they're now **0054 + 0055**, and the plan tells the next session to re-check the live database before writing them. This keeps happening because branches that haven't merged can still have claimed a number.
- [x] **[Nic] The HR branch was brought up to date with everything live** (installer completion flow, mobile fixes, the Singapore server region, V3's cancellation), so the build plan's references all point at current code rather than last week's.
- [x] **[Nic] AI importance tagger — skipped; Bryan branch check — skipped (your calls at session start).**
- **Nothing was built, applied or deployed this session.** No database change, no code, no deployment. The next session starts at step 1 of the plan.

---

## Done This Session ✓ (2026-09-04 → 07, fix-schedule — Mobile Viewport Fixed + LIVE on Production)

- [x] **[Nic] Your three phone complaints were two bugs.** (1) The schedule sliding sideways: a long job title (like "Installation Fossil Westgate showcase counter cladding") was stretching its card wider than the phone screen, because nothing told the card it must never outgrow the row. Measured it precisely — the page came out 510 pixels wide inside a 500-pixel screen, with the long-title card at 494 against a correct 468 for the short one. Now every card stays exactly screen-width and long titles trim with "…" as intended. (2) The side menu needing a scroll to reach **Account** (and the same at the bottom of the notification panel): both panels were set to "full height of the screen", but on Android that phrase means *the height with the address bar hidden* — so the bottom slipped just out of sight until scrolling hid the bar. Both now measure against what's actually on screen.
- [x] **[Nic] Being able to zoom out was a symptom, not a setting — and it was left switched on deliberately.** The app has never blocked pinch-zoom (checked against the live site). Your phone only lets you pinch out past "fits the screen" when something is genuinely hanging off the edge, so now that nothing does, zooming out snaps back on its own. Locking zoom would have hidden this whole class of bug from you in future, and it makes the app harder for anyone who needs to magnify text — say the word if you ever want it locked anyway.
- [x] **[Nic] Checked on your dev preview, then merged to production on your go-ahead** — dev → main `5f64bc9`. Production probes green (login loads, signed-out visitors bounce to login, still served from Singapore), and the live stylesheet is byte-for-byte the same build you tested, so what you approved is exactly what went out. Three files changed, no database work, nothing that needs undoing.
- [x] **[Nic] Housekeeping caught along the way** — Claude's memory index had quietly lost 6 of its 9 entries (two parallel sessions saving over each other); rebuilt so none of that knowledge goes missing at the next session start.
- Reminder: anyone with the app already open should **refresh their tab** — old tabs keep serving the previous version. This has now caught you out three times.

---

## Done This Session ✓ (2026-09-04, feat-voice-pa — Voice PA Built, Tested, PARKED — nothing live)

- [x] **[Nic] Idea → design → built in one session** — your brief: salespeople resist the job form ("too many insert steps"), so give them a personal PA they just talk to, on a big shiny button everywhere. Your four design calls: **talk → the PA creates the job** (never the form), **hands-free** conversation, **English + Mandarin**, and **full PA scope** for every role (asking questions as well as creating jobs, with job creation still blocked for installers/designers/production exactly as before).
- [x] **[Nic] Answered your architecture question honestly** — what was built is a **"sandwich"**: your phone turns speech into text, the existing assistant thinks in text, your phone reads the answer aloud. It is **not** a realtime AI voice session (no interrupting, a pause before it replies, robotic voice). That answer led to your decision below.
- [x] **[Nic] Your testing caught three real bugs, all fixed the same day** — (1) the voice screen was **see-through** (a colour trick this app's palette silently ignores — the same class of bug your "invisible button in daylight" catch uncovered in the other session); (2) Android **repeated your words** ("arrange arrange a job"), which was also why it misunderstood you — the code was re-adding earlier fragments; (3) it **suddenly replied in Chinese** to garbled English.
- [x] **[Nic] Your verdict: park the sandwich, design the real thing next session.** Recorded, with the vendor research done and costed (see the new Voice PA section under Pending). Nothing was merged — production and dev are untouched by any of this.
- [x] **Final polish pass done before parking** — an automatic code review (which ran out of AI usage partway, so it only half-finished — noted honestly) found and Claude fixed: a duplicate database lookup the voice button added to **every page load in the whole app**, Bengali users being forced into English replies, a voice instruction that contradicted your English-dates rule, and typing being blocked while muted. Ten tidiness items were deliberately left alone and written into the design doc, since that code gets replaced anyway.
- Note: the browser version stays on its branch as a working stepping stone — the button, the voice screen and the whole brain survive into the realtime rebuild; only the listening and speaking parts get swapped.

---

## Done This Session ✓ (2026-09-04, feat-installer — Installer Completion Flow LIVE on Production)

- [x] **[Nic] Three asks built and shipped same day** — (1) the **Completed button** for installers: grey until a completion photo is uploaded, green after, confirm popup, and the sales person-in-charge gets a Telegram when it's pressed (the server re-checks everything — only a formally assigned installer on a scheduled job with a photo can complete, no matter how the app is accessed); (2) **"Signed DO (Optional)" hides** until production ticks "DO issued" — an already-uploaded file never disappears; (3) **every installer can open the Completed tab and see ALL past jobs** — details, photos, files, chat (your call), task list and who worked them — because real installers refer backwards. Pending and scheduled jobs stay as private as before; money figures stay invisible to installers; old jobs open read-only.
- [x] **[Nic] Migration 0053 pushed by Claude at your request** — dry-run first (only 0053 pending), applied clean. The completed-jobs visibility lives at the database layer.
- [x] **[Nic] Your "button not visible in daylight" catch → a real app-wide bug** — the button used a colour class that doesn't exist (`bg-green`; the app's token is `brand-green`), so it rendered white-on-white in light mode. Sweeping for the same typo found **30 spots in 9 files** that had NEVER shown their intended colours: the clash popup's green/amber badges, the workload popup's blue day circle (its number was invisible!), bug-report severity colours, the assistant's pinned-chat amber, your preview-as amber ring, and more — all fixed and verified against the compiled stylesheet.
- [x] **[Nic] Tested as a real installer on the dev preview → your merge call** — dev → main (`edeaf62`), production probed green (new route guards itself 401, login 200, schedule bounces signed-out visitors 307).
- [x] **[Nic] AI importance tagger — skipped; Bryan branch check — skipped (on leave); V3 worktree untouched (your calls at session start).**
- Reminder: anyone with the app already open should refresh the tab before using it — old tabs keep the previous build.

---

## Done This Session ✓ (2026-09-04, feat-provision — Provisioning Overhaul LIVE for Launch Day)

- [x] **[Nic] Design approved through three feedback rounds** — mockup page + your 10 artifact comments (dots not tags, Driver beside the name, chips, Insert buttons) + the merged-bucket call all folded in before code.
- [x] **[Nic] Card-only provisioning live** — add a person with just name + role; their card appears everywhere for assigning; attach their Google email later in Edit (no more delete-and-re-add). Red dot = no email, amber = waiting for first sign-in, green = linked.
- [x] **[Nic] Subroles, Driver, qualifications live** — labels on every name card (admin, installer grid, designer grid; FCFS + clash rows get a text line; dropdown pickers untouched). Only admins can set them — self-editing is blocked at the database layer, same guard as the August security fix.
- [x] **[Nic] Admin Users page: filter bar (role + subrole + "No subrole"), rename, email editing** — years of experience + skills removed from every screen (data kept; deletion reminder above).
- [x] **[Nic] Support crew bucket live** — the "+ Sub-installer" button is now "+ Support crew" and offers every role, for night jobs / manpower shortage. Same rules and Telegram as sub-installers; never triggers double-booking warnings; zero new database structure.
- [x] **[Nic] Migration 0052 applied by Claude at your request (you were remote)** — dry-run first, verified applied. Renumbered from 0051 after Claude caught that V3's unmerged branch had already used 0051 on the shared database (a same-number push would have been silently skipped).
- [x] **[Nic] Preview checked by you on your phone → merged** — your provisioning work merged cleanly with the tour agent's dev work; you confirmed the tour was already tested; one dev → main merge; production probes green (login 200, pages bounce to login, admin API refuses strangers, Singapore region).
- [x] Vercel lesson recorded: a branch name over 63 characters makes its preview web address impossible — branch renamed to `feat-provision`.

---

## Done This Session ✓ (2026-09-03 → 04, feat-tour — Guided App Tour LIVE + Go-Live Merge)

- [x] **[Nic] Guided tour designed, previewed and approved** — an in-app spotlight walkthrough for all 6 roles: show-and-explain only (nothing underneath is tappable), auto-offer at first sign-in, finishing on Connect Telegram. Your calls along the way: reworded job-form copy (never say fields are optional), and the **language chooser after "Start tour"** — picking English / 中文 / বাংলা sets the person's whole app language, doubling as day-one language setup.
- [x] **[Nic] Bengali added — your scoped exception to the August bn freeze** — tour text only (~84 strings); the freeze stays for everything else. Both 中文 and বাংলা are unvetted; the demo collects corrections.
- [x] **[Nic] Interactive mockup approved before any code** — a phone-frame simulation of the sales tour with an EN/中文/বাংলা toggle; building it caught a real plan bug (the phone menu drawer had to open for the nav steps). Mockup: https://claude.ai/code/artifact/bed4ed5f-fb03-4f0c-a3c2-72e571a2fe08
- [x] **[Nic] Subagent build authorised — then your new standing rule: "do it inline yourself from now"** — 12 tasks with a fresh worker + reviewer each; the final whole-branch review caught 1 critical and 4 important issues before you ever tested (headline: a stale tour state could trap the browser in an endless page bounce). All fixed and re-verified.
- [x] **[Nic] Preview pass → merged to main (your call to skip the full checklist tick-through)** — before merging, Claude spotted your provisioning agent's work riding on dev with its migration-0052 gate still unticked, probed the live database, confirmed the columns were already applied, and only then merged. Production probes green after the deploy.
- [x] **[Nic] Tickable checklist page published** — per role × phone/PC, ticks remembered on the device, "Notes for Claude" box for demo feedback: https://claude.ai/code/artifact/8a1134df-9e73-4fec-b695-96894df61659
- [x] **[Nic] AI importance tagger — skipped, no changes (your call at session start).**
- Note: the session opened with the small dev → main merge you asked for (the Admin → Health cron-warning fix).

---

## Done This Session ✓ (2026-09-03, infra-perf — Page Navigation Speed Fixed + LIVE on Production)

- [x] **[Nic] "Few seconds between pages" root-caused — the server was in the USA.** Every click was answered from Vercel's default US East region while the database and the whole team are in Singapore, so each page paid 5–6 slow round trips across the Pacific before it could show anything. One line in `vercel.json` now pins the server to Singapore. Confirmed NOT the old hydration issue (that stays untouched, per the standing rule).
- [x] **[Nic] Instant loading skeletons added** — the 10 main pages (Schedule, Pending, Completed, FCFS, Design Load, Installer, Assistant, Admin, both job forms) show a grey placeholder frame the moment you tap, instead of freezing on the old page until the new one is ready.
- [x] **[Nic] Verified at every step** — branch preview, then dev preview, then production all confirmed serving from Singapore (`sin1::sin1` in the response headers); login page ~0.1s warm vs ~0.31–0.40s before. Your verdict: "its very fast now."
- [x] **[Nic] Decision — temporary branch deleted after merge** — `perf-page-speed` and its worktree folder removed once live on `main`; not kept for archive (your call, unlike the V2/V3 branches).
- [x] **[Nic] AI importance tagger — skipped, no changes; Workflow V3 context also skipped (your calls at session start).**
- Note: the **first** click after the app sits idle can still take an extra moment — that's the free-plan server waking from sleep, unrelated to this fix. Every click after is fast. A paid Vercel plan would remove it if it ever bothers the team.
- Note: the guided-tour agent's `dev` folder was never touched; its two docs commits rode into `main` with this merge.

---

## Done This Session ✓ (2026-09-02, feat-workflow-v3 — Workflow V3 Round 1: Project Containers Built + Smoke Cleared)

- [x] **[Nic] Design settled through 5 mockup rounds + your 8 page comments** — projects are containers with labels, nothing copied: nest existing jobs or create inside; timing follows the project until a job sets its own; completed jobs stay in their day under a veil; one Schedule page with filter chips (pending stays personal — your hard rule); admin keeps full access; the AI chat folders renamed **Workspaces** so the word Project belongs to jobs.
- [x] **[Nic] Spec + 14-task plan approved; build ran subagent-driven** — every task built by a fresh worker behind a reviewer gate, then a whole-branch final review; ~12 real bugs were caught and fixed before you ever tested (headline: project files that uploaded but could never be opened, and ordinary saves silently detaching a job from project timing).
- [x] **[Nic] Ran `npx supabase db push` for migration 0051** — from the worktree folder (your main folder's dev branch doesn't carry the file until the merge — that's expected).
- [x] **[Nic] Smoke round CLEARED** — with 5 feedback fixes built and re-tested the same day: the project autosaves before "New job in this project"; an amber notice explains where such a job lands; the project push now opens the SAME clash resolution as the job form (your call — no more soft-lock) while still sending ONE scheduler Telegram; empty titles become "(Untitled X)"; and your coordinator rule — a pending job is shared between its sales person and the coordinators assigned on it, nobody else sees or pushes it.
- [x] **[Nic] Decision — merge only when V3 is fully built** — rounds 2 and 3 first, then one clean cut to dev, your dev-preview check, then main.
- Note: the collapsible folder NOT appearing on the schedule is round 2's headline, not a round-1 bug.

---

## Done This Session ✓ (2026-09-01, feat-design — Design Load Fix Round 3 + LIVE on Production)

- [x] **[Nic] B3 solved — the due-date Telegram was never broken.** The database timeline of your test showed the earlier move only had *Wan Jun* as designer, and that test account has no Telegram link, so there was nobody to message; the later move was blocked by the old "earlier moves only" rule. Rule changed: Telegram fires on **every** shift. Any future miss writes a `[jobs/patch] …` line to Vercel → Logs.
- [x] **[Nic] Edits 15 + 16** — floating buttons slide to the nearer screen edge when released (and stay on their side when the window resizes); the Design-completed confirm reads "This marks the design work as done — no design rating is recorded."
- [x] **[Nic] Edits 17–19 from your re-test** — designers now get a bell card + Telegram for **every** due-date event: install date moved but due date kept ("Install Date Moved … (unchanged)"), due date **removed** ("removed (was X)"), due date **set** or **changed** by hand. The "cleared due date comes back" bug is fixed — the save was echoing the old date back into the form, which wrote it back on the next save.
- [x] **[Nic] Re-test passed on the branch preview** — all Telegrams arrived.
- [x] **[Nic] Merge decision: Design Load → `dev` → `main`, LIVE on production.** Production checked: new pages bounce signed-out visitors to login, the new API route guards itself, crons and external installer links untouched.
- [x] **[Nic] Test-data cleanup** — 9 test jobs (incl. Test DL B1 and "test design completed…", confirmed as tests despite real client names) with every attached row and all 10 R2 files deleted; the 8 real client jobs untouched. Dry run first, script deleted after.
- [x] **[Nic] AI importance tagger** — skipped, no changes (your call at session start).
- Note: the test designer accounts **Wan Jun / Yu Fei have no Telegram link** — a future Telegram test needs your own account as an assigned designer, or link theirs via Connect Telegram first.

---

## Done This Session ✓ (2026-08-31, fix-auth — Google First-Login Bounce Fixed + Gatekeeper Switched On)

- [x] **[Nic] First Google login no longer bounces** — your report (first sign-in → `/login?error=auth`, second works) was traced to a leftover "stale" login cookie: while the sign-in was being completed, the app tried to refresh that dead cookie in the background, and the clean-up from that failure threw away the one-time login code. Live on production (dev → preview → main same day).
- [x] **[Nic] Found underneath: the app's gatekeeper had never run** — the file sat in the wrong folder, so Next.js ignored it on every deployment since day one. Pages checked the login themselves, so nobody noticed — but it's the only place a refreshed session can be saved, which is how cookies went stale in the first place. It now runs (unknown pages bounce to login, stale cookies are cleared on the first redirect); crons, Telegram webhooks, external installer links and the mockups were verified untouched on production.
- [x] **[Nic] Login page finally shows the error message** — "Something went wrong…" / "This account has been removed…" instead of a silent bounce.
- [x] **[Nic] Preview checklist passed on the dev preview → merged to main** — all five points checked by you; production probed afterwards.
- [x] **[Nic] Vercel Protection Bypass for Automation set up (your pick: dashboard only, no app button)** — secret generated in Vercel → Settings → Deployment Protection and stored in `.env.local` on this PC (git-ignored). Claude can now probe previews directly instead of handing you a checklist. Revoke it from the same screen if it ever leaks.
- [x] **[Nic] AI importance tagger** — skipped, no changes (your call at session start).
- Note: the Design Load branch inherits today's fix automatically when it lands on `dev` (one shared file, `en.ts`, may need a one-line merge nudge). Its own preview keeps the old login bounce until then.

---

## Done This Session ✓ (2026-08-18 → 2026-08-28, feat-design — Design Load built + two feedback rounds)

- [x] **[Nic] Design brainstormed from your V2.5 diagram and spec approved (2026-08-18)** — designers assigned per job, Design brief card (text + attachments, required after pre-booking), AI complexity scoring learning from real jobs (no survey — your team's ratings at completion replace it), Design Load board, Board | My Jobs for designers, 3-day Yes/No reminders, admin AI Scores tab. Whiteboard parked for its own session.
- [x] **[Nic] Build authorised subagent-driven (2026-08-26)** — 16 tasks, every one implemented by a fresh worker and gated by a reviewer, plus two whole-branch reviews; the reviews caught ~15 real bugs before you ever saw the preview. Migrations 0048/0049/0050 were applied by Claude at your request (you were remote).
- [x] **[Nic] Smoke test round 1 cleared (2026-08-27)** — 11 edits logged from your feedback and built the same day; you re-tested incrementally as each group was pushed.
- [x] **[Nic] Round-2 re-test cleared 13 of 14 (2026-08-28)** — edits 12–16 added along the way (draggable buttons, sales/coordinator complete + reopen, designers grid into the brief card, edge-snap, modal copy); only B3 (Telegram on due-date shift) remains, queued for next session.
- [x] **[Nic] Decisions made** — coordinators suggest-only for installers everywhere (incl. FCFS) and sales-level on jobs incl. delete; designers can reopen; production reads files, buckets view-only; scheduler bypasses the brief rule; due dates follow install-date moves (keep-or-shift prompt when both change); no mid-flight score correction — designer completion ratings + trust check instead; Telegram fires on every due-date shift (pending fix); mobile nav becomes a hamburger drawer.

## Done This Session ✓ (2026-08-26, feat-assistant-4 — Assistant Upgrade Phase 4 SHIPPED, Upgrade COMPLETE)

- [x] **[Nic] Phase 4 live on production — the whole assistant upgrade is done** — the assistant now has Projects: folders that group your chats, each with its own instructions and reference files the assistant automatically knows in every chat inside it, and chats in the same project remember each other. Move any chat in or out from its ⋮ menu; deleting a project keeps its chats.
- [x] **[Nic] Decision — project file limits: 10 files / 20 MB per project** — you asked about 100 MB; not possible: the AI re-reads every project file on every message, and one request to the AI service is capped at 32 MB (plus page/reading limits). For big document libraries the knowledge base (vault) is the right home — the assistant searches it instead of re-reading it.
- [x] **[Nic] Migration 0047 applied by Claude at your request** — you were away from the PC; dry-run first, applied, verified up to date. Code pushed only after.
- [x] **[Nic] Health tab: API usage filter live** — 30 days / 7 days / Today buttons on the usage tracker (Today counts from midnight Singapore time).
- [x] **[Nic] Deferred security checks — all three passed on production** (see the ticked items at the top).
- [x] **[Nic] "False confession" fixed same day** — during the installer test the assistant apologised for supposedly not verifying an answer that was actually correct (it can't see its own past lookups in a continued chat, so it guessed). A standing-instruction line now tells it to simply re-check instead of speculating — your call: "false confession erodes trust". Live on production.
- [x] **[Nic] Preview smoke passed (phone) → merged dev → main twice** — Phase 4, then the confession guard.

---

## Done This Session ✓ (2026-08-25, feat-assistant-3 — Assistant Upgrade Phase 3 SHIPPED)

- [x] **[Nic] Phase 3 live on production** — the assistant now takes photo and PDF attachments in chat, reads them, and can turn them into a filled-out pending job: it shows you a summary, waits for your yes, creates the job with the files sorted into the right buckets, and drops a tappable chip that opens the job. Third phase merged to main in a single day.
- [x] **[Nic] Decision — 30-day scratch cleanup built now, not deferred** — old chat attachments are swept from Cloudflare automatically every night at 3 AM; the deferred checklist item is closed.
- [x] **[Nic] Move file between buckets live** — hover any file on the job form → folder icon → pick the destination bucket; works for URL links too. Wrong AI (or manual) filings need no re-upload.
- [x] **[Nic] Smoke test passed on the preview (phone)** — attach + ask, create-job confirm flow with correct buckets, move-to-bucket, and the regression pass all green. On Android the picker filters unsupported files out by itself; the reject-message check moved to a PC item (pending above).
- [x] **[Nic] Question answered — Word/Excel/PPTX in chat** — the AI service can only read images and PDFs, so the chat paperclip accepts only those (the job form itself accepts every file type, unchanged). Workaround: export as PDF. Two future items logged above: filing-only Office attachments (small) and Office-file reading (needs a new dependency — your OK required).
- [x] **[Nic] Decision — installer refusal test (smoke test 3) folded into the deferred production checks** — runs together with the real-installer-login and two-account tests after all phases ship.
- [x] **[Nic] Merged dev → main** — Phase 3 live on production same day.

---

## Done This Session ✓ (2026-08-25, feat-assistant-2 — Assistant Upgrade Phase 2 SHIPPED)

- [x] **[Nic] Phase 2 live on production** — the assistant now looks up the real schedule, jobs, team availability and clashes when you ask ("who's free Friday?"), searches the knowledge base itself (retrying with different wording), and remembers meaningful conversations properly. Merged to main the same day Phase 1 shipped.
- [x] **[Nic] Ran `npx supabase db push` for migration 0046** — the memory-summary column, applied BEFORE the code went out (no crash window — the feat-files lesson followed).
- [x] **[Nic] Privacy built in as designed** — every lookup runs under the asking person's own permissions (an installer's assistant cannot see jobs they aren't assigned to), money figures are never available to the assistant at all, and memories never cross accounts.
- [x] **[Nic] Memory view live** — the Memory button (sidebar and phone drawer) shows everything the assistant remembers about you; you can correct a memory or make it forget one. Throwaway chats ("hello") stay out of memory automatically.
- [x] **[Nic] Decision — two security checks deferred to production** — the real-installer-login test and the two-account isolation test will be run on production once ALL phases are complete (tracked as a pending item above).
- [x] **[Nic] Preview smoke test passed → merged dev → main** — schedule/workload/clash questions, job lookup, knowledge-base search, Memory view, and the Phase 1 regression pass all green.
- Note: this folder's installed packages were still on the old Anthropic SDK (the Phase 1 session ran in a parallel window; `npm install` had never run here) — fixed during the session, no code impact.

---

## Done This Session ✓ (2026-08-25, feat-assistant — Assistant Upgrade Phase 1 SHIPPED)

- [x] **[Nic] Phase 1 live on production** — the assistant now runs on Sonnet 5, thinks before answering, gives much longer answers, shows "Thinking…"/"Searching the web…" status lines, has a Stop button, and shows web source chips under answers. Repeat messages in a chat are cheaper thanks to prompt caching.
- [x] **[Nic] New look verified by you** — smoother streaming (no more choppy scroll-fighting), two-row composer with mic dictation (browser feature — appears in Chrome/Safari, quietly absent in Firefox), no model picker; desktop sidebar with New chat on top; phone gets the app-like chat screen with the slide-in drawer.
- [x] **[Nic] Your phone feedback folded in same day** — hamburger moved to the LEFT (matches the drawer side), assistant icon + title removed from the top bar, Home icon added on the right (goes to Schedule; installers to My Jobs). Bottom nav staying visible under the drawer accepted as-is (your call).
- [x] **[Nic] API usage question answered** — it lives at Admin → Health → "API Usage Tracker" (30-day totals per service, not per-message rows). The amber "cost estimate drift" warning you spotted was a stale sanity check that can't work now that costs mix models, cache discounts and search fees — removed for the Anthropic card only; the real check (comparing against the Anthropic billing dashboard) stays.
- [x] **[Nic] Phase 3 scratch-file question answered** — chat attachments will live in a per-person scratch area in Cloudflare (`asst-chat/…`), never in job files, whether or not a job gets created; the deferred scratch-cleanup checklist item covers the leftover files. Offer on the table: build a simple 30-day auto-cleanup during the Phase 3 session instead of deferring.
- [x] **[Nic] AI importance tagger** — skipped, no changes (your call at session start).
- [x] **[Nic] Smoke test passed → merged dev → main** — live on production same day.

---

## Done This Session ✓ (2026-08-24, chore-assistant — Assistant Upgrade Design Spec)

- [x] **[Nic] Full assistant upgrade designed and approved** — four phases: smarter brain + Claude-grade look and feel, live-data lookups + memory, attachments → pending job, Projects. Spec committed and pushed to dev; no code written yet.
- [x] **[Nic] Decisions made this session** — model: **Sonnet 5** (same price tier as today, currently cheaper on intro pricing); phased build (Option 1); **privacy rule: assistant memory never crosses users** — the digest vote → vault stays the only bridge; job creation is the **only** action the assistant may take, saved as pending with a **quick confirm in chat** first; **Move to…** on bucket files so wrong filings need no re-upload; Projects at full depth (folders + shared files + instructions + linked memory); composer mic = free browser dictation; **no model picker** in the UI; mobile gets the app-like drawer layout (3-line button top-right); **only meaningful chats** enter memory, with a Memory view to edit/remove; **incognito mode skipped** (your call after discussion).
- [x] **Vault submodule bookmark updated** — the repo now records the vault at its 18 Aug state (the digest promotions); the `M vault` git noise is gone.

---

## Done This Session ✓ (2026-08-24, feat-schedule — Revert Completed Jobs + Bulk Actions + Card Team Lines)

- [x] **[Nic] Decision — who can revert a completed job** — every role except installer (your call, incl. designer/production), and no Telegram message fires on a revert (quiet undo).
- [x] **[Nic] Revert to Scheduled live** — button + confirm popup in the completed job's bottom bar; the job goes back to the schedule, unlocks on the spot, and keeps its original FCFS queue position instead of dropping to the back.
- [x] **[Nic] Bulk buttons on the selection bars** — Completed tab: Revert N; Schedule tab: Complete N (green) — both scheduler-only with the same inline confirm step as Delete.
- [x] **[Nic] Team lines on list cards** — schedule/pending/completed cards now show `Installer:` bottom-left and a left-aligned `Sales:`/`Coordinator:` box bottom-right, with NIL when empty (your mockup); installer screens deliberately unchanged.
- [x] **[Nic] Bell overdue cards show Sales + Coordinator** — under the address, NIL when empty.
- [x] **[Nic] Telegram header matches what happened** — assigning to an empty job says ✅ Installer Assigned; modifying an existing team says ❗ Installer Changed; removing the last installer says ❌ Installer Removed (your screenshots drove this).
- [x] **[Nic] Verified everything on the dev preview, merged dev → main** — all live on production same day.

---

## Done This Session ✓ (2026-08-19, fix-files — Attachment Delete Fix)

- [x] **[Nic] "Deleted attachments come back" root-caused and fixed** — your Cloudflare theory was half right: the app never deleted anything from Cloudflare, but the reason files reappeared was the database silently refusing the delete (no delete permission rule was ever written for the files table, and the app never checked). Deletes now go through the server, which checks who's asking, deletes the Cloudflare copy first, then the database row.
- [x] **[Nic] Decision — who can delete attachments** — matches the screen as it already was: every office role (sales, scheduler, coordinator, designer, production, admin) on non-completed jobs; installers never; completed jobs locked for everyone.
- [x] **[Nic] Bucket delete no longer leaks files into job chat** — deleting a bucket used to quietly unhook its files (which then showed up in the job chat) and strand their Cloudflare copies; it now truly deletes the files with the bucket.
- [x] **[Nic] Real error messages on failed deletes** — a failed delete now shows a red error instead of the file pretending to vanish; successful deletes show a green confirmation.
- [x] **[Nic] Verified on preview, merged dev → main** — fix live on production (confirmed the new delete route is serving).
- [x] **[Nic] Stale-tab leak caught right after the merge and cleaned up** — you deleted the DESIGNER JO bucket from a tab still running the old code (an open tab keeps the old version until refreshed), which leaked its two PDFs into the job chat one last time. Both leaked files were fully removed with a one-off script you approved (Cloudflare copy + database row); verified zero leaked attachments remain on any job. Lesson: after a production deploy, refresh open tabs before testing.
- Note: files deleted from the app also disappear from the server-PC archive at the next 02:00 sync — the archive is a mirror, not history (existing checklist item covers the snapshot decision).

---

## Done This Session ✓ (2026-08-18, feat-rollout — Rollout Pack + Connect Telegram + Digest Fixes)

- [x] **[Nic] Rollout materials approved + built** — 10-slide deck, 6 printable role cheat sheets, and your step-by-step runbook (all in `docs/rollout/` and published as private artifact pages; links at the top of the runbook). Your decisions: deck + cheat sheets format, English only, collect emails before the meeting (Option A).
- [x] **[Nic] Connect Telegram self-link chosen and live on production** — everyone links their own Telegram with two taps (profile picture → Connect Telegram → START); no chat-ID pasting, no database migration, no new Vercel settings. You verified the button on the preview.
- [x] **[Nic] Digest mis-route caught and fixed** — your test exposed that the Admin → Digest tab still sent via the ops bot (leftover from before the digest bot existed). Now routes via @Greenqubes_digest_bot; you verified the send arrives from the right bot.
- [x] **[Nic] Digest voting fixed** — "your account is not registered" was your deleted old account sharing your Telegram ID; deleted accounts are now ignored everywhere in the digest (votes, majority count, broadcasts, D-Promote) and the ghost row's Telegram ID + digest tick were cleared from the data (your call).
- [x] **[Nic] Vanishing vault notes root-caused and fixed** — Vercel kills background work once a response is sent, so the vault write was dying mid-flight. Now awaited; you verified live: vote at 20:24:09 → note on GitHub at 20:24:17 (8 seconds).
- [x] **[Nic] Promoted notes follow your reorganised vault** — they now land in `Table of Content/Digest/` (your call), matching where you moved the May note. Your stranded "Plywood" promotion was rescued there, then all three test notes deleted at your request before the 2:30 AM sync could teach them to the assistant.
- [x] **[Nic] D-Promote smirk reply added** — the assistant answers any message containing `D-Promote` with "I see what you did there 😏" instead of a normal AI reply (your request; no API cost).
- [x] **[Nic] Four dev → main merges, each verified by you on production.**
- Your Obsidian already auto-pulls every 11 minutes + on startup (Git plugin) — promoted notes appear in Obsidian within minutes, no setup needed.

---

## Done This Session ✓ (2026-08-18, chore-mobile — Webapp Launched v1.0.0 + Mobile App Design)

- [x] **[Nic] Webapp declared LAUNCHED at v1.0.0** — your call: all necessary testing already done, so the planned alpha/beta/launch rounds (Sessions 21–23) are closed without being run. The current production site is the launched product; the webapp continues as the desktop/office tool.
- [x] **[Nic] Mobile app fully designed and specced** — Android + iPhone app, one codebase, same data as the webapp, built in 3 stages with per-job chat as the make-or-break feature. Your decisions recorded: Android first (free .apk installs), iPhone waits for the directors' Apple Developer greenlight, Telegram retires only when both halves of the team have the app, chat stays per-job only, email sign-in link added as the second login method (webapp + app).
- [x] **[Nic] Scope decisions** — app v1 covers everything except the admin screens and FCFS board (desktop-only); external installers keep their web links; chat extras (read receipts, replies, reactions) deliberately deferred.
- [x] **Spec committed** — [superpowers/specs/2026-08-18-mobile-app-design.md](superpowers/specs/2026-08-18-mobile-app-design.md); your read-through is the next step before any code.

---

## Done This Session ✓ (2026-08-18, visual-design — Logo Palette Rebrand + Clickable Logo)

- [x] **[Nic] Top-bar logo made clickable** — tapping the GreenQubes logo anywhere in the app now goes to the Schedule page; installers get sent to their My Jobs page instead. Verified on preview, merged to main.
- [x] **[Nic] Decision — rebrand scope: accents only** — backgrounds, text and borders stay; the five accent colors moved to the logo palette (lime `#91C740` + slate `#6C747C` anchors, plus teal/sand from the palette strip).
- [x] **[Nic] Decision — buttons use a darker lime with white text** — the true logo lime stays for small highlights only (chat live dot, browser-tab icon), since white text on bright lime is unreadable.
- [x] **[Nic] Decision — installer/success color is teal, not a second green** — the company green stays the only green in the app.
- [x] **[Nic] Caught on preview: punctuality colors must not rebrand** — strict = red / flexible = blue is a company scheduling signal. Now locked in dedicated `--punct-*` tokens that no future palette change can touch; rule recorded in CONTEXT.md.
- [x] **[Nic] Verified both rounds on preview + merged to main** — rebrand live on production same day.

---

## Done This Session ✓ (2026-08-17, ux-notifications — Overdue Bell Alerts + Pre-Alpha Green Light)

- [x] **[Nic] Session 19 pre-alpha testing PASSED clean** — your solo run found no issues, so the Session 20 hotfix round was skipped entirely. Green light to bring in the scheduler for Session 21 alpha testing.
- [x] **[Nic] Overdue bell alerts made informative** — the cards now show project title, company ("Untitled" when the job has none), the date with its day (`13/08/2026 (Thu)`, your pick), and location — no more bare-date cards.
- [x] **[Nic] Mark as read added to the drawer** — greys every red alert and returns the bell to normal; remembered on the device you pressed it (your pick over a database version). A job rescheduled to a new overdue date turns red again.
- [x] **[Nic] Decision — alerts are team-scoped** — only a job's Person-in-Charge, coordinators and formally assigned installers get its overdue alert (suggested installers never do); scheduler + admin keep the company-wide view (your pick).
- [x] **[Nic] Verified on preview, merged dev → main** — all three notification changes live on production and spot-checked there.
- [x] **[Nic] Decision — Bryan's old settings change skipped permanently** — his 28 May commit (which would have untracked the shared Claude settings file you edit) is recorded as merged without taking effect; the session-start check stays quiet from now on and his future work merges normally.

---

## Done This Session ✓ (2026-08-13, chore-db — Brand Logo + Test-Data Wipe)

- [x] **[Nic] Brand logo live on production** — your GreenQubes logo PNG now replaces the text wordmark in the top bar (every page) and on the login card. Pre-Alpha tag removed (your call); in dark mode the grey half gets a small brightness lift so it stays readable. Preview checked, then merged `dev` → `main`.
- [x] **[Nic] Full test-data wipe executed on production** — your call on scope: all jobs + their attachments, bug reports + screenshots, in-app notifications, crash logs. Deleted: 46 jobs (35 scheduled / 10 pending / 1 completed) with all cascaded data, 1 bug report, 27 crash logs, and 44 R2 files (15.6 MB). A dry-run count was shown and approved before anything was deleted; every count verified zero afterwards.
- [x] **[Nic] Kept: everything login- and reference-related** — all user accounts, the client company list, the external installer contact pool, assistant chats, and the knowledge base.
- [x] **One-off wipe script deleted after use** (your call) — it was dry-run-by-default with an explicit `--execute` flag; not kept in the repo.
- ⚠️ **Archive mirror note** — the deleted R2 files still sit in `E:\Greenqubes-Archive\r2` on the server PC until the next 02:00 sync mirrors the deletion. Copy that folder first if you ever want the old test attachments back; this morning's DB dump keeps the pre-wipe database snapshot either way.

---

## Done This Session ✓ (2026-08-13, fix-auth — Security Audit + Fixes)

- [x] **[Nic] Full security + integrity audit run** — whole webapp checked: access control (RLS), login/session, every API route, exposed secrets, file storage, webhooks/crons, injection surfaces. Write-up: [security-audit-20260813.md](security-audit-20260813.md).
- [x] **[Nic] CRITICAL fixed — any logged-in user could make themselves admin** — the database rule that lets you edit your own profile didn't stop you changing your own **role**, so an installer could flip to admin/scheduler from the browser and see all jobs, all money figures, and everyone's private assistant chats. Migration **0044** adds a guard that blocks non-admins from changing their own role (and other sensitive fields). Applied to the shared DB + merged to main.
- [x] **[Nic] MEDIUM fixed — anyone could delete the client list** — client tables + routes now limited to office roles (sales/scheduler/coordinator/admin). Migration **0045**.
- [x] **[Nic] MEDIUM fixed — file download links weren't access-checked** — the app now confirms you're allowed to see a file's job before handing out a download link; bug screenshots limited to scheduler/admin.
- [x] **[Nic] LOW fixed — could rename/overwrite another user's saved AI chat** — chat edits now locked to the owner.
- [x] **[Nic] Ran `npx supabase db push` for migrations 0044 + 0045** — both applied to the shared DB; production covered.
- [x] **[Nic] Verified on preview + merged to main** — the three legitimate flows (add a client, download a job file, rename an assistant chat) confirmed still working; `dev` → `main` merged, all four fixes live on production.
- [x] **[Nic] Stale doc corrected** — the "admin is email-gated / can't be bypassed" note was false since May (admin became a role in migration 0019); rewritten with the correct picture.
- Lower-priority hardening notes captured above under "Security hardening — lower priority" for a future session (fix whenever).

---

## Done This Session ✓ (2026-08-12, feat-realtime — Live Updates Everywhere)

- [x] **[Nic] Ran `npx supabase db push` for migration 0043** — `job_assignees` + `job_tasks` now broadcast changes; applied while production was live (additive, safe).
- [x] **[Nic] Two-window live tests passed on the branch preview AND the dev preview** — schedule, FCFS, job form (silent sync + amber banner protecting unsaved typing). First test round was accidentally on the dev preview, which didn't have the code yet — lesson: each branch has its own preview address.
- [x] **[Nic] Installer live test passed on production** — real installer login: formally assigned job appeared on its own; a suggestion stayed hidden (the security check).
- [x] **[Nic] Decision — admin page stays refresh-on-visit** — no live push for a single-user page; new bug reports already ping via Telegram.
- [x] **[Nic] Decision — `feat-live-updates` kept as an archive branch** — same rule as `feat-workflow-v2`: historical record only, no new pushes. Recorded in CLAUDE.md.

---

## Done This Session ✓ (2026-08-12, infra-config — Obsidian Sync Outage + KB Restore)

- [x] **[Nic] 57-day vault sync outage found and fixed** — sync died 7 June (print-server hang → restart → signed-out PC); revived 7 Aug, verified running unattended 5+ nights straight. Permanent logon fix recorded under infra-backup above.
- [x] **[Nic] Supplier pricelists restored to the assistant** — DAMA, Jacky Printing and Manhour Labor had been silently deleted from the knowledge base since early June; restored with correct role locks (sales/scheduler; Manhour sales-only) and verified row-by-row.
- [x] **[Nic] PTW files locked down (your call)** — COMPANY_PROFILE.md and MALLS.md had no visibility setting and would have been visible to installers; now sales/scheduler/coordinator only.
- [x] **Two sync-script bugs fixed with tests, live on dev + main** — Obsidian's multi-line frontmatter format was misread into garbage visibility tags; Windows line endings made the server produce one giant chunk per note and leave duplicates behind. 20 automated checks now cover both.
- [x] **Server PC diagnosis checklist written** — [server-pc-sync-checklist.md](server-pc-sync-checklist.md), phone-friendly, with a findings decoder.

## Done This Session ✓ (2026-08-12, infra-backup — Nightly Backup Was Never Running)

- [x] **[Nic] Found that there was no backup at all** — not a broken one, none. This checklist had claimed since May that a nightly 02:00 backup was running. The rclone setup and env var were done, and the script was hand-tested once on 7 May, but the Task Scheduler entry was never created. The R2 archive folder held **zero files** — three months of job attachments and photos existed only in Cloudflare.
- [x] **[Nic] Nightly backup created and verified** — `Greenqubes Nightly Backup`, daily 02:00. First run pulled 41 files / 15.3 MiB from R2 and produced a 205 KB database dump (22 tables with data, verified complete, not just a file of the right size).
- [x] **[Nic] Database connection fixed** — the saved address pointed at a server this PC physically cannot reach (IPv6-only, no IPv6 here). Switched to the IPv4 pooler address on port 5432.
- [x] **[Nic] Database password rotated and updated everywhere on the server PC.**
- [x] **[Nic] Both nightly tasks now run when nobody is logged in** — backup (02:00) and Obsidian sync (02:30). Previously they only ran if someone happened to be signed in to the server PC. Both test-run clean afterwards.

---

## Done This Session ✓ (2026-08-06, infra-notifications — Overdue Alert Scope + Schedule)

- [x] **[Nic] Overdue alerts scoped to the last 3 days** — jobs dated more than 3 days ago no longer alert at all. They're treated as abandoned data rather than work to chase.
- [x] **[Nic] Cron settled at twice daily, 9am + 6pm SGT** — went daily → every 2 hours → your call to make it just twice a day. Confirmed showing correctly in the Vercel dashboard.
- [x] **[Nic] Manual production blast run** — sent 27 real Telegram alerts, which is what exposed the problem: the check had no lower date limit, so every old unfinished job re-fired on every run, forever.
- [x] **[Nic] Merged to production** — `dev` → `main` pushed 2026-08-06.

- [x] **[Nic] Clean up the ~27 finished-but-still-`scheduled` jobs** — DONE 2026-08-13: gone in the full test-data wipe (all 46 jobs deleted).

---

## Done This Session ✓ (2026-08-06, feat-files — File Names + Readable R2 Folders)

- [x] **[Nic] Scope + design decisions made** — fix names inside the app (store original name in DB, Cloudflare keys stay coded); folder pattern `{date}_{title}_{code}`; only NEW jobs get readable folders; folder frozen when the job is created (title edits never move files).
- [x] **[Nic] Ran `npx supabase db push` for migrations 0041 + 0042** — from the session's isolated copy of dev (your usual folder was on the other session's branch). This also cured the preview crash: the new code asked for the file-name column before it existed.
- [x] **[Nic] Smoke test passed on the preview** — real names in buckets/chat/camera uploads verified in the DB; duplicate carried names; readable folder `2026-08-06_Test-Job-R2-Cloudflare-Fix-Copy_0cd037cb` visible in the R2 dashboard.
- [x] **[Nic] Approved merge to production** — `dev` → `main` pushed 2026-08-06; DB was migrated before the deploy so production had no crash window.
- [x] **Old June R2-folder plan retired** — superseded by the simpler trigger design (see the ticked item above).

---

## Done This Session ✓ (2026-08-06, ux-jobs — Job Form Tabs + Duplicate)

- [x] **[Nic] Design decisions made** — phone gets 4 tabs (Details/Team/Files/Chat, "cleaner the better"); PC gets a two-column view (Details+Team left, Files+Chat right) with every card collapsible except Job Chat; New job shows the same 4 tabs with Files/Chat locked until saved.
- [x] **[Nic] Smoke test passed — phone AND PC** — tabs, columns, collapse memory, locked tabs all green on the preview.
- [x] **[Nic] Duplicate button scoped + tested** — copies Details-tab fields, attachment buckets and production photos into a new pending job; only location clears; title gets " (Copy)"; signed DO / completion photos / team / chat / tasks never copy.
- [x] **[Nic] Bug found during testing: bucket uploads appeared in job chat** — pre-existing production bug (chat and buckets share the same internal file tag); fixed and verified on the preview.
- [x] **[Nic] Approved merge to production** — `dev` → `main` pushed 2026-08-06; tabs redesign + Duplicate + chat fix all live.
- [x] **Future planning notes added** — Telegram notification tracker (behind the Team-tab placeholder card) and sub-jobs under a parent job (dropdown); both need their own design session.

---

## Done This Session ✓ (2026-08-05, ux-schedule — Schedule List Scrolling UX)

- [x] **[Nic] Smoke test passed — desktop AND mobile** — all 7 sections green after two feedback rounds (fixed heading arrows wider, month label centred, Today button moved left).
- [x] **[Nic] Approved merge to production** — `dev` → `main` pushed 2026-08-05; new schedule navigation live.
- [x] **[Nic] Design decisions made** — week↔month strip toggle (icon-only, shows target layout); filter chips removed; Monday-start weeks everywhere; jump calendar list-view-only for now.
- [x] **[Nic] Boss decision relayed — no new Bengali translations** — new UI text gets English + Chinese only; Bengali shows English automatically. Recorded in CONTEXT.md.
- [x] **Interactive mockup approved before build** — `public/mockups/schedule-list-ux/index.html` (kept for record).

---

## Done This Session ✓ (2026-07-30, feat-jobs — Workflow V2 Phase 4)

- [x] **Phase 4 built + smoke test PASSED — the Workflow V2 build is COMPLETE.** External installer lifetime links (public page: accept/decline, job detail, task ticking), external installers bucket, sub-installer bucket, job task list.
- [x] **Migrations 0039 + 0040 applied** — you ran `npx supabase db push` twice (0039 needed one fix: its random-link generator wanted a database add-on we don't have; swapped to the built-in one).
- [x] **Your feedback built in** — external bucket now visible to every office role: sales suggests (amber, invisible to the contact until confirmed), scheduler/coordinator confirms, designer/production view-only. Sub-installer Telegram reads "Job Assigned — Supporting Role" with the main team's names.
- [x] **Bugs found + fixed during your test** — copied external links pointed at the production site instead of the preview (now they use whichever site you're on); the sub-installer Telegram was silently rejected by Telegram (a formatting typo).
- [x] **Deferred by plan** — live chat on the external page; externals call the person-in-charge instead.

---

## Done This Session ✓ (2026-07-22, feat-jobs — Workflow V2 Phase 3)

- [x] **Phase 3 built + smoke test PASSED** — FCFS Board live at `/fcfs`: day timeline ranked first-come-first-served, colour-coded installer bars, clash chips + drawer, slide-in assignment panel. All 6 sections green after fixes.
- [x] **Migration 0038 applied** — you ran `npx supabase db push`. FCFS rank counts from when a job is **pushed to the schedule**, not when it was created (your call — sales can't see each other's pending jobs).
- [x] **Your smoke-test feedback fixed + verified** — 9am–6pm bar drift on wide screens; overlays no longer hidden behind the bottom nav; bolder "Created first (priority)" labels; scrollable clash chips; "All day" shown on the schedule tab for untimed jobs.
- [x] **New hard rule recorded in CLAUDE.md** — overlays (modals, drawers, panels) must always layer above the bottom nav.
- [x] **Bug: dropdowns hid newly provisioned users** — Person-in-Charge only listed sales; Sub POC only sales/scheduler/admin on the new-job form. Both now list every office role on both forms.
- [x] **Clash-on-edit gap closed** — editing a scheduled job's time/installer onto another booking now warns first (scheduler: Save Anyway / Go Back; coordinator: Alert Scheduler & Save / Re-assign).
- [x] **Future planning noted** — schedule list scroll UX, Android/iOS ports (directors' request), Windows/Mac desktop apps, full security audit before go-live.

---

## Done This Session ✓ (2026-07-22, feat-jobs — Workflow V2 Phase 2)

- [x] **Phase 2 built + smoke test PASSED** — all 6 sections green. Role-locked job form + installer suggestion → assignment flow.
- [x] **Migration 0037 applied** — you ran `npx supabase db push`.
- [x] **Suggestion flow works end-to-end** — sales suggests (yellow) → hidden from the installer → scheduler assigns (green) → Telegram fires → installer now sees it. Verified with a **real installer login**.
- [x] **Bug: attachment buckets wouldn't upload** — "upload failed" on Permit-to-Work / BCA / Designer JO / Others. Was tagging files with the wrong user id. **This was broken in production too**, not just the preview.
- [x] **Bug: installer's job list showed a blank title** — a fragile database join. Fixed; also added "Untitled job" for genuinely empty jobs.
- [x] **Bug: new-job form used your real role, not the previewed one** — sales suggestions were being saved as real assignments.
- [x] **Clash modal — Notify Scheduler / Push Anyways** added, plus a soft (non-blocking) heads-up when the clash is only because an installer has an all-day job with no fixed time.
- [x] **Preview-as now covers all 6 roles** (Coordinator, Designer, Production added).
- [x] **FCFS tab dropped from the installer view** (your decision).

---

## Done This Session ✓ (2026-06-11, fix-schedule)

- [x] **Mockup 404 fixed** — Workflow V2 HTML mockups moved to `public/mockups/workflow-v2/`; now accessible on Vercel preview at `/mockups/workflow-v2/index.html`.
- [x] **Schedule date strip shows all dates** — list view carousel now shows every day from earliest job to latest (filling gaps between jobs), not just days with assigned jobs.
- [x] **feat-workflow-v2 branch pushed** — merged up to date with dev and pushed to remote; Vercel generates a separate preview URL for this branch automatically.

## Done This Session ✓ (2026-06-05, infra-config)

- [x] **[Nic] Overdue cron moved to 8am SGT** — `vercel.json` updated from `0 10 * * *` (6pm SGT) to `0 0 * * *` (midnight UTC = 8am SGT).
- [x] **R2 folder naming pattern agreed** — new format: `{YYYY-MM-DD}_{Company}_{Client-Name}_{Project-Title}`; 4 sub-tasks captured in checklist for next coding session.
- [x] **plan.md session note link fixed** — last session note was linked to a non-existent file; corrected to `fix/fix-assistant-20260603-1-note.md`.

## Done This Session ✓ (2026-06-03, fix-rag)

- [x] **[Nic] Supplier pricing added to Obsidian vault** — DAMA acrylic pricelist + Jacky Printing pricelist created in vault/suppliers/; synced to Supabase kb_chunks; assistant can now answer supplier pricing questions.
- [x] **RAG retrieval fixed** — Voyage AI input_type (query/document) added; kb_chunks match threshold tuned to 0.35; filename prepended to embeddings for supplier name searchability.
- [x] **Table rendering in assistant chat** — MarkdownMessage now renders markdown tables with headers, borders, and alternating row shading.
- [x] **Merged dev → main** — all fixes live on production.

## Done This Session ✓ (2026-05-29, feat-admin-3)

- [x] **[Nic] Remove User feature — tested on preview** — removed a user via Admin → Users tab; modal confirmed correct. Feature live on Vercel preview. DB migration still needs applying (see pending above).

## Done Last Session ✓ (2026-05-28, feat-admin)

- [x] **[Nic] TELEGRAM_BUG_BOT_TOKEN + TELEGRAM_BUG_CHAT_ID added to Vercel** — bug report Telegram notifications now fire.
- [x] **Admin Bugs tab forbidden error fixed** — admin role now allowed in GET/PATCH /api/bugs routes.
- [x] **Screenshot modal** — bug report screenshots open in an inline modal instead of a new tab.
- [x] **Health tab: three Telegram bots** — ops, digest, and bugs bots all shown in system checks.
- [x] **Health tab: obsidian sync + overdue cron last-run time** — both now write events table rows; health tab shows last run instead of "unknown".
- [x] **API usage logging for Voyage, Telegram, R2** — all three now appear in the usage tracker.
- [x] **Unusual activity: non-Singapore IP rule + geolocation** — non-SG calls flagged with city/country/ISP.
- [x] **Bug tab: delete fixed bugs** — single delete button per card + multi-select bulk delete.
- [x] **Bug tab: sort controls** — open bugs sortable by received date; fixed bugs sortable by fixed or received date.

## Done This Session ✓ (2026-05-28, fix-bugs)

- [x] Bryan's Vercel build error resolved — migration conflict (0015 → 0031) fixed, TypeScript types updated; Bryan needs to pull dev into dev-bryan to pick up the fix.

## Done Last Session ✓ (2026-05-26, infra-config)

- [x] **[Nic] Task Scheduler entry created** — server PC (E drive) configured for daily 2:30 AM nightly obsidian sync; bat file tested and confirmed working.

## Done Last Session ✓ (2026-05-26, feat-vault)

- [x] **[Nic] Vault folder scaffolding** — created clients, suppliers, sops, jobs, templates, contacts, digest folders in greenqubes-kb; committed + pushed to vault repo; submodule pointer updated in main repo.
- [x] **[Nic] GitHub vault token** — fine-grained PAT created for greenqubes-kb (Contents: Read+Write); GITHUB_VAULT_REPO + GITHUB_VAULT_TOKEN added to .env.local and Vercel dashboard.
- [x] **Obsidian vault convention** — naming, tagging, visibility rules specced and documented at docs/superpowers/specs/2026-05-26-obsidian-vault-convention-design.md.
- [x] **Auto-write on digest promotion** — majority Telegram vote now auto-commits a Sonnet-generated .md note to vault/digest/ via GitHub API; promote route replaced (copy-paste HTML → JSON auto-commit); digest webhook fires auto-promote on majority; tested end-to-end on production.
- [x] **Nightly obsidian sync script** — scripts/nightly-obsidian-sync.bat created (git pull vault + obsidian-sync.ts); Task Scheduler setup guide at docs/setup-task-scheduler-obsidian-sync.md.

## Done This Session ✓ (2026-05-25, feat-assistant-3)

- [x] **Per-user history isolation** — migration 0030 drops the cross-read RLS policy on `asst_chats`; each user now only sees their own conversations.
- [x] **Optimistic "New Conversation" on first send** — sidebar shows new entry immediately when user sends first message; no waiting for save to complete.
- [x] **Live auto-rename via Haiku** — after AI's first reply, Haiku generates a 3–5 word title and updates the sidebar entry live; manual rename persists and blocks auto-rename.
- [x] **Rename from ⋮ dropdown** — rename modal with text input; optimistic update + PATCH `/api/assistant/rename`; persists on next load.
- [x] **Bulk multi-select delete** — "Select" mode with checkboxes on each row; terracotta delete bar at bottom; confirmation modal; parallel DELETE calls.
- [x] **Message count + star importance hidden** — removed from sidebar and history list UI; still stored in DB for backend use.
- [x] **Markdown rendering** — `MarkdownMessage` component renders `##/###`, `**bold**`, `*italic*`, `---`, `> blockquote`, `- lists` cleanly; no new npm dependencies; replaces raw `whitespace-pre-wrap` in both AssistantShell and FloatingChatPanel.
- [x] **Type while AI streams** — textarea no longer disabled during streaming; send button still blocked until reply finishes.
- [x] **Full-width "← Assistant" sub-header** — moved above sidebar + content row so it spans the full width; sidebar history list starts below it.
- [x] **New Chat button clears BottomNav** — restored `pb-[72px]` on sidebar footer so New Chat button is not covered by the fixed BottomNav.

## Done This Session ✓ (2026-05-21, ux-nav)

- [x] **CompanyBar shared component** — new `src/components/CompanyBar.tsx`; renders GreenQubes wordmark + Pre-Alpha + bell + user menu; sticky `top-0 z-30`; used in all 7 shells.
- [x] **NotificationDrawer decoupled from jobs prop** — now fetches overdue jobs internally via Supabase client on mount and on open; no longer needs `jobs: ScheduleJob[]` passed from parent.
- [x] **Company bar persistent across whole app** — ScheduleShell, ApprovalsShell, InstallerShell, AssistantShell, AdminShell, JobDetailShell, NewJobShell all use CompanyBar at the top.
- [x] **AdminShell stacking fixed** — existing admin header moved to `sticky top-[45px]` so it stacks below CompanyBar without overlap.
- [x] **BottomNav kept on list/dashboard pages only** — removed from job form shells after review (cramped with action bar); remains on Schedule, Approvals, Installer, Assistant, Admin.

## Done This Session ✓ (2026-05-21, ux-jobs)

- [x] **GreenqubesAI role dropdown locked** — Admin → Users tab hides role dropdown for GreenqubesAI user; shows a read-only label instead so it can't be accidentally changed.
- [x] **Person-in-Charge + Sub POC / Coordinators labels** — Team card renamed from "Main Sales / POC" and "Sales / POC" to clearer labels.
- [x] **Person-in-Charge X button** — shown only when the selected POC differs from the original job creator; pressing it reverts back to the original. Original creator never shows the X.
- [x] **Sales pending action bar** — two buttons: "Save Changes" (amber, saves all fields) + "Push for Approval" (terracotta, runs clash check then submits to scheduler).
- [x] **Scheduler awaiting_approval action bar** — "Send Back to Sales" (amber, opens SendBackModal) + "Approve & Notify" (terracotta, saves + approves + redirects to schedule).
- [x] **Duplicate (WIP) placeholder** — disabled dashed-border button between Delete and Cancel; implementation deferred.
- [x] **Sales awaiting_approval: form lock + Recall** — whole form read-only; Duplicate (WIP) hidden; single amber "Recall" button sets status back to pending; once recalled, normal pending layout (Delete, Duplicate WIP, Cancel | Save Changes + Push for Approval) resumes automatically.
- [x] **Sales scheduled state** — "Push for Approval" hidden; "Save Changes" expands to full width.
- [x] **InstallerGrid badge fix** — tick badge now overlays correctly (moved outside `rounded-full` div).
- [x] **SuggestField renamed** — "Improve" → "Suggest" throughout component.
- [x] **Upload API fix** — `production_instructions` added to valid upload kinds (was returning 400).

## Done Last Session ✓ (2026-05-20, feat-notifications-2)

- [x] **Chat notification throttle** — job chat Telegram notifications fire at most once per 1 minute per recipient; no more per-message spam.
- [x] **Accurate unseen message count** — new `job_chat_state` table tracks `last_seen_at` and `last_notified_at` per (job, user); notification shows real count of messages missed since last open.
- [x] **New chat batch template** — `tplJobChatBatch`: "💬 You have X New Messages / Project Title / Client / Time / Location / Date".
- [x] **View in app → opens system browser** — uses InlineKeyboardButton `url` type, not callback; opens Safari/Chrome instead of Telegram's built-in WebView.
- [x] **chat-read API route** — `POST /api/jobs/[id]/chat-read` upserts `last_seen_at = now()` for current user; called on ChatSection mount so unseen count resets when chat is opened.
- [x] **Migration 0027** — `job_chat_state` table applied to remote DB via `npx supabase db push`.
- [x] **CLAUDE.md branch exception removed** — feat-job-form-redesign branch exception removed; all changes go to `dev` branch as normal.

## Done Last Session ✓ (2026-05-20, feat-jobs)

- [x] **Attachment buckets** — jobs now have named file buckets (default: PERMIT-TO-WORK, BCA, DESIGNER JO, OTHERS); upload images/files, add URL links, rename buckets, delete buckets; images open in lightbox.
- [x] **Company/POC dropdowns** — SearchableSelect for client company and POC name on job form; add new company/contact inline; delete with confirm modal.
- [x] **Sales POC dropdown** — sales POC field on new job form uses SearchableSelect; defaults to current user.
- [x] **Installer grid** — 2-column toggle grid on new job form; shows role, years experience, skills; green ring + tick when selected.
- [x] **Admin: installer fields** — when editing an installer in Admin → Users, new fields: Years of experience (number) and Skills (chip input with Enter/comma add + × remove).
- [x] **Migrations 0025 + 0026** — `attachment_buckets` table + `bucket_id`/`url_text` columns on `files`; `clients` + `client_contacts` tables.
- [x] **AttachmentBuckets replaces AttachmentSection** — edit job page now uses the full bucket UI instead of the old flat file list.
- [x] **feat-job-form-redesign branch** — was set as the permanent branch for job form edits, but CLAUDE.md was subsequently updated (feat-notifications-2) to remove this exception; all branches now go to `dev` as normal.

## Done ✓ (2026-05-20, feat-digest)

- [x] **Dedicated digest Telegram bot** — separate `TELEGRAM_DIGEST_BOT_TOKEN` + `TELEGRAM_DIGEST_WEBHOOK_SECRET`; all digest sends and votes use the digest bot, completely isolated from the main ops bot.
- [x] **D-Promote secret command** — typing `D-Promote` in any assistant conversation forces `importance = 5` and immediately sends the conversation to all `digest_subscriber` users via the digest bot; word stripped from Telegram summary so recipients don't see it.
- [x] **Voting — strict majority both ways** — both Promote and Dismiss require >50% of digest subscribers; 1 vote out of 2 people now correctly shows pending, not immediate result.
- [x] **Live poll count on messages** — every vote edit now always shows `📊 X Yes · Y No · Z Pending`; outcome line appended below when resolved (`Information Promoted to Vault!` / `Information Dismissed!`).
- [x] **Buttons disabled after voting** — voter's copy of the message has Promote/Skip removed immediately after they tap; other subscribers' copies keep their buttons until they vote.
- [x] **5-day timeout cron** — `/api/cron/digest-timeout` runs daily at 00:00 UTC; auto-resolves stalled votes after 5 days (strict majority yes → promoted, else dismissed); fills remaining votes in DB to prevent re-trigger.
- [x] **digest_subscriber flag respected everywhere** — all digest recipient queries (vote count, D-Promote send, Monday digest, timeout) now filter by `digest_subscriber = true`; unchecking the box in Admin instantly removes the user from all counts.
- [x] **CLAUDE.md — importance scoring check** — added step 5 to session start: ask Nic about any updates to the 1–5 importance scoring categories in the tagger.

## Done ✓ (2026-05-20, feat-chat-2)

- [x] **Chat: attachment thumbnails** — image files show inline thumbnail (220×160px) with terracotta footer strip on own messages + download arrow on right; documents show compact card with coloured file-type icon box (PDF/Word/Spreadsheet/ZIP) + filename + type label + download arrow; voice notes show play-button card with deterministic waveform bars (grey before play, sweep terracotta left-to-right as audio plays, pause/resume supported).

## Done Last Session ✓ (2026-05-19, fix-chat)

- [x] **Job chat realtime fixed for all roles** — `createBrowserClient` non-singleton caused constant subscription churn (fixed: `useMemo`); admin not in auth.uid() RLS policy (fixed: migration 0023); `@supabase/ssr` browser client doesn't auto-wire JWT to realtime (fixed: explicit `realtime.setAuth()` before subscribe); RLS policies rewritten as `EXISTS` subqueries for reliability (migration 0024); avatar/name for incoming messages now resolved via name cache + async fetch.

## Done ✓ (2026-05-19, feat-chat)

- [x] **In-app notifications for send-back events** — bell drawer shows send-back reason; mark all read button in header; selective delete with checkboxes in drawer footer; migration 0022 applied.
- [x] **Sales POC shown on approval cards** — "Requested by [name]" with icon on each approval card.
- [x] **Grammar suggest in send-back modal** — Suggest button calls `/api/suggest-grammar` (Haiku); replaces textarea with corrected text.
- [x] **Wipe [Sent Back] messages on approval** — `/api/jobs/[id]/approve` deletes all messages starting with `[Sent back]` from job chat when job is approved/scheduled.
- [x] **Chat: WhatsApp-style layout** — own messages right-aligned in terracotta bubble; others left-aligned with avatar + name above.
- [x] **Chat: avatars with initials** — colour-coded by name hash (same logic as UserMenu); fixed Supabase join key bug (`author`/`uploader` → `users`) that was causing all avatars to show `?`.
- [x] **Chat: camera capture button** — separate camera input with `capture="environment"`; auto-renames to `{username} {date} {time}`.
- [x] **Chat: file auto-rename** — voice notes and camera captures renamed to `{username} {date} {time}`; regular file attachments keep their original filename.
- [x] **Chat: bigger avatars** — increased from `w-7` to `w-9`.

## Done This Session ✓ (2026-05-12, feat-admin)

- [x] **Pre-provision users without prior sign-in** — admin can now provision by email before user signs in; migration 0017 (`email` column + partial unique index on `users`); `provisionUser()` rewritten; auth callback links `auth_id` on first sign-in; UserRow shows "Waiting for sign-in: {email}" for unlinked rows.
- [x] **Monday digest confirmed working** — ran `npm run monday-digest`; skips correctly when no `importance >= 4` conversations exist.

## Done Last Session ✓ (2026-05-11, feat-notifications)

- [x] **Finalised all Telegram notification templates** — removed all `[PLACEHOLDER]` markers; added project title, POC name/phone, time ranges, job URLs, `sentAt` timestamps, `tplJobAssigned` (new); redesigned bug report template (removed screen/ip).
- [x] **Updated all 6 notification caller routes** — approve, send-back, submit, messages, overdue, bugs all pass new params via `getJobNotifData` helper.
- [x] **Obsidian sync — first run confirmed** — `greenqubes-kb` added as git submodule at `vault/`; `--use-system-ca` fix applied to all npm scripts; sync confirmed working.
- [x] **Added `NEXT_PUBLIC_APP_URL` to `.env.local`** — set to `https://greenqubes-ops.vercel.app`. Still needs adding to Vercel dashboard (see pending).
- [x] **Pre-alpha testing done** — bugs and feature requests logged above.
- [x] **UI/UX Pro Max design system generated** — `design-system/greenqubes-ops/MASTER.md` created (Trust & Authority style).

## Done Last Session ✓ (2026-05-11, session 1)

- [x] **Fixed duplicate `asst_chats` saves** — removed `saveConversation` from `sendMessage` in both AssistantShell and FloatingChatPanel; added unmount cleanup to AssistantShell.
- [x] **Deleted `features/chat-thread/`** — empty folder removed; chat stays in `job-detail/ChatSection.tsx`.
- [x] **Deleted `features/completion/`** — empty folder removed; completion logic confirmed in `job-detail/StatusSection.tsx`.
- [x] **Empty `docs/` prefix folders** — already gone (`.gitkeep` files deleted last session).
- [x] **Tightened `settings.local.json`** — `git push` scoped to `origin dev`, ~12 stale one-off entries removed.

---

## Security — Do Before Bringing in Any Team Members

- [ ] **Turn on 2FA** on every service account — GitHub, Vercel, Supabase, Anthropic, Cloudflare. Takes 10 minutes. Do this before any team member gets access.

---

## Ongoing — After Go-Live

- [ ] **Review first few Monday digests manually** — confirm what surfaces is worth promoting to Obsidian before trusting the process.

---

## Server PC — Already Set Up ✓

- [x] rclone installed and `greenqubes-r2` remote configured
- [x] `SUPABASE_DB_URL` set as system environment variable (using Supabase Connection Pooler — IPv4)
- [x] **Nightly backup scheduled in Task Scheduler at 02:00** — task "Greenqubes Nightly Backup" runs `scripts/nightly-backup.bat` → `scripts/backup.sh`. **Created 2026-08-12** — it was never actually scheduled before that date despite this line previously claiming otherwise; nothing had been backed up since 7 May 2026.
- [x] **R2 → `E:\Greenqubes-Archive\r2` sync working** — verified 2026-08-12, first successful run: 41 files, 15.3 MiB. Before this, the R2 archive folder was completely empty.
- [x] **DB dump → `E:\Greenqubes-Archive\db\` working** — verified 2026-08-12: 205 KB gzipped, 22 tables with data, clean `dump complete` marker. Connects via the IPv4 session pooler, port 5432 (the direct host is IPv6-only and unreachable from this PC; port 6543 is transaction mode and cannot dump).
- [x] Git Bash path confirmed: `C:\Git\bin\bash.exe`

---

## Done ✓

- [x] Supabase project created + env keys in `.env.local`
- [x] Cloudflare R2 bucket created + keys in `.env.local`
- [x] Cloudflare Images API token added
- [x] Anthropic API key added
- [x] Voyage AI API key added
- [x] Telegram bot created + token added
- [x] Google OAuth client created + Supabase callback wired
- [x] All DB migrations applied (0001–0011; 0012–0014 pending — see above)
- [x] Seed data applied (Sarah/Kai/Ravi/Ali + 4 demo jobs)
- [x] Vercel deployed — https://greenqubes-ops.vercel.app
- [x] All env vars set in Vercel dashboard
- [x] Telegram webhook pointed at Vercel URL
- [x] Supabase auth callback URL added for Vercel preview + production
- [x] Your Telegram Chat ID added to your user record
- [x] `messages` + `files` + `jobs` tables added to `supabase_realtime` publication
- [x] `REPLICA IDENTITY FULL` set on `messages`, `files`, `jobs`
- [x] GreenqubesAI scheduler account provisioned + tested
- [x] Supabase project linked via CLI (`npx supabase link`)
- [x] Job chat realtime fixed (Session 17.1 — simplified RLS policies)
- [x] DB password rotated (Session 17.11 — old password invalidated)

---

## Admin Security Note

Admin access is granted by the `role = 'admin'` field on the user's `public.users` row (changed from an email gate to a DB role in migration 0019, feat-admin 2026-05-14). The page (`/admin`) and every `/api/admin/*` route check `role === 'admin'` server-side. Only `ai@greenqubes.com` currently holds that role.

> **Correction (security audit 2026-08-13):** the earlier wording here claimed admin was email-gated and "cannot be bypassed by editing `public.users`." That has been false since migration 0019 — admin is now purely a role. Until migration **0044** (2026-08-13), any logged-in user could change their own `role` to `admin`/`scheduler` directly via the browser because the users update RLS rule had no column restriction. Migration 0044 adds a trigger that blocks non-admins from changing `role` (and other privileged columns) on their own row. See `docs/security-audit-20260813.md` finding #1.
