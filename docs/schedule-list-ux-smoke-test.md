# Schedule List View — Scrolling UX Smoke Test

> Tick each box as you go. If something fails, note what you saw next to it and tell Claude.
> This build = the **new date strip** (week ↔ month), the **jump calendar**, the **Today button**,
> **Monday-start weeks everywhere**, filter chips removed, and a tighter page.
> Test on **both desktop and phone** — this feature was built for both.

## Before you start

- [ ] Claude has pushed `dev` and Vercel finished building the **dev preview** (dashboard →
      greenqubes-ops → Deployments → latest `dev`). No database migrations this time — display
      and navigation only.
- [ ] Sign in normally (any office role — Scheduler is easiest) and open the **Schedule** tab.

---

## Section 1 — The strip, first look

- [ ] The page opens on **today**: heading shows today's date, today's pill is dark/selected.
- [ ] The strip shows **one week, Monday to Sunday**, 7 pills filling the row edge to edge.
- [ ] The old **All / Today / This week / Upcoming chips are gone** — only List / Week / Month
      remains in that row, and the whole top of the page sits noticeably tighter than before.
- [ ] Days with jobs show their little **red (strict) / blue (flexible) dots**; a past day with an
      unfinished job shows the **red overdue tint** (page back to find one if needed).
- [ ] Tap another day → it selects, the heading follows, the jobs below change.

## Section 2 — Week ↔ month toggle

- [ ] The **icon button** at the right end of the strip shows a small **month grid**. Tap it →
      the strip becomes the **whole month**, scrollable, with your selected day **auto-centred**.
- [ ] The icon now shows a **single row** — tap again → back to the 7-day week.
- [ ] Desktop: hover the icon → tooltip says **"Show full month" / "Show one week"**.
- [ ] Switch to month mode, then **reload the page** → still month mode (choice is remembered),
      and **no red error appears in the browser console** (F12 → Console).

## Section 3 — Getting around

- [ ] The **‹ › at the ends of the strip** page a whole week (or month) — but your **selected day
      and heading don't change**. Tap any day in the new window to actually move.
- [ ] The **‹ › beside the heading** still step one day at a time; the strip follows along,
      including across a month boundary.
- [ ] **Tap the heading** (it has a small ▾ now) → the **jump calendar** pops up: Mon-first grid,
      dots on days that have jobs, today outlined in terracotta.
- [ ] Its ‹ › flip months — go **back two months and forward three**; pick a day → the page jumps
      there and the pop-up closes.
- [ ] The pop-up also closes on **tapping outside** and on **Esc** (desktop).
- [ ] Wander off today → the **amber Today button** appears near the search icon; tap → back to
      today and the button disappears.
- [ ] In the **Week and Month tabs** the heading is plain (no ▾, no pop-up, no Today button) —
      that's intended for now.

## Section 4 — Monday-start, everywhere

- [ ] **Week tab**: the listed days run **Mon → Sun**.
- [ ] **Month tab**: columns are headed **Mon Tue Wed Thu Fri Sat Sun** and the 1st of the month
      sits in the correct column.
- [ ] **Installer page** (preview-as Installer, or the test installer login): its week and month
      views also start Monday.
- [ ] **Pending** and **Completed** pages show the same new strip + navigation (Completed is where
      the month mode really pays off).

## Section 5 — Languages

- [ ] Switch UI language to **中文**: day/month names on the strip, heading, jump calendar stay
      **English**; the toggle tooltip is Chinese.
- [ ] Switch to **Bengali**: the new bits show **English** (that's the new rule — no new Bengali
      translations).
- [ ] Switch back to English.

## Section 6 — Desktop feel

- [ ] **No tiny scrollbar** under the strip or the List/Week/Month row anymore.
- [ ] In month mode, **hover the strip and roll the mouse wheel** → it slides sideways.

## Section 7 — Phone feel

- [ ] Week mode: 7 pills fit the screen width, comfortable to tap.
- [ ] Month mode: the strip **swipes** left/right with your thumb.
- [ ] The jump calendar opens fully visible and **nothing interactive hides behind the bottom
      nav**.

---

**When done:** tell Claude pass/fail per section (just "S1 ok, S3 item 4 failed: …" is enough).
