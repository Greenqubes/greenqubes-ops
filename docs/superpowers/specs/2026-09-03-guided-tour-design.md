# Guided App Tour — In-App Onboarding Walkthrough (Design Spec)

**Date:** 2026-09-03
**Status:** Approved design, awaiting Nic's spec review
**Branch:** `dev` (normal dev-first workflow — this is a webapp feature, independent of Workflow V3)

---

## Plain-language summary (for Nic)

Every team member's first sign-in offers them a guided tour: the screen dims,
a spotlight highlights one real button at a time, and a small card explains it
in plain words with Back / Next / Exit. The tour walks itself from page to
page, matched to the person's role (a sales person sees the job-creation flow,
an installer sees My Jobs and photo uploads), and finishes by pointing at
**Connect Telegram**. It never performs real actions — nobody can break
anything or spam the team while learning. Re-openable anytime from the
account menu ("App tour"). English + Chinese; Bengali falls back to English.

---

## 1. Decisions already made (Nic, 2026-09-03)

| Decision | Choice |
|---|---|
| Format | Guided tour inside the real app (not a standalone demo page) |
| Depth | **Show-and-explain only** — the tour never performs real actions; no data created, no Telegram fires |
| Roles | All 6 team roles: sales, scheduler, coordinator, installer, designer, production. Admin skipped (that's Nic). External installers keep their `/ext` links — no tour |
| Trigger | Auto-offers on first login (Skip always available); re-openable from the account menu |
| Seen-memory | Per device per user via localStorage (the `overdue-seen:{userId}` pattern) — **no migration** |
| Dependencies | **None added.** Custom-built engine; stack stays locked |
| Sign-up coverage | Out of scope — happens before login; stays with the rollout runbook + meeting |
| Workflow V3 | Not covered — scripts get a small update when V3 merges (add to the V3 merge checklist) |

---

## 2. User experience

### 2.1 First-login offer

- On the person's **role home page** only (office roles: `/schedule`; installers:
  `/installer`) — never on deep links (a Telegram link into a job chat must not
  trigger it).
- If localStorage has no `tour-seen:{userId}` key: a centred welcome card
  (modal, above everything) appears after the page settles:
  *"Welcome to GreenQubes! Want a quick walkthrough of the app? · **Start
  tour** / **Skip for now**"*.
- Both buttons write `tour-seen:{userId}` — the offer never nags twice on the
  same device. Skipping still leaves the account-menu entry available.

### 2.2 The tour itself

- **Spotlight overlay:** the page dims (semi-opaque scrim); the current target
  element shows through a rounded cut-out with a subtle ring. The scrim blocks
  clicks on the page underneath (show-and-explain — the app is read-only while
  the tour runs).
- **Tooltip card** anchored beside the spotlight (auto-flips to stay on
  screen): title, 1–3 sentences of plain language, step counter ("3 of 12"),
  **Back / Next / Exit tour** buttons. On phone, the card may render as a
  bottom-anchored sheet when space is tight — always above the bottom nav.
- **Page-to-page:** steps can live on different routes. The engine navigates
  via `router.push` between steps and waits for the next target to exist
  before showing its card.
- **Steps with no visible target** (intro, "this page lists…", outro) render
  as a centred card with no spotlight.
- **Finale (every role):** the engine opens the account menu and spotlights
  **Connect Telegram** — "Do this now: two taps, and every notification about
  your jobs reaches your Telegram." Last card: "You're set. Re-open this tour
  anytime from your profile picture → App tour."
- **Exit** at any step marks the tour seen and restores the page.

### 2.3 Re-opening

- New row in `UserMenu` (and the phone `NavDrawer` if menu items are mirrored
  there): **App tour** — starts the person's role script from step 1,
  navigating to their home page first.

### 2.4 Languages, themes, devices

- All copy through the i18n table: keys added to `en.ts` + `zh.ts`; `bn`
  falls back to English per the standing rule. Live in `src/lib/i18n/`.
- Styled with existing tokens; correct in light and dark mode.
- Phone-first (the team is mostly on phones) and PC. Where the two layouts
  diverge (job form: 4 tabs on phone vs two columns on PC), a step lists
  alternative targets and the first one found wins.

---

## 3. Architecture

New feature folder `src/features/tour/`:

```
src/features/tour/
├── TourProvider.tsx      # client component; owns tour state; mounted once
├── TourOverlay.tsx       # scrim + spotlight + tooltip card (pure presentation)
├── WelcomeCard.tsx       # the first-login offer modal
├── engine.ts             # pure state machine: current step, next/back/exit,
│                         #   target resolution order, seen-key helpers
├── engine.test.ts        # standalone suite (node --test style, like the
│                         #   repo's other pure-helper suites)
└── steps/
    ├── types.ts          # TourStep type
    ├── common.ts         # shared intro/bell/account-menu/finale steps
    ├── sales.ts
    ├── scheduler.ts
    ├── coordinator.ts
    ├── installer.ts
    ├── designer.ts
    └── production.ts
```

### 3.1 Step definition

```ts
type TourStep = {
  id: string
  targets?: string[]        // data-tour values, tried in order; undefined = centred card
  route?: string            // navigate here first (e.g. '/jobs/new')
  before?: TourAction       // optional: 'open-user-menu' | 'open-nav-drawer' | 'job-form-tab:<name>'
  titleKey: string          // i18n keys — no hardcoded copy
  bodyKey: string
}
```

- **Targeting:** small `data-tour="…"` attributes added to existing components
  (CompanyBar bell, BottomNav tabs, New Job button, job-form cards/tabs,
  installer dashboard sections, Design Load board, FCFS toolbar, UserMenu
  rows…). Attributes are inert — zero behaviour change to the components.
- **Anchors are stable UI, never data rows** — the tour works on an empty,
  brand-new account. Empty states are narrated ("when a job is assigned to
  you, it appears here").
- **Missing target:** engine polls briefly (~2s) after any navigation/`before`
  action; if the target never appears, the step degrades to a centred card
  with the same text. The tour never crashes or stalls on a missing element.
- **`before` actions** are custom DOM events (`tour:open-user-menu`,
  `tour:open-nav-drawer`, `tour:job-form-tab`) that `UserMenu` / `NavDrawer` /
  the job-form shell each subscribe to with a 3-line listener. No refs
  threaded through the tree.

### 3.2 Mounting and role

- `TourProvider` mounts inside `CompanyBar` (which every authenticated shell
  already renders, with `role` + `lang` in hand) — one mount point, zero new
  wiring per page. It picks the script by **effective role** — so Nic's
  preview-as spot-checks each role's tour (final pass with a real login as
  usual).
- Roles land on different home pages; the provider only auto-offers when the
  current path is that role's home, reusing the same role→home mapping the
  app's login redirect already uses (single source of truth, no second copy).

### 3.3 Z-index

Tour scrim + card: **`z-[80]`** — above BottomNav (`z-50`), drawers/modals
(`z-[60]`), and the Memory manager (`z-[70]`), so the spotlight can highlight
elements inside an opened drawer. Complies with the overlays-above-nav hard
rule.

### 3.4 Persistence

- `tour-seen:{userId}` in localStorage (written on Start, Skip, or Exit).
  Read inside `try/catch` after mount only (the hydration lesson).
- New device/browser → offered again; one tap to skip. Accepted trade-off, no
  migration.

---

## 4. Role scripts (content outline)

Copy is adapted from the approved role cheat sheets in `docs/rollout/`.
Common spine for every role: welcome → top bar (logo = home, bell = alerts,
avatar = account) → role home page → role-specific flows → bell drawer →
account menu (language, dark mode, **Connect Telegram**) → finale.
Step counts are estimates; final wording lands during the build.

| Role | Role-specific steps (between the common spine) | ~Steps |
|---|---|---|
| **Sales** | Schedule list/week/month + date strip; Pending tab (your own unpushed jobs); New Job button → job form (Details / Team / Files / Chat), suggest an installer (yellow = suggestion, green = assigned by scheduler), Push to Schedule + what the clash warning means; Duplicate; FCFS board (read it, don't fear it); Design brief card (assigning a designer) | ~14 |
| **Scheduler** | Schedule + Completed tab; FCFS board (rank, punctuality colours, assignment panel, Save & Notify); formal assignment vs suggestions; complete / revert; bulk select bar | ~14 |
| **Coordinator** | Sales flow (create/push/duplicate) + "you suggest installers, the scheduler assigns"; shared pending jobs (you see pending jobs you're assigned on); clash alert choices | ~12 |
| **Installer** | My Jobs (Today / Up next / This week); job page: tasks to tick, photo upload, DO; job chat + voice notes; "you only see jobs assigned to you" | ~8 |
| **Designer** | Design Load board (your bar, colours = urgency); Board / My Jobs toggle; the Design brief card; Design completed + the 1–5 rating; due-date alerts | ~9 |
| **Production** | Your editable fields (Production ready, DO issued, instructions, photos); reading files; everything else is view-only by design | ~8 |

---

## 5. Out of scope

- Sign-up / Google sign-in (pre-login — runbook + rollout meeting own it)
- Workflow V3 projects (not merged; scripts updated at V3 merge — added to
  that checklist)
- Admin screens, external `/ext` pages, the assistant's own onboarding
  (the assistant explains itself well enough)
- Learn-by-doing / practice actions (explicitly rejected — Telegram noise)
- Cross-device seen-state (localStorage accepted)

## 6. Error handling summary

| Failure | Behaviour |
|---|---|
| Target element never appears | Step degrades to centred card, tour continues |
| Route navigation fails / slow | Same poll-timeout → centred card |
| localStorage unavailable | try/catch; tour still offerable manually, offer may repeat |
| Viewport resize / rotate mid-tour | Spotlight re-measures on resize + scroll |
| Language switched mid-tour | Cards re-render from i18n table (state is step index, not text) |

## 7. Testing

- **Standalone suite** for `engine.ts` (pure logic: step advance/back/exit,
  target resolution order, seen-key behaviour, script selection per role) —
  joins the repo's existing standalone suites.
- **Manual checklist** (tickable artifact page, like the smoke-test pages):
  per role × phone + PC × light + dark — offer shows once, spotlight lands
  right, navigation steps work, finale opens the menu, Exit restores the page,
  re-open from menu works, bn shows English.
- Type-check + production build green before push (house rule).

## 8. Rollout

1. Build on `dev` → Vercel preview.
2. Nic spot-checks each role via preview-as on the preview, then a real
   non-admin login for one full pass.
3. Merge `dev` → `main` when cleared. The tour then greets every team member
   at first sign-in — ready before the company rollout meeting.
