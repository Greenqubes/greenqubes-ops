# Installer Team box, installer All Jobs, side-panel address + description — design

**Status:** awaiting Nic's approval (brainstormed 2026-11-06 → 2026-11-10)
**Mockups:** https://claude.ai/artifact/SjLNY7seFRXahG7AXd13JD (private to Nic; sections 1–3 match the three parts below)

Three independent changes, asked for together. Each can ship on its own; suggested order is 3 → 1 → 2 (smallest first, and 2 reuses the Team box from 1).

---

## Why

- **Installers** say they can't see who is on a job the way the office can. Their job card shows no crew names at all. The big "Now" card has a crew line, but it can only ever show the installer themself: the privacy rule on crew rows (migration 0037, "assignees: installer sees own rows") lets an installer read **only their own** crew row, so their co-workers never reach the installer screen. (An admin using "view as installer" reads every row, which is why this never showed up in testing — **test Parts 1 and 2 with a real installer account.**)
- **Installers** also want to see the rest of the company's work that day, so a last-minute move by the scheduler doesn't catch them out ("see what other jobs is there in the company in case last minute scheduler pick them" — Nic).
- **The scheduler** says the side panel (My Jobs panel) "affects his job arranging visibility heavily" because it has no address. **Nic, as sales,** wants the job description there too — without the panel getting bulky.

## Anti-goals (would make this a failure even if it works)

- An installer seeing **anything commercial or private** on a job they are not on: price/quote, client phone, client contact person, files, chat, the sales or coordinator names, the description.
- An installer seeing **suggested** crew (internal or external) anywhere. Suggestions are office-only and must never surface to installers — the same rule as today.
- An installer seeing a **pending** job (sales-private, migration 0062) or any job not yet confirmed.
- An outside contractor's **private link** (the `token` on `external_contacts`) or **phone** reaching an installer's browser.
- The side panel becoming visibly heavier than today. The job title must stay the thing your eye lands on.

---

## Part 1 — Installer job card: Team box (Nic picked mockup option B)

**Where:** the installer's own job cards — `src/features/installer/InstallerJobCard.tsx` (the list cards on `/installer`) and `src/features/installer/NowCard.tsx` (the big "Now" card, which today shows crew as plain comma text).

**Card shape stays the installer's** (phone-friendly, not the office card). Top to bottom:

1. Date and time (left) and status pill (right). **Keep the date** — the card also appears on the "Up next" and "This week" tabs, which span several days. *(My call; the mockup left it off.)*
2. Title, then the client line under it, as today. *(My call; kept from today's card.)*
3. Description (as today).
4. **Full address** — no longer cut off to one line; let it wrap.
5. **Team box** — a light inset box with up to three labelled rows, each a row of name pills:
   - **Driver** — bigger pills, green (driver colour).
   - **Support Crew** — bigger pills, neutral.
   - **External** — bigger pills, dashed outline. Label is exactly "External" (Nic, 2026-11-07), matching the office card's word.
6. Footer unchanged: sales person's name + "Call sales".

Rules:
- **Whole names**, never first names (same as the office card).
- Driver vs Support Crew comes from `splitCrew` (`src/lib/utils/job-card.ts`) — per-row `is_sub_installer`. It already skips suggestions.
- **A row only appears when it has names.** Support Crew and External rows are simply left out when empty. *(My call.)*
- **"No driver yet" rule — the same as the scheduler's driver board** (`primaryBand` in `src/lib/utils/driver-board.ts` → Unassigned): a job is "No driver yet" when it has **no driver and no External**. A support-crew-only job counts as no driver; a contractor-only job does **not** (the contractor is the crew). When it applies, the Driver row shows "No driver yet" in muted italic. Use one shared pure function for this so Parts 1 and 2 and the driver board can never disagree. *(My call — installers and scheduler see the same answer.)*
- **External = confirmed outside contractors only** (`job_external_contacts.is_suggestion = false`), **name only** — no phone.
- On the Now card, the Team box **replaces** the plain-text crew line.
- Office cards (`JobRow.tsx`) do not change.

**Getting crew and External names to installers.** Two privacy rules stand in the way, and **both stay as they are**:
- Crew rows (`job_assignees`): an installer reads only their own row (0037), so co-workers are invisible.
- Outside contractors (`external_contacts` / `job_external_contacts`): no installer access at all (0039/0040), and `external_contacts` holds each contractor's private link token.

So: `getInstallerJobs()` (`src/lib/supabase/queries/installer.ts`, runs on the server for the server-rendered `/installer` page) keeps its normal signed-in query — RLS still decides **which jobs** the installer gets (their own formally-assigned ones) — then uses the **service-key client** (`src/lib/supabase/service.ts`) to fetch, for **only those job ids**:
- the confirmed crew: `job_assignees(is_suggestion, is_sub_installer, users(id, name))`, suggestions dropped;
- the confirmed externals: `job_external_contacts(is_suggestion, external_contacts(name))`, suggestions dropped;

and puts them on each job as plain names (drivers / support / externals). Only names leave the server — never phone numbers, tokens or suggestion rows. **No migration, no new policy.** Share this "crew names for these job ids" read with Part 2.

**Not changing:** the job page an installer opens from the card (`/jobs/{id}?from=installer`) keeps showing what it shows today. Widening the crew-row rule would change that page and live updates too, and wasn't asked for. *(My call — easy to add later as its own change.)*

## Part 2 — Installer "All Jobs"

**Entry point:** a third choice in the switch at the top of the installer's screen: **My Jobs | All Jobs | Completed** (Nic, 2026-11-10: "sit on top will do"). That switch is `src/components/CompletedSwitch.tsx`, shared by every role — only the **installer** gets the third segment; other roles' switch is unchanged.

**Purpose:** look-only awareness of the company's confirmed work for a day.

**Page:** a new installer-only page (suggested `/installer/all`, day in the URL e.g. `?day=2026-11-10`; route name is the builder's call). Non-installers who land on it are sent to `/schedule`, the same way `/installer` does it (`getEffectiveRole`, so an admin previewing as installer can see it).

**Layout** (mockup section 2):
- The switch at the top, All Jobs lit.
- A **day strip** to pick the day. Default **today**. Any day can be picked; in practice it's mostly today and tomorrow (Nic agreed). Strip size and how to move it (arrows / swipe / a week at a time) is the builder's call — keep it simple and thumb-friendly.
- Day heading with a job count ("Friday 6 Nov · 4 jobs").
- One card per job, ordered by start time (all-day / no-time jobs last, or first — builder's call, be consistent with My Jobs):
  - Time.
  - Title (fall back to client name when the title is empty, as other screens do).
  - Full address (wrapping, pin icon).
  - Crew pills: driver(s) green, support crew neutral, External dashed. **The installer's own name is a black pill.** Same Team-box component as Part 1, or a compact inline version of it — builder's call, but it must read the same.
  - Jobs that are **"No driver yet"** (same rule as Part 1: no driver and no External) are clearly marked — these are the jobs they are most likely to be pulled into.
- **The installer's own jobs** are outlined and tagged **"You're on this"**, and tapping one opens it exactly as My Jobs does (`/jobs/{id}?from=installer`).
- **Everyone else's jobs are look-only.** Tapping does nothing. No join / claim / request button. Moving people stays the scheduler's call, and the existing Telegram assignment message still tells them when it happens.

**Which jobs appear:** `status = 'scheduled'` jobs whose date range covers the chosen day (`date <= day <= coalesce(date_end, date)`, so a multi-day job shows on each day it runs). That excludes pending (sales-private), awaiting approval, awaiting date and completed jobs — including jobs completed earlier that same day (Nic agreed). Binned jobs are already gone from `jobs` (migration 0063), so nothing extra is needed for them.

**What an installer may see on another job — the whole list:** time, date range, title (or client name as the fallback), full address, punctuality colour if the card already uses it, confirmed crew names (driver / support / external). **Nothing else** — specifically not: description, price/quote fields, client phone, client contact person, sales name, coordinator name, files, chat, tasks, DO, status details.

**How the data is read (security):** installers' RLS deliberately blocks other people's jobs, and that block stays as it is for every other screen. The All Jobs page reads on the **server** with the **service-key client**, after confirming the caller's effective role is installer, and selects **only the fields listed above** (never `*`), dropping suggested assignees and suggested externals before anything is sent to the browser. **No new RLS policy and no migration** — the narrow server read is the whole access change. The installer's own user id is compared against the assignees on the server to set the "You're on this" flag.

**Live updates:** refresh the same way My Jobs does today. Instant updates only fire for rows the installer may read (their own jobs), so changes to **other people's** jobs show up on the existing background refresh (about every 2 minutes). That is fine for awareness; no new live mechanism. *(My call.)*

**Translations:** new UI words ("All Jobs", "You're on this", "No driver yet", "External", day-strip labels if any) get English + Chinese; **Bengali gets the English text** (standing rule, no new Bengali translations). Day and month names stay English in every language (hard rule).

## Part 3 — Side panel: address + description (Nic picked mockup option A)

**Where:** `src/features/schedule/MyJobsPanel.tsx`, every list in it, every role that has the panel, and its search results.

**Row today:** date · title (up to 2 lines, then "…", Nic 2026-10-26 — keep that) · client.

**Row after:**
1. **Date · client** on one line (client moves up beside the date to make room).
2. Title — unchanged, up to 2 lines.
3. **Address** — one line, pin icon, small, ink-grey; "…" when too long.
4. **Description** — one line, small lines icon, lighter grey than the address; "…" when too long.

Rules:
- Net growth: one line per job. Both new lines are the same small size as the current client line so the title still dominates.
- A job with **no description** leaves that line out; same for an empty address. *(My call.)*
- On a computer, hovering a cut-off line shows the full text (a plain `title` tooltip is enough). *(My call.)*
- Data: add `description` to `getStageJobs()`'s select in `src/lib/supabase/queries/jobs.ts` and to the `StageJob` type. `location` is already loaded. No migration.
- Search behaviour does not change (it already matches on location; adding description to search is **not** asked for).
- Icons are stroke-only SVG, no emoji (standing rule).

---

## Constraints / standing rules that apply

- **No migration** is expected for any part. If the builder finds one is needed after all, claim the number per CLAUDE.md first (`npx -y supabase@2 migration list` + every branch), and any new `public` table gets the authenticated + service_role grants (never `anon`).
- Overlays (if any are added) sit above the bottom nav (`z-[60]`+).
- dev first; Vercel preview; Nic checks; "push to main" only on his words.
- Changelog line at merge time (session-end rule), reader's side, short.

## Decided by Nic

- Installer card: option B (installer's own card shape + Team box with bigger pills), not the office card.
- External contractors get their own row, labelled **External**, below Support Crew.
- All Jobs: purpose is last-minute awareness; look-only; confirmed jobs only; "No driver yet" jobs shown; work not money (field list above); any day, mostly today/tomorrow; button sits in the top switch.
- Side panel: option A — both address and description, for everyone, one line each, client moved beside the date.

## My calls (Nic to check while reading)

- Crew and External names reach installers through a narrow server read; the privacy rules stay unchanged.
- The installer's job page (opened from the card) is not changed.
- "No driver yet" = no driver and no External, the same as the scheduler's driver board.
- The installer card keeps its date and client lines.
- On All Jobs, other people's changes can take up to about 2 minutes to show.
- Side panel: empty address/description lines are left out; hovering a cut-off line on a computer shows the full text.
- Empty Support Crew / External rows are left out of the Team box.

## Left to the builder

- Route name and URL shape for All Jobs; day-strip mechanics.
- Whether All Jobs reuses the Part 1 Team box as-is or a compact inline version (must read the same).
- Sorting of no-time jobs (match My Jobs).
- Component split and tests. Worth unit-testing: the pure "what goes on an All Jobs card" shaping (suggestions dropped, own-job flag, field allow-list) and the day-range filter.
