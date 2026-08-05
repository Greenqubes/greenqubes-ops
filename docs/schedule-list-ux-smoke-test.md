# Schedule List View — Scrolling UX Smoke Test

> Tick each box as you go. If something fails, note what you saw next to it and tell Claude.
> This build = the **new date strip** (week ↔ month), the **jump calendar**, the **Today button**,
> **Monday-start weeks everywhere**, filter chips removed, and a tighter page.
> Test on **both desktop and phone** — this feature was built for both.

## Before you start

- [X] Claude has pushed `dev` and Vercel finished building the **dev preview** (dashboard →
      greenqubes-ops → Deployments → latest `dev`). No database migrations this time — display
      and navigation only.
- [X] Sign in normally (any office role — Scheduler is easiest) and open the **Schedule** tab.

---

## Section 1 — The strip, first look

- [X] The page opens on **today**: heading shows today's date, today's pill is dark/selected.
- [X] The strip shows **one week, Monday to Sunday**, 7 pills filling the row edge to edge.
- [X] The old **All / Today / This week / Upcoming chips are gone** — only List / Week / Month
      remains in that row, and the whole top of the page sits noticeably tighter than before.
- [X] Days with jobs show their little **red (strict) / blue (flexible) dots**; a past day with an
      unfinished job shows the **red overdue tint** (page back to find one if needed).
- [X] Tap another day → it selects, the heading follows, the jobs below change.

## Section 2 — Week ↔ month toggle

- [X] The **icon button** at the right end of the strip shows a small **month grid**. Tap it →
      the strip becomes the **whole month**, scrollable, with your selected day **auto-centred**.
- [X] The icon now shows a **single row** — tap again → back to the 7-day week.
- [X] Desktop: hover the icon → tooltip says **"Show full month" / "Show one week"**.
- [X] Switch to month mode, then **reload the page** → still month mode (choice is remembered),
      and **no red error appears in the browser console** (F12 → Console).

## Section 3 — Getting around

- [X] The **‹ › at the ends of the strip** page a whole week (or month) — but your **selected day
      and heading don't change**. Tap any day in the new window to actually move. 
- [ ] **RETEST (your feedback):** the **‹ › beside the heading** now stay **fixed in place** —
      the heading box has a set width, so clicking through days repeatedly never moves the
      arrows under your cursor (check the Week/Month tabs too — wider box for month names).
- [x] **Tap the heading** (it has a small ▾ now) → the **jump calendar** pops up: Mon-first grid,
      dots on days that have jobs, today outlined in terracotta.
- [ ] Its ‹ › flip months — go **back two months and forward three**; pick a day → the page jumps
      there and the pop-up closes.
- [ ] **RETEST (your feedback):** a small **month label now sits above the strip** and follows the
      window you're peeking at with the strip's ‹ › — in both week and month modes, without
      clicking any date. A week straddling two months reads like **"Aug – Sep 2026"**.
- [x] The pop-up also closes on **tapping outside** and on **Esc** (desktop).
- [ ] **RETEST (your feedback):** wander off today → the **amber Today button** now appears on the
      **left, right after the heading's › arrow** (not by the search icon); tap → back to today
      and it disappears.
- [x] In the **Week and Month tabs** the heading is plain (no ▾, no pop-up, no Today button) 
      that's intended for now.

## Section 4 — Monday-start, everywhere

- [x] **Week tab**: the listed days run **Mon → Sun**.
- [x] **Month tab**: columns are headed **Mon Tue Wed Thu Fri Sat Sun** and the 1st of the month
      sits in the correct column.
- [X] **Installer page** (preview-as Installer, or the test installer login): its week and month
      views also start Monday.
- [x] **Pending** and **Completed** pages show the same new strip + navigation (Completed is where
      the month mode really pays off).

## Section 5 — Languages

- [x] Switch UI language to **中文**: day/month names on the strip, heading, jump calendar stay
      **English**; the toggle tooltip is Chinese.
- [x] Switch to **Bengali**: the new bits show **English** (that's the new rule — no new Bengali
      translations).
- [x] Switch back to English.

## Section 6 — Desktop feel

- [x] **No tiny scrollbar** under the strip or the List/Week/Month row anymore.
- [x] In month mode, **hover the strip and roll the mouse wheel** → it slides sideways.

## Section 7 — Phone feel

- [x] Week mode: 7 pills fit the screen width, comfortable to tap.
- [x] Month mode: the strip **swipes** left/right with your thumb.
- [x] The jump calendar opens fully visible and **nothing interactive hides behind the bottom
      nav**.

---

**When done:** tell Claude pass/fail per section (just "S1 ok, S3 item 4 failed: …" is enough).
