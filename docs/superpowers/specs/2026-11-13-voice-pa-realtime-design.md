# Voice PA, realtime — design

**Date:** 2026-11-13 · **Status:** Draft, waiting for Nic's approval
**Builds on:** `2026-09-04-voice-pa-design.md` (branch `feat-voice-pa`, parked; the "sandwich" version)
**Depends on:** the **job gateway**: one set of job rules on the server plus the job change history (see §4.1). It is a separate design, not yet written, and must be live first.

---

## 1. Why

The production and scheduling side of the app is in good shape. The next push is getting **sales** to actually use the system. Sales resist the job form ("too many insert steps", Nic, 4 Sep), so the company still leans on the Google job sheet and messages outside the app.

The answer is a **voice PA**. A salesperson talks to it the way they would talk to a colleague. It builds the job from the conversation, asks for what's missing, reads the job back, and puts it on the schedule. It can also change existing jobs. Nothing is typed.

The 4 Sep version proved the idea but was parked. It worked in turns (speak, wait, listen), so it was choppy, it misheard Nic, and the voice was robotic. Nic wants a **live conversation, "Jarvis-like"**: the PA answers straight away, and the person can cut in while it is talking.

### When it is used (Nic, 2026-11-13)

1. **On site, right after a client meeting.** The job is fresh in their head. A quick glance at the screen is possible.
2. **Driving, stuck in traffic, hands-free.** No tapping or reading once it is running. The PA must work by ear alone.

### Success looks like

- A salesperson creates and schedules a complete job in one short conversation without touching the form.
- Sales use it on their own, without being told to.
- The office can trust what lands on the schedule, and can see in the change history exactly what the PA did and for whom.

## 2. Goals, non-goals, anti-goals

**Goals**
- A live, interruptible voice conversation in the webapp on a phone (Android and iPhone browsers), also usable on desktop.
- Create jobs, put them on the schedule, and move jobs between stages, all by voice.
- **Full editing by voice** of existing jobs: any field the speaker is allowed to edit in the form today, including the date, time and address of a scheduled job.
- Questions as well: "What's on Thursday?", "Is Xiao Yi free Saturday night?" Everything the typed assistant answers today.
- English and Mandarin, including the mixed English-Mandarin and Singlish that sales actually speak.
- Built so the same voice setup moves into the future Android and iPhone app (§7) without a rebuild.

**Non-goals (v1)**
- A wake word ("Hey…"). Starting takes one tap.
- Working with the phone locked or behind another app such as Waze or WhatsApp. That arrives with the phone app.
- Assigning or changing crew by voice. Crew stays with the schedulers (my call, see §9).
- Deleting jobs by voice (my call, see §9).
- Bengali voice. Bengali users get English voice, as in the 4 Sep design.
- Telling the crew when a scheduled job's date changes. That is a separate item on Nic's To build list ("Tell the crew when a scheduled job changes"). Voice edits make it more pressing, but it is not part of this design.

**Anti-goals: it fails even if it technically works, if…**
- A misheard detail lands on the schedule without the speaker having heard it read back and said "confirm".
- The PA can do anything by voice that the same person could not do in the form. That covers stage rules, required fields and who may edit at each stage.
- An edit made by voice can't be traced: who, when, what it was before.
- It feels like the 4 Sep version: long pauses, talking over itself, losing what was said.
- It quietly runs up a bill.

## 3. Decisions made (Nic)

| # | Decision | When |
|---|---|---|
| 1 | Talk to the PA; it creates the job. It never opens the form for them. | 4 Sep |
| 2 | Hands-free conversation once started. A big mute button and a big X to leave. | 4 Sep |
| 3 | English and Mandarin, following each person's existing language setting. Bengali gets English voice. | 4 Sep |
| 4 | Full PA scope for every role. Job creation and editing stay limited to the roles that can do them today. | 4 Sep |
| 5 | **Realtime voice through LiveKit**, with Claude staying the brain. Nic approved adding LiveKit to the locked stack. | 13 Nov |
| 6 | **A spoken "confirm" is enough to put a job on the schedule (option B)**, after the PA reads the whole job back. No "made by voice" tag on the job itself. | 13 Nov |
| 7 | **Full editing by voice** of existing jobs, including scheduled ones. | 13 Nov |
| 8 | **The job change history must be live before this ships.** Nic: "change log is important for this to proceed — we can see what changed and who changed it at what time". | 13 Nov |
| 9 | **Runs in the webapp first (option A)**, but must be **built with the real Android and iPhone app in mind**. | 13 Nov |
| 10 | Start on LiveKit's **free plan** (no credit card, hard cap of 1,000 voice minutes a month, so no surprise bill). Decide on the US$50/month plan after a month of real use. | 13 Nov |
| 11 | **One set of job rules on the server** (the "job gateway"), used by the job form, the Voice PA and the future phone app. Nic: "works as a gateway either way for everyone". The form's own save moves onto it. | 13 Nov |
| 12 | **Trial budget goes to management for approval first.** The speech credit in LiveKit's free plan covers only about one day of real use, so any proper trial needs a card on file. The monthly ceiling is set once the budget is approved. | 13 Nov |
| 13 | **Dates are spoken in the conversation's language.** When the speaker uses Mandarin, the PA says dates in Mandarin. Screen labels stay English, per the hard rule. | 13 Nov |

## 4. Constraints

### 4.1 Hard dependency: the job gateway (server rules + change history)
A separate design, not yet written. The change history is on `nic-checklist.md` under To build (asked 2026-11-13), and the server rules are decision 11. **Nothing in the Voice PA ships until the gateway is live on production.** That covers creating and scheduling by voice as well as editing (Nic: the change history "is important for this to proceed").

This design adds two requirements to the gateway:
- **Every change records how it was made**: by form, by voice, by assistant, or by the system. A voice change then shows as "by voice", for example "Nic, by voice, 7:33pm: date Sat 14 Nov → Sun 15 Nov". Creation by voice is recorded the same way. The gateway design decides the mechanism; the Voice PA only has to pass "by voice" along with each change.
- **A two-step "propose, then commit"** for voice writes (§6.1). The gateway holds a proposed change, and commits it only when that exact proposal is confirmed.

Voice building starts once the gateway design is approved, so the hook it plugs into is known. It may run on a branch while the gateway itself is being built.

### 4.2 The stack
- **Claude stays the brain.** Today that is `claude-sonnet-5` in `src/app/api/assistant/chat/route.ts`. Claude's API is text only (rechecked 2026-11-13: no audio in or out), so LiveKit provides the live audio, speech-to-text and text-to-speech around it.
- LiveKit is newly approved. **Add it to the stack table in `docs/CONTEXT.md`** when this is built. No other new vendors without Nic's OK, apart from the speech-to-text and text-to-speech models LiveKit runs, which are chosen by testing (§8).
- Do not suggest OpenAI, Google or another voice AI as the brain. Nic decided against splitting the brain on 13 Nov.

### 4.3 Same rules as the form, enforced on the server (through the gateway)
- **Today most of the form's rules run on the person's phone or computer, not the server** (builder check, 13 Nov). `JobDetailShell.tsx` saves fields straight to the `jobs` table. The "can't empty a filled field" check, the design-brief check, the "keep the manually set design due date?" question, the crew clash pre-check (with "Alert scheduler & save" and "save anyway") and the To arrange proposed-date handling all run only in the browser. Only `/stage` and `/submit` are checked on the server, and `/submit` doesn't re-check the six required fields. **Decision 11 fixes this:** the gateway becomes the one place these rules live, and the form, the Voice PA and the phone app all call it.
- Every create, edit and stage move by voice goes through the gateway, so it gets the **same rules** the form uses (`src/lib/utils/job-form-rules.ts`, `job-stage-rules.ts`, `job-stage.ts`: required fields per button, who may move a job between which stages, which fields may not be emptied at each stage), plus the same database permissions (RLS).
- **The same side effects as the form, too.** A date change shifts the design due date and messages the designers, as the job PATCH route does today. The **questions the form asks on screen are asked out loud** instead: keep the manual design due date? a crew clash, so alert the scheduler and save, or save anyway?
- The PA acts with **the speaking person's own permissions**, never a broad service key. The existing assistant already works this way: role gate `CREATE_JOB_ROLES` in `src/lib/ai/tool-runner.ts`, with the user-scoped database client as the backstop. That must survive the move to a voice agent that runs outside Vercel (§6.2).
- A push to the schedule behaves exactly like the button. That means the same clash checks and the same "New Job — Assign Installer" Telegram to the schedulers as `src/app/api/jobs/[id]/submit/route.ts`. Quiet push stays admin-only, decided on the server.

### 4.4 App rules that apply
- Overlays sit above the bottom nav (`z-[60]` or higher; the 4 Sep overlay used `z-[75]`).
- Screen text in English and Mandarin (`en.ts` + `zh.ts`); Bengali falls back. Day and month names **on screen** are always English. **Spoken** replies follow the conversation's language, **dates included** (decision 13). In a Mandarin conversation the read-back says the date in Mandarin, while the job card on screen shows it in English.
- No new tables without grants (CLAUDE.md migration rules) if any table is added. Claim migration numbers at build time.

### 4.5 Cost
- Free plan: 1,000 voice minutes a month, up to 5 people talking at once, and US$2.50 of built-in speech credit (about 50 minutes). When a limit is hit it stops, with no bill.
- **That speech credit covers only about one day of real sales use** (5 people × 3 jobs × 3 min ≈ 45 min a day). Building and testing fit on the free plan. A real trial needs a card: either the speech services' own pay-as-you-go accounts, or the US$50 plan. **Nic is taking the budget to management (decision 12).** No real trial starts before that approval.
- Estimated running cost is about **US$0.15 per 3-minute conversation**, or **US$45–100 a month** for 5 salespeople making 3 voice jobs a day. Log usage like the existing assistant does (`api_usage_logs`) so real numbers are available.
- **The app enforces its own monthly ceiling**, an admin setting filled in once the budget is approved. At the ceiling, voice switches off until the 1st of next month, and the person is told plainly that they can still type to the assistant. The same message appears if LiveKit's own limits are hit.
- **Who gets the voice button is an admin setting by role.** The trial starts with sales and admin. Decision 4 (every role) applies once the budget allows it. This also keeps installers from using up the shared free-plan minutes during the trial.

## 5. Approaches considered

### Where it runs (Nic picked A)
| | Approach | Trade-off |
|---|---|---|
| **A ✓** | **In the webapp, in the phone's browser** | Fastest. The 4 Sep button, screen and brain carry over, and nothing needs installing. The screen must stay on with the app open (fine in a car phone holder); locking the phone or switching apps stops it. |
| B | Wait for the full phone app | Works with the screen off and alongside Waze, but voice waits behind the app plan's biggest stage. |
| C | A small voice-only Android app first | Screen-off sooner than B, but one more app to install and update, Android only at first, and work repeated later. |

### What does the listening and speaking (Nic picked LiveKit)
| | Approach | Trade-off |
|---|---|---|
| **✓** | **LiveKit + Claude** | Live audio with interruptions. Claude stays the brain, so the existing tools, memory and permissions carry over. The free plan covers testing. |
| ✗ | A voice-native AI (OpenAI or Google) as the brain | The most natural feel, but two AIs, and the assistant's tools and know-how rebuilt for the second one. Breaks the Claude-only rule. |
| ✗ | Keep the 4 Sep "sandwich" (browser speech) | Free, but it is what Nic tested and parked: choppy, mishears, robotic, and no interrupting. |

## 6. The design

### 6.1 What the salesperson experiences
- **Start:** the big glowing mic button from 4 Sep, on every page (hidden on `/login`). One tap opens the full-screen voice mode and connects. From then on it is hands-free.
- **Conversation:** they talk naturally. The PA replies out loud within about a second and **stops talking the moment they cut in**. The screen shows the live transcript and the PA's words, for the on-site case where a glance is possible.
- **Holding phrases:** when the PA needs a moment (looking up the schedule, saving), it says a short phrase such as "Let me check Thursday…" instead of going silent.
- **Missing details:** to put a job on the schedule it needs title, date, company, client, contact number and location (the same six as the button). It asks for whatever is missing, one or two at a time.
- **Read-back and confirm (decision 6):**
  - New job going on the schedule: it reads back all six required fields, plus the time if given, then asks for "confirm". Only an explicit yes saves. "No, the date is Saturday" corrects it and reads back again.
  - Edit to an existing job: it reads back **the job it means and only what changes, before → after**. For example: "Nex event for Emporium, moving the date from Sunday 15 to Saturday 14. Confirm?" When more than one job could match, it names the candidates and asks which one before reading anything back.
  - A **clash** found while pushing (crew double-booked, leave, away trip) is read out, and the person decides, as they would in the clash popup.
  - **A confirm only counts once the whole read-back has been heard.** If the person cuts in during the read-back, even with "yes", the PA re-reads it and asks again. A confirm that comes mid-read-back never saves.
  - **Enforced by the server, not just the prompt.** The read-back is a *proposal* held by the gateway (§4.1): exactly those values, for that person, for a short time. "Confirm" commits that exact proposal. A changed value is a new proposal with a new read-back, and an expired or mismatched proposal saves nothing.
- **Done:** it says what it did, and the screen shows a card for the job (tap to open). The schedulers get the same Telegram as a button push.
- **Signal drop:** the conversation so far is never lost. If the connection drops before "confirm", whatever was gathered is saved as the speaker's **private Draft**. A Draft is invisible to the office, so this is safe without a confirm. On reconnect, the PA picks up from there.
- **Mute** keeps the session open without listening (noisy sites). **X** ends it, and the conversation is saved like a normal assistant chat.

### 6.2 How it fits together
| Part | What it is | Notes |
|---|---|---|
| **Voice screen** (webapp) | The 4 Sep button and overlay, with the browser speech parts swapped for the **LiveKit web client** | Joins a LiveKit room using a token from our server. Keep the screen logic thin (§7). |
| **Token route** (our server, Vercel) | Checks the person is signed in, then issues a short-lived LiveKit room token and starts the agent for that person | The **same route** serves the future phone app. |
| **LiveKit Cloud** | Carries the live audio both ways and runs the voice agent | Free plan to start. |
| **Voice agent** | A LiveKit Agents worker: speech-to-text → **our brain** → text-to-speech, with turn-taking and interruption | Runs on LiveKit's hosting, not Vercel (Vercel can't hold a live audio session). |
| **Brain** | The existing assistant: Claude, its tools, memory and permissions | Gains the new edit and stage tools (§6.3). Must run **as the speaking person** (§4.3). |

**The one hard problem here is permissions.** Today the brain runs inside a Vercel request carrying the person's sign-in cookie. The voice agent runs on LiveKit's side, so it needs a safe way to act as that person, and only that person, for the length of the session. Whatever the builder chooses must:
1. Never give the agent standing access to everyone's data.
2. Expire with the session.
3. Leave the database permissions (RLS) as the final backstop, exactly as in the typed assistant.

### 6.3 What the brain gains
The typed assistant has one write action today, `create_pending_job` (private Draft only). Voice needs the same abilities as the form, behind the same rules:
- **Create a job** at any stage: Draft, Ongoing, or straight onto the schedule.
- **Move a job between stages**, in every direction the stage rules allow (for example Draft → Ongoing → Scheduled, Scheduled → back to Ongoing with its confirm-prompt consequences).
- **Edit fields** of an existing job the speaker may edit, at any stage.
- **Every write** must be preceded by the read-back and an explicit confirm in the conversation. It records "by voice" in the change history and stays within the speaker's permissions.

Whether the **typed** assistant also gets these new abilities is left open (§10). The rules and server checks should be written once and shared, so either way is cheap.

### 6.4 Languages
English and Mandarin follow the person's language setting, as on 4 Sep. The speech-to-text model must cope with **mixed English and Mandarin and Singlish**, plus local place names, mall names and client names. That is the main thing to test when choosing models (§8).

## 7. Built for the future phone app (decision 9)

The phone app plan (`2026-08-18-mobile-app-design.md`: React Native + Expo, Android first, then iPhone) is not built yet. This design must not make the voice work twice:
- **The agent, brain, tools, rules and token route are platform-neutral.** None of them may depend on anything browser-only. The phone app will reuse all of them unchanged.
- **The voice screen's logic** (connecting, states such as listening/thinking/speaking/muted, reconnecting, the job card) lives in a plain module apart from the web UI, so the app can rebuild only the screen. LiveKit has a React Native SDK that works with Expo.
- **Mobile-only wins arrive with the app:** screen-off and background use, sharing the car with Waze, headset and steering-wheel buttons, and a possible wake word. Don't build web workarounds for these.
- Keep the token route's response and the agent's job-card messages in a **stable format**, since two clients will depend on them.

## 8. Testing and proving it

- **Real speech, real phones.** Fixtures miss what real use finds (this project has been bitten by that before). The final check is Nic and a salesperson on their own phones, on site and in a car, in English, Mandarin and Singlish.
- **Pick the speech-to-text model by test:** run the same set of real recorded job descriptions, with local names and mixed language, through two or three LiveKit speech models, and compare how many details come out right. Text-to-speech is picked by ear and cost.
- **Safety checks:** nothing reaches the schedule or changes a job without a confirm; a person can't edit by voice what they can't edit in the form; every voice change appears in the change history as "by voice"; an unconfirmed job survives a dropped connection as a private Draft.
- **Timing:** the PA starts replying within about a second of the person finishing, and goes quiet immediately when interrupted.
- **Usage:** minutes and cost per conversation are logged, so the free-vs-US$50 decision can be made on real numbers.

## 9. Calls made in this document (not Nic's decisions; check these)

1. **No people changes by voice in v1.** This covers crew, designers, coordinators, handing a job to another person-in-charge, and suggesting installers. A misheard name would message the wrong person, and these stay quick on screen. Voice edits cover the job's own details and its stage.
2. **No deleting jobs by voice in v1.** Delete is rare and easy to do on screen. Moving a job back to Drafts by voice stays possible, since that is a stage move.
3. **An unconfirmed job is auto-saved as a private Draft** if the connection drops. Nothing reaches the office without a confirm.
4. **A confirm counts only after the full read-back, and the server enforces it** with propose-then-commit (§6.1). This is slower by a sentence when someone interrupts, but safer.
5. **Voice may use a faster Claude setup than the typed assistant**, for example a quicker Claude model, lower thinking effort, or skipping the past-chat lookup, chosen by test to reach the one-second reply. The bar is that read-backs stay accurate. The brain stays Claude.
6. **The trial starts with sales and admin only**, through a role setting (§4.5). At the monthly ceiling, voice switches off with a plain message and typing still works.
7. **The September code is ported, not merged.** `feat-voice-pa` is 397 commits behind `dev`. Its button, overlay, state machine and voice-language mapping are worth carrying over; its browser speech parts are replaced.
8. **The voice agent is written in TypeScript**, to match the rest of the repo (LiveKit Agents supports it).

## 10. Left to the builder

- How the agent acts as the speaking person (§6.2), within the three rules given there.
- Exact speech-to-text and text-to-speech models (by test, §8), and whether to use LiveKit's built-in speech credit or the services' own accounts.
- The tool shapes for create, edit and stage move, and whether the typed assistant gets them too.
- Prompt wording for voice style, read-backs and holding phrases. Keep the assistant's cached system prefix byte-stable, as the existing route already does.
- Where the agent's code lives in the repo and how it is deployed to LiveKit.

## 11. Build order

1. **Job gateway**: one set of job rules on the server, the form moved onto it, and the change history recording who, when, what and how. It needs its own design and approval first. It is the riskiest piece because it touches the live job form, so it gets the most careful testing.
2. **This Voice PA**, tested on the `dev` preview by Nic and at least one salesperson, then live once management has approved the budget.
3. **Phone app** (the August plan, refreshed in its own design), which inherits the gateway and the Voice PA.
