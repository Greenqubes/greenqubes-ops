---
session: chore-mobile (Webapp launched v1.0.0 + mobile app design spec)
date: 2026-08-18
branch: dev (docs only — no code written)
---

# Webapp Launched v1.0.0 + Mobile App Design — DONE

> Nic declared the webapp LAUNCHED at v1.0.0 (all necessary testing done —
> Sessions 21–23 alpha/beta/launch closed without being run). The rest of the
> session was a full brainstorming/design pass for the mobile app, ending in a
> committed spec awaiting Nic's review. No code written.

## 1 — Webapp launched, roadmap replaced

- Nic's declaration mid-session: "my webapp is at launch v1.0.0 already, I have
  done all necessary testing already." Sessions 21–23 closed in plan.md /
  CONTEXT.md; the current production deployment IS the launched product (no
  prod-tier promotion, no custom domain — future infra tasks if ever wanted).
- The webapp continues as the **desktop/office tool**. The mobile app becomes
  the new roadmap.

## 2 — Mobile app design (spec: [superpowers/specs/2026-08-18-mobile-app-design.md](../superpowers/specs/2026-08-18-mobile-app-design.md))

**Approach chosen:** React Native + Expo native app (Approach A) over a
webview wrapper (B) or PWA (C) — B and C fail the three drivers: real push
notifications, WhatsApp-grade chat, offline. One codebase in `mobile/` in this
repo; same Supabase/R2/Vercel backend, zero webapp changes except login.

**Nic's decisions this session:**

- **Why an app:** app-like feel + phone push + offline. The deeper goal: the
  app's pushes + bell make **Telegram redundant** — one less system to wire.
  Store presence explicitly NOT a goal.
- **Phone mix** roughly half Android / half iPhone. **Android ships first**
  (direct .apk, free); iPhone waits for the **directors' greenlight on Apple
  Developer** (US$99/yr, org enrollment, D-U-N-S number first — weeks of lead
  time). Nic's rule: **Telegram retires only when Stage 3 AND the iPhone
  rollout are both live** — until then it stays as the iPhone users' lifeline.
- **Scope v1 = "carbon clone"** of the webapp's mobile-relevant surface —
  everything except admin screens + FCFS board (desktop-only). Externals keep
  their web links.
- **Chat is the make-or-break feature** — becomes the company's go-to
  communication channel. Per-job only (no DMs / team channel in v1). Deferred
  from v1 chat: typing indicators, read receipts, edit/delete, replies,
  reactions.
- **Login change (webapp + app):** most installers/newcomers won't have org
  emails → **email sign-in link (magic link)** added alongside Google sign-in.
  (Google already accepts personal Gmail; the link covers hotmail/outlook/
  yahoo.) "Sign in with Apple" required later at the iOS store step.

**Stages (Claude's breakdown, Nic delegated):**
1. **Communication core** — login, job list/detail, WhatsApp-grade per-job
   chat, push notifications, bell. Longest stage; lays all foundations.
2. **Field work** — installer dashboard, tasks, photo/DO uploads, offline
   (read cached jobs + queue uploads/messages/ticks).
3. **Office on the go** — schedule list, create/push + clash warnings, assign
   installers, AI assistant, in-app digest vote + bug alerts. App = V.1.0.0.0.

**Distribution:** .apk from Expo's build service; over-the-air updates for
most fixes; forced-update screen for the occasional new .apk. iPhone later:
TestFlight → unlisted App Store link.

**Apple economics (Nic's questions, answered in session):** one company
account covers everyone, installing is free for the team; lapse = installed
apps keep working but pushes stop and no new installs/updates until renewed —
nothing permanently lost.

## Facts worth keeping

- Session start found the docs already updated by the parallel visual-design
  session (logo palette rebrand) — its plan/context/checklist edits landed
  mid-session; chore-mobile edits went on top. `feat-designer-load-flow`
  (Design Load spec, other agent) untouched, still unmerged to dev.
- The AI-importance session-start question was skipped (Nic's instruction).

## Key files

| File | Change |
|---|---|
| `docs/superpowers/specs/2026-08-18-mobile-app-design.md` | NEW — the approved mobile app spec (commit 3eeefe8) |
| `docs/plan.md` | webapp launched v1.0.0; Sessions 21–23 closed; Mobile App roadmap section; session row |
| `docs/CONTEXT.md` | status + migration checkboxes updated to launched + mobile roadmap |
| `docs/nic-checklist.md` | new Mobile app section (spec review, Apple greenlight, Expo account, optional Play); mobile-port item ticked; alpha prep → team onboarding |

## ⚠️ Notes for next session

- **Nic is reading the mobile spec** — next step after his approval is the
  **writing-plans skill** (implementation plan), NOT code. If he requests spec
  changes, revise + re-review first.
- The Apple Dev / D-U-N-S ask to the directors can start any time — longest
  lead-time item, independent of the build.
- Design Load flow (other agent, `feat-designer-load-flow`) still pending its
  own track — don't confuse the two workstreams.
