---
session: ux-schedule (date strip months, Drivers Today, bigger arrows, Schedule | Completed switch, customer database parked)
date: 2026-10-27
branch: dev → main
migrations: none
release: 76cdb47 live 18:07 SGT (all three feature commits shipped together); changelog 34a8d01
status: LIVE — each change checked by Nic on the dev preview before main
---

# Date strip months, Drivers Today, bigger arrows, Schedule | Completed switch

Session start ran in full (checklist walked, latest note read). Nic skipped the AI-importance question. Bryan was skipped per CLAUDE.md. The same conversation carried on to 2026-10-30; that day is in [feat-jobs-20261030-1-note.md](../feat/feat-jobs-20261030-1-note.md).

## 1 — Date strip months + Drivers Today (`e38ced3`)

From Nic's annotated screenshot of the date strip ("this").

- The strip shows the **month before and after** the window, bold, above its ‹ › arrows; short names on a phone, because three full names don't fit side by side. A tap flips the strip to that month, like the arrow does. The centre month label is bold.
- The **Drivers view** gets the amber Today button when another day is on screen.
- "3 Jobs Today" / "Nothing Today" reads **"On This Day"** on any other date.
- **Bug found on the way:** the heading's back/forward arrows did nothing on the Drivers view, because `goBack`/`goForward` had no `'board'` case. They now move one day, like List.
- New pure module `src/features/schedule/date-strip-nav.ts`. Its test was watched failing against the old behaviour first (20 of 21 failed).

## 2 — Bigger, bolder arrows (`a8a17ab`)

> "make the arrow buttons bigger and bolder too its kind small"

Both chevron pairs (heading + date strip) go from 15–16px muted to 22px, stroke 2.75, in `text-ink2`. The heading pair gains Previous / Next labels for screen readers.

## 3 — Completed tab → Schedule | Completed switch, every role (`76cdb47`)

> "merge completed job tab into schedule tab, with a toggle button" · "basically standardize this view to all roles" · "its more like a webpage update instead of per role only update"

- Three mockups were shown in the visual companion. Nic first asked for a mockup, then said localhost might not work while he was remote, then "A. im back on pc". He picked **A: the switch at the top centre**, replacing the "Company schedule" caption, styled like the Jobs tab's Ongoing | Drafts switch.
- `src/components/CompletedSwitch.tsx` is **two links, not a client-side toggle**. `/completed` stays its own page, so the schedule never loads every completed job, the back button returns to the side you were on, and old links still land.
- `liveHrefFor(role)` in `src/lib/utils/completed-switch.ts` picks the left side: installers get **My Jobs | Completed** on `/installer`. Nic: "yes installer move completed onto my jobs too. give hr / finance this view as well its fine." HR / Finance RLS already reads completed jobs.
- Completed leaves every role's bottom bar and phone drawer. `navTabActive` keeps Schedule / My Jobs lit on `/completed`.
- Tour: the Completed step now points at the switch, with no drawer needed. The installer week/month arrows match the bigger schedule arrows. zh gains a "Completed" label (it was falling back to English).
- New rule test `completed-switch.test.ts`, watched failing first (10 checks). 65 suites green; type-check and build clean.

## 4 — Customer database: brainstormed, PARKED

Nic's screenshot of the job form: "We can have a customer tab which sales can also see edit, input new client as well as client address (for future quotation purposes)" · "Link Client Name to Client Contact Number Possible?"

- Then: "i dont need quotation for now. i just need to create a customer database to keep client information."
- He keeps customers in another program (1,431 companies; company page with address, terms, contacts with mobile numbers). His thinking moved from an editable Customers tab, to "route our system into my existing system database", to "cross refer to it", to "distill their whole website out".
- **Recommended:** that program's **Export** button, then load the file into Ops, rather than scraping the site.
- **Blocker:** "nvm export is out of order now. i will do this again next time."
- Nothing built and no migration number claimed. The open question when it resumes is which system stays the master: the old program, with Ops reading a copy, or Ops becoming the home after a one-time import.
- The smaller ask that came out of it, auto-filling the client's contact number from past jobs, was agreed that day and built on 2026-10-30.

## 5 — Release

- Nic: "push the others builds to main first. with whats new included". main fast-forwarded to `76cdb47`, live **18:07 SGT**, timed from production's `x-vercel-id`.
- What's new 2026-10-27 (`34a8d01`):
  - **headsUp:** the Completed tab is gone; use the switch.
  - **added:** a Today button on the Drivers view.
  - **improved:** the date strip months; "On This Day"; bigger arrows.
  - **fixed:** the Drivers view arrows.
- Both pushes went through in one turn because Nic named What's new in the go (memory `feedback_prod_push_explicit`).

## Next

- Live checks with real logins (installer, HR / Finance): see the checklist.
- Customer database: resume once the old program's Export works.
