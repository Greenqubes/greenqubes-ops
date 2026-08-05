# New / Edit Job Page — Tabs + Two-Column Reorganisation

**Date:** 2026-08-05
**Status:** Approved by Nic (pending spec review)
**Session:** ux-jobs (job form UX reorganisation)

---

## Problem

The New job and Edit job pages are the longest pages in the app, and they don't match
each other. Nic confirmed (2026-08-05) the two pains that matter:

1. **Too long, too much scrolling** — the edit page is one giant scroll: job details →
   production → team/installers → attachments → task list → chat → notifications
   placeholder. The two most-visited parts are **core details** (top) and **chat**
   (very bottom), so a normal working visit means scrolling past everything.
2. **New vs Edit inconsistency** — the two pages disagree: production instructions
   lives in the Team card on New but in the Production card on Edit; Edit has a sticky
   bottom action bar while New's buttons sit inline at the end of the page.

Device usage is roughly half phone, half desktop — both layouts matter equally.

## Decisions made during brainstorming

- **Tabs chosen for phone** (option B, "cleaner the better") — over a one-page sticky
  jump bar (A) and collapsible accordion cards (C).
- **Four tabs**: Details / Team / Files / Chat — over five (a separate Production tab
  was rejected: squeezed labels on narrow phones).
- **New job gets the same four tabs**, with Files and Chat greyed out + lock until the
  job is saved (most consistent option).
- **PC gets a two-column view instead of tabs** (Nic's vision): left column = Details
  then Team; right column = Files then Chat. Same content, same order, no tabs.
- **All PC cards are collapsible except Job Chat** — chevron in each card header folds
  the card to its title bar; chat has no chevron and is always open.
- Defaults: everything starts expanded; collapse choices are remembered per device
  (localStorage, same pattern as the schedule strip's week/month toggle).
- **Notifications placeholder** (future Telegram notification tracker) lives at the
  bottom of the Team tab / left column. The tracker itself is future work and is
  recorded in the checklist's future planning notes.

---

## Design

### 1. One responsive shell, two presentations

The page content is grouped into four section groups, used by both layouts:

| Group | Contents (top to bottom) |
|---|---|
| **Details** | Job details card (title, date + day, company, contact, phone, location, description, times, punctuality, production-ready / DO ticks) → Production card (instructions, production photos, signed DO, completion photos) |
| **Team** | Person-in-Charge, Sub POC / Coordinators, Notes → Installers grid → Sub-installers bucket → External installers bucket → Notifications placeholder card |
| **Files** | Attachment buckets → Task list |
| **Chat** | Job chat, filling the available space |

**Phone / narrow windows (below `lg`, 1024px):** a sticky tab bar (Details | Team |
Files | Chat) sits under the page heading. One group visible at a time.

**PC / wide windows (`lg` and up):** no tab bar. Two columns — left: Details group
then Team group; right: Files group then Chat. The container widens from today's
`max-w-2xl` to `max-w-6xl` so the columns get real space.

All four groups are **always mounted** — the phone tabs show/hide with CSS, never
unmount. This is what makes tab-switching lossless (form state, chat realtime
subscription, upload progress all survive) and makes the phone ↔ PC breakpoint
transition seamless.

### 2. Tab behaviour (phone)

- Default tab: **Details**.
- Switching tabs never loses typing — one form spans all tabs; the action bar's Save
  saves everything regardless of which tab is active.
- The sticky bottom action bar is visible on every tab, unchanged in behaviour.
- **Deep link:** `?tab=chat` opens the page on the Chat tab. The job-chat Telegram
  notification's "View in app →" URL gains `?tab=chat` so it lands on chat directly.
  (This is the only notification touchpoint — a URL tweak, no template or send-logic
  changes.) On PC the parameter is simply ignored — chat is always visible there.
- Tab bar is part of the page flow (sticky under the header) — it is not an overlay,
  so the overlay-above-BottomNav hard rule is not in play (job pages have no BottomNav).

### 3. Collapsible cards (PC only)

- Every card in both columns gets a chevron in its header that folds it to just the
  title bar — except **Job Chat**, which has no chevron and never collapses.
- All cards start expanded. Collapse state is remembered per device in localStorage
  (e.g. `gq-job-collapse`), read **after mount only** (hydration-safe — same rule the
  schedule strip toggle follows; /schedule hydration error #418 history makes this
  non-negotiable).
- On phone, cards inside tabs do **not** get collapse chevrons (tabs already keep pages
  short). The Sub-installers and External installers buckets keep their existing
  built-in expand/collapse on both layouts.
- Chat card on PC: capped height with internal message scroll so the message input is
  always visible; collapsing cards above it lets it stretch.

### 4. New job page — same shell, locked tabs

- Same four tabs (phone) / two columns (PC) as Edit.
- **Files and Chat are locked until the job is saved**: on phone the two tabs are
  greyed with a small lock icon and don't switch; on PC the two right-column cards
  show their existing locked placeholder content. (Attachments, task list, and chat
  all require a saved job — this is today's behaviour, presented consistently.)
- **Production instructions moves** out of the Team card into the Production card in
  the Details group — same position as Edit. Pre-save it is the instructions textarea
  only; the photo/DO upload areas appear once the job exists (as today).
- **The action bar becomes sticky** at the bottom, identical styling to Edit
  (Cancel / Save as pending / Push to Schedule).

### 5. Roles — behaviour unchanged

Who can see and edit what does not change at all: designer view-only; production only
its own fields; sales suggests installers (yellow) and cannot un-assign; scheduler /
coordinator / admin formally assign; installer gets the read-only view + chat. The
installer's view uses the same tabs / columns with its existing simplified content.
Role-specific action bars are untouched.

### 6. Out of scope

- **No database or API changes.** No migrations.
- **No notification changes** beyond the `?tab=chat` URL suffix on the chat batch link.
- Clash checks, suggest/assign flow, attachment buckets, task list, and chat logic all
  untouched — this is purely a re-layout of existing pieces.
- Chat's internal redesign remains a separate future session (existing decision).
- The Telegram notification tracker stays a placeholder; building it is future work
  (now recorded in the checklist's future planning notes).

---

## Files expected to change

| File | Change |
|---|---|
| `src/features/job-detail/JobDetailShell.tsx` | Wrap sections in the new tabs/columns layout; no logic changes |
| `src/features/job-detail/NewJobShell.tsx` | Same layout; production instructions moves to Details group; sticky action bar |
| `src/features/job-detail/` (new) | Small layout component(s): tab bar + responsive group container + collapsible card header |
| `src/lib/telegram/templates.ts` (or caller) | `?tab=chat` on the chat batch "View in app" URL |
| `src/lib/i18n/{en,zh}.ts` | Tab labels + any new small strings (no new Bengali — bn falls back to English per the 2026-08-03 rule) |
| `docs/nic-checklist.md` | Telegram notification tracker added to future planning notes |

Component boundaries follow the existing one-concept-per-file convention; the shells
stay orchestrators, sections stay as they are.

## Testing

Smoke test on the Vercel preview (desktop + phone), per project convention:

1. Phone: four tabs render; switching preserves typed-but-unsaved edits; Save from a
   different tab saves everything; Chat tab fills the screen; action bar on every tab.
2. Phone New job: Files/Chat greyed + locked pre-save; unlock flow works after save.
3. PC: two columns at `lg`+; every card collapses except chat; collapse choices
   persist per device across reloads; chat input always visible.
4. Telegram chat notification link lands on the Chat tab.
5. Role pass: sales / scheduler / coordinator / designer / production / installer each
   see their existing permissions unchanged in the new layout.
6. Console clean on reload (hydration #418 guard — localStorage reads after mount only).
