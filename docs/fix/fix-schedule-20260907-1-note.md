---
session: fix-schedule (mobile viewport — sideways scroll + drawers cut off by the URL bar)
date: 2026-09-04 → 2026-09-07
branch: dev (built inline per Nic's standing rule; merged dev → main `5f64bc9` on 2026-09-07, LIVE on production)
---

# Mobile viewport — two bugs behind three symptoms

> Nic, from his phone: "can u fix the mobile webview? because now i can
> scroll sideways and i open the side menu bar i have to scroll down to see
> accounts. this is weirdly wrong. and also i can now zoom out?"
>
> Three symptoms, **two** root causes. The zoom-out was a symptom of the
> first one, not a third bug and not a setting that had been changed.

## 1 — Sideways scroll (and the zoom-out)

**Root cause:** `JobRow`'s card link is `<Link className="flex-1 block group">`
— `flex-1` with **no `min-w-0`**. A flex item's automatic minimum size is its
*content*, so the item refuses to shrink below a `truncate` (nowrap) child.
The long job title inflated the card, the card inflated the row, and the row
inflated the document past the phone screen.

**The trap worth remembering:** `truncate` is inert until **every** flex
ancestor between the text and the page carries `min-w-0`. JobRow's inner
column (`flex-1 min-w-0`) already had it — the Link one level up did not, so
the guard was defeated from outside.

**Measured, not guessed.** Copied the built stylesheet out of
`.next/static/css/*.css`, pasted the real JobRow markup into a scratch file
and measured in headless Chrome:

| | before | after |
|---|---|---|
| `documentElement.scrollWidth` | **510px** (in a 500px viewport) | **500px** |
| long-title card | 494px | 468px |
| short-title card (control) | 468px | 468px |

The control card was already correct, which is what pinned the cause to the
title rather than to padding, the punctuality bar or the team row.

**Why the zoom-out needed no fix.** The app has never disabled pinch-zoom:
there is no `viewport` export anywhere in `src/`, and production serves
Next's default `<meta name="viewport" content="width=device-width,
initial-scale=1">` (confirmed by probing the live login page). Chrome only
lets you zoom out past "fits the screen" while content actually overflows —
so removing the overflow restores the snap-back on its own. `user-scalable=no`
was explicitly **rejected**: it would hide this entire bug class from future
reports and is an accessibility regression.

## 2 — Drawers cut off by the address bar

**Root cause:** `NavDrawer` and `NotificationDrawer` were both
`fixed … h-full`. A fixed element's percentage height resolves against the
**initial containing block**, which mobile Chrome deliberately sizes to the
**URL-bar-HIDDEN** height so the page doesn't reflow when the bar retracts.
With the address bar showing, the bottom of each panel sat below the visible
screen — the nav drawer's `Account` footer, and the last rows of the
notification list.

Nic's two screenshots confirmed it before a line was changed: Account is
visible in the one with **no** address bar, and the address bar is present in
the one where it isn't.

**Fix:** `h-dvh` on both (Tailwind 3.4.19 ships `h-dvh`/`h-svh`/`h-lvh`).
`dvh` tracks the viewport actually on screen. Both panels are already
`flex flex-col` with a `flex-1 overflow-y-auto` middle, so a correct height
is all they needed.

## 3 — Verification

- `.min-w-0{min-width:0}` and `.h-dvh{height:100dvh}` both confirmed present
  in the built CSS **before shipping** — the `bg-green` lesson from
  feat-installer (a class that compiles to nothing fails silently).
- Type-check + production build green.
- Dev preview polled until the deployed CSS hash matched the locally verified
  build, so Nic tested the right bundle — the "you tested the old bundle"
  trap has now bitten this project three times.
- Production after merge: login 200 · `/schedule` + `/jobs/new` 307 ·
  complete-route 405 · `sin1::sin1` · live CSS hash `b9bfd70c6f8ce942`
  identical to the locally verified build.

## 4 — Facts worth keeping

- **`flex-1` without `min-w-0` is a page-width bug, not a local one.** Swept
  the codebase: `JobRow` was the only page-level instance. The other `flex-1`
  hits (ClashResolutionModal, SearchableSelect, JobDetailShell) sit inside
  width-capped modals, so they cannot expand the document — left alone rather
  than churned.
- **`h-full` on anything `fixed` is wrong on mobile.** Use `h-dvh` for
  full-height overlays. `inset-y-0` / `top-0 bottom-0` share the same flaw —
  they resolve against the same containing block.
- **Repro method that worked:** built stylesheet + real markup + headless
  Chrome (`--headless --disable-gpu --window-size=412,900
  --virtual-time-budget=4000 --dump-dom`), asserting
  `scrollWidth > clientWidth`. Note: piping Chrome's stdout into a PowerShell
  variable yields null — redirect to a file.
- `InstallerJobCard` was already immune (`overflow-hidden` on the card +
  `flex-1 min-w-0` on the column) — useful as the reference pattern.

## 5 — Session context

- **`dev` moved mid-session.** Five commits from parallel sessions (Voice PA
  park-up, Workflow V3 cancellation, docs) landed between session start and
  the commit. The fix went on top as a clean fast-forward; `main` had already
  taken the docs commits, so the dev → main merge carried only the 3 source
  files. The standing lesson holds: fetch before every push.
- **Memory index repaired** — `MEMORY.md` listed only 2 of 9 memories (two
  parallel sessions saving over each other). Rebuilt with all entries, plus a
  new `mobile-viewport-layout-traps` memory for the two traps above.
- Session skips (Nic's calls): AI importance question, Bryan branch check.

## ⚠️ Next

- Nothing pending from this session.
- Nic's open decision remains the Voice PA stack unlock (LiveKit
  recommended); the browser Voice PA stays parked and unmerged.
