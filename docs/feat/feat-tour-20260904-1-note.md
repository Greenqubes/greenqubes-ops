---
session: feat-tour (guided app tour — in-app onboarding walkthrough)
date: 2026-09-03 → 2026-09-04
branch: dev (built directly on dev — deploy-workflow + demo deadline; merged dev → main 2026-09-04, LIVE on production for the Office Depot go-live)
---

# Guided app tour — built, reviewed and live in one session

> From Nic's ask ("a live demo tutorial of the website… they have zero
> knowledge at all") to production in one overnight session, timed for the
> Office Depot go-live demo. Every team member's first sign-in now offers a
> two-minute spotlight walkthrough of their own role's real screens, in
> English / 简体中文 / বাংলা.

## 1 — Design (Nic's decisions)

- **Guided tour inside the real app** — not a standalone demo page (a copy
  drifts; the real thing can't). **Show-and-explain only**: a full-screen
  click shield makes the app inert while the tour runs — no data created, no
  Telegram fired.
- All **6 team roles**, auto-offer on first login (per device, localStorage
  `tour-seen:{userId}`), re-open via profile picture → **App tour**.
- **"Start tour" → Choose your language** (added mid-design by Nic): picking
  English / 简体中文 / বাংলা saves the person's whole app language via the
  existing `/api/user/lang` route — the tour's ONE sanctioned write. Doubles
  as day-one language setup. App-tour restarts skip the chooser.
- **Bengali = Nic's scoped exception to the 2026-08-03 bn freeze** (tour keys
  only, ~84 strings). Both zh and bn are UNVETTED — corrections collected at
  the demo. Where the bn UI falls back to English labels, the bn copy quotes
  those labels in English ('Today', 'Push to Schedule'…).
- Copy rule from Nic: never tell users form fields are "optional" — frame
  fields by purpose (saved to Claude's memory too).
- **Interactive mockup approved before any code**: phone-frame simulation of
  the sales tour, EN/中文/বাংলা toggle —
  https://claude.ai/code/artifact/bed4ed5f-fb03-4f0c-a3c2-72e571a2fe08
  Building it caught a real plan bug (phone nav steps must open the drawer).

## 2 — What was built (12 tasks, subagent-driven; spec + plan in superpowers/)

- `src/features/tour/` — pure engine (state machine, storage codecs,
  `roleHome` extracted to `src/lib/utils/roleHome.ts` and shared with the
  login redirect), placement helper, `TourOverlay` (spotlight via giant
  box-shadow, card auto-flip, bottom-sheet fallback, `searching` dim),
  `WelcomeCard` (two views: offer → language chooser), `TourProvider`
  mounted in **both** CompanyBar branches, six step scripts + registry.
- **Anchors** are `data-tour` attributes on stable UI across the shells;
  duplicates across mobile/desktop resolved by an on-screen check (the
  closed NavDrawer keeps nonzero size off-viewport — width alone lies).
- **Progress lives in sessionStorage** — CompanyBar remounts on every route
  change, so the provider resumes from storage; this is also how the tour
  survives the role-less CompanyBar on job-form pages.
- Menu steps: `tour:close-menus` fired at every step start, then staggered
  before-actions (`open-nav-drawer` → `open-account-menu`, 60/240ms) so the
  finale can spotlight Connect Telegram inside the opened menu on phones.
- 3 new standalone suites (engine, placement, scripts) — the scripts suite
  enforces every step key exists in **en + zh + bn**, so a missing
  translation can never silently fall back. 18 suites total green; tsc +
  production build clean.

## 3 — Review machinery results

Fresh implementer + reviewer per task; final whole-branch review (opus —
fable hit its session rate limit mid-dispatch). Caught pre-ship:

- **Critical:** a stale cross-role tour state (sales tour left mid-run →
  installer signs in on the same tab) infinite-looped navigation via the
  role redirects. Fixed: role-mismatch clears the stored state; plus a
  per-step push guard.
- The overlay fully unmounted while polling for a target — up to 2s of
  undimmed, tappable app between steps. Fixed with a `searching` dim.
- `fcfs-board` / `design-board` anchors sat on data-dependent elements
  (empty day → centred-card degradation); moved to always-rendered
  containers.
- The smoke checklist asked the tester to open menus mid-tour — impossible
  by design; reworded to Exit → change → App-tour restart.
- Earlier task reviews: uncancelled stagger timers, plus assorted doc/count
  fixes. Two reviewer "Important" findings were only miscounts inside
  workers' scratch reports — ruled non-blocking after the code itself was
  verified.

## 4 — Go-live merge (the part worth remembering)

Nic previewed, approved, and chose to merge **without** the full checklist
tick-through. Before merging, `dev` turned out to also carry the concurrent
provisioning-overhaul agent's work — including **migration 0052** with its
db-push gate still UNTICKED in the checklist. A live-DB probe (service-role
select of `subrole`/`is_driver`/`qualifications`) confirmed the columns were
already applied, the gate was ticked with evidence, and only then did
dev → main go out (`6c65557`). Production probes green post-deploy
(/schedule 307, /login 200, cron 401). **Lesson: with parallel agents, a
merge to main ships everything on dev — always enumerate `main..dev` and
re-verify other agents' gates before pushing.**

## 5 — Facts worth keeping

- Tickable smoke checklist (per role × phone/PC, on-device ticks, a
  "Notes for Claude" box for demo corrections):
  https://claude.ai/code/artifact/8a1134df-9e73-4fec-b695-96894df61659 —
  repo copy `docs/guided-tour-smoke-test.md` with the standing-maintenance
  note (post-redesign tour re-run; tag re-homing).
- Preview-as gotcha: the seen-flag keys on the real admin account, not the
  previewed role — reset between roles (incognito, or delete `tour-seen:`).
- **Nic's standing instruction (mid-session): "do it inline yourself from
  now"** — no subagent dispatches unless he explicitly re-approves.
- Tour z-layer is `z-[80]`/`z-[81]`; BugReportButton also sits at `z-[80]`
  (works by DOM order — headroom fix parked).
- Post-demo polish parked: Escape + dialog ARIA on tour cards,
  Back-through-route behaviour, language-button double-tap guard, dead
  anchors (`menu`, `fcfs-zoom`), push-guard comment overstatement.

## ⚠️ Next

- Fold in the team's 中文/বাংলা corrections after the demo (fast pass).
- **When Workflow V3 merges: add Projects steps to the tour scripts.**
- V3 round 2 (schedule folding) remains the next big build on its own track.
