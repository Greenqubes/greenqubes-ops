# GreenQubes Mobile App — Design Spec

**Date:** 2026-08-18
**Status:** Approved in brainstorming session (Nic)
**Supersedes:** the "Port to mobile apps" planning note in `nic-checklist.md` (2026-07-22)

---

## 1. What this is

A native mobile app (Android + iPhone) for the GreenQubes ops platform, built with
**React Native + Expo**, talking to the **same** Supabase database, Cloudflare R2 file
storage, and Vercel server routes the webapp uses today. One codebase produces both
the Android and iPhone app.

**The webapp is NOT being phased out.** It stays as the desktop/office tool. The app
replaces *using the browser on a phone* — it is the on-the-go version for anyone away
from their desk, and the primary tool for installers.

**Rollout order: Android first** (free, direct .apk install). iPhone follows when the
directors greenlight the Apple Developer subscription (US$99/year) — same code, no
rework, just publishing.

### Why (Nic's drivers, in priority order)

1. **Real phone push notifications** — the app's pushes + in-app notification bell
   make the Telegram bots redundant: one less system to wire and maintain.
2. **App-like feel** — icon on the home screen, full-screen, feels installed.
3. **Works offline / on-site** — installers at low-signal sites can view jobs and
   queue uploads.
4. **Job chat becomes the company's go-to communication channel** — it must work
   perfectly. This is the make-or-break feature.

Store presence / public listing is explicitly NOT a goal.

### Decisions locked in this session

| Decision | Choice |
|---|---|
| Build approach | React Native + Expo (native app), not a webview wrapper, not a PWA |
| Platforms | Both, one codebase; Android ships first |
| Phone mix on team | Roughly half Android, half iPhone |
| Webapp's future | Stays as the desktop/office tool; admin screens + FCFS board stay desktop-only |
| App scope v1 | Everything except admin + FCFS ("carbon clone" of the webapp's mobile-relevant surface) |
| Chat scope | Per-job chat only — no direct messages, no team channel in v1 |
| Second sign-in method | Email sign-in link (magic link) alongside Google — on webapp AND app |
| Telegram retirement gate | Only after Stage 3 **and** the iPhone rollout are both live — Telegram stays as the iPhone users' lifeline until Apple subscription is approved |
| Webapp status | Nic declares it launched at v1.0.0; docs (plan.md / context.md) to be updated to match |

---

## 2. Build stages

Each stage ships to real phones when done: Nic smoke-tests on his Android, feedback
rounds until green, then the team gets the updated .apk.

### Stage 1 — Communication core (longest stage; lays every foundation)

- Project scaffold: `mobile/` folder in this repo (Expo app), shared types/i18n with the webapp
- Login: Google sign-in + email sign-in link; session persists on device
- Job list (role-appropriate) + job detail (view)
- **Per-job chat at WhatsApp quality** — see section 5
- In-app notification bell (same content rules as the webapp bell)
- **Push notifications** for chat messages, job assignment, overdue alerts, clash alerts — see section 4
- First-run onboarding screen incl. the battery-settings step for Chinese-brand Androids
- Webapp side (small, can land before the app): email sign-in link added to the login page

### Stage 2 — Field work

- Installer dashboard: Today / Up next / Completed
- Task list ticking with progress bar
- Completion photos, DO upload, production photos — camera-first flows
- **Offline**: recently viewed jobs readable with no signal; photos, messages,
  task ticks queue and auto-sync when signal returns (visible "waiting to sync" state)

### Stage 3 — Office on the go

- Schedule list view (windowed date strip pattern, phone-first)
- Create job + push to schedule, with clash warnings
- Scheduler/coordinator: assign installers (suggestion → formal assignment flow)
- AI assistant chat (online-only)
- Monday digest vote (Promote/Skip) as an in-app card — replaces the Telegram voting buttons
- Bug report alerts to admin as pushes
- App declared **V.1.0.0.0**

### Post-v1 / deferred (explicitly out of scope)

- Admin screens, FCFS board (desktop-only)
- Typing indicators, read receipts, message edit/delete, replies, reactions in chat
- Direct messages / team channel
- Live chat for external installers (they keep their web links; externals never install the app)
- Desktop apps (.exe/.dmg) — separate decision later
- Play Store listing (optional US$25 one-time, only if store auto-updates ever wanted)

---

## 3. Architecture

- **New Expo (React Native + TypeScript) app in `mobile/`** in this repository.
  Same repo so app + server code travel together; shared constants, types, and
  i18n strings (en/zh; Bengali stays frozen per the 2026-08-03 boss decision —
  bn falls back to English) are imported from shared code, never copy-pasted.
  Webapp screens are not reused; logic patterns are ported one-to-one.
- **Backend unchanged.** Supabase (auth, DB, RLS, realtime), R2 via the existing
  signed-URL routes, Vercel API routes. No second database, no sync layer.
  All existing hard rules apply: never embed `users` on `jobs` in PostgREST
  selects; RLS is the access-control mechanism; suggested installers are
  invisible to installers.
- **Auth:** Supabase auth with native Google sign-in + email magic link. Same
  accounts, same provisioning flow (admin pre-provisions by email; first sign-in
  links `auth_id` by email — works identically for magic-link users).
  "Sign in with Apple" gets added when the iOS store build happens (Apple
  requires it for apps offering Google sign-in).
- **Realtime:** Supabase realtime channels with the JWT-auth pattern from
  `useLiveChannel` (the 2026-08-12 lesson — always `setAuth` before subscribe),
  ported to a React Native equivalent hook.
- **Design language:** brand tokens (warm bone, terracotta, green, amber),
  Fraunces for display + IBM Plex Sans for body, pills not badges — laid out
  phone-first. Date labels always English in every language (hard rule).
- **New server-side piece:** a push-notification fan-out (see section 4) added
  to the Vercel side. This is the only significant backend addition.

---

## 4. Notifications — replacing Telegram

### Pipeline

Every event that today composes a Telegram message ALSO sends a phone push via
**Expo's push service** (free, standard; FCM under the hood on Android, APNs on
iPhone later). The app registers a push token per device at login; the server
stores tokens per user and fans out on each event. Tapping a push deep-links to
the exact screen (job chat, job detail, etc.).

### Rules — same as today, nothing new invented

- Chat pushes → the job's team (existing recipient logic), **per-message and
  instant** (an upgrade over Telegram's 1-minute batching), suppressed for a
  chat the user currently has open on screen.
- Overdue alerts → team-scoped per the 2026-08-17 decision: POC + coordinators +
  formally assigned installers; scheduler + admin see all; suggested installers
  never alerted.
- Assignment, clash, new-job events → same recipients as their Telegram templates.
- The in-app bell shows the same list on app and webapp.

### Telegram retirement — two steps, gated

1. **During Stages 1–3:** Telegram and pushes run side by side. Telegram is the
   safety net and the iPhone users' only channel.
2. **After Stage 3 AND the iPhone rollout are both live, and Nic says go:**
   Telegram bots switch off. By then the digest vote and bug alerts have moved
   in-app (Stage 3). Nothing is retired while any team member lacks the app.

### Known caveat

Some Chinese-brand Androids (Xiaomi/Oppo/Huawei) kill background apps
aggressively; a one-time per-phone "allow background" setting fixes it and is
part of the app's first-run onboarding.

---

## 5. Chat — the make-or-break feature

Held to a higher standard than everything else, because it becomes the company's
main communication channel.

- **Trustworthy delivery:** instant on good signal; on bad signal messages queue
  on-device with a "sending…" state and auto-send when signal returns. Nothing
  silently lost; a true failure shows and offers retry.
- **Full feature parity with web chat, rebuilt phone-first:** text, photo
  attachments with thumbnails, camera capture, documents, voice notes with
  waveform player, avatars/initials, terracotta own-message styling. Identical
  history across app and webapp (same tables).
- **Site-friendly ergonomics:** big touch targets; camera one tap away;
  press-and-hold voice recording.
- **Unseen counts** (existing `job_chat_state`) drive badges on the job list.
- **Deliberately excluded from v1:** typing indicators, read receipts,
  edit/delete, replies, reactions.

---

## 6. Offline

- The app caches what it has seen: job details, tasks, chat history readable
  with zero signal.
- Offline actions that queue + auto-sync: chat messages, photos/DO uploads,
  task ticks — each with a visible pending state.
- NOT available offline (by design): creating/editing jobs, the AI assistant.

---

## 7. Distribution + updates

- **Android:** .apk built by Expo's build service (EAS), installed from a link.
  No store, no fee, no review.
- **Over-the-air updates (EAS Update):** most fixes/improvements apply silently
  on next app open — no reinstalls. Occasional deeper changes need a new .apk
  (~every couple of months at most); the app detects it is outdated and shows a
  mandatory "Update available — tap to download" screen so old versions can't
  linger.
- **iPhone (when greenlit):** same code built for iOS; testers via TestFlight;
  end state is an **unlisted App Store link** (real install, link-only
  discovery). OTA updates work identically.
- **Versioning:** app stages ship as V.0.X.0.0; Stage 3 completion = app
  **V.1.0.0.0**.

---

## 8. Testing + rollout

- Per stage: build sessions → Nic smoke-test on his Android against a checklist
  → feedback rounds → team rollout.
- Chat: two-phone live test before Stage 1 is called done.
- Installer visibility (suggestions hidden, RLS): verified with a **real
  installer login** — preview-as does not exercise DB-level rules.
- Webapp untouched throughout except the email-link login addition.

---

## 9. Costs + Nic's checklist

| When | Item | Cost |
|---|---|---|
| Now | Expo account (build service) | Free |
| Now | Nic's Android phone as test device | — |
| When directors greenlight iPhone | D-U-N-S number request (lead time: days–weeks; start early) | Free |
| Then | Apple Developer Program, enrolled as **organization** (GreenQubes) | US$99/year |
| Optional, anytime | Google Play account (only if store auto-updates wanted) | US$25 once |

Apple subscription lapse behaviour (for the directors' question): installed
apps keep working, but push notifications stop and no new installs/updates are
possible until renewed. Nothing is permanently lost. Treat as a standing
utility bill with auto-renew.

---

## 10. Risks + honest expectations

- **Biggest single build since the webapp itself** — a multi-week series of
  sessions. Stage 1 is the longest; Stages 2–3 go faster on its foundations.
- **Chat reliability bar is high** — Stage 1 is not done until the two-phone
  test feels WhatsApp-solid.
- **Push delivery on aggressive Android battery managers** — mitigated by
  onboarding step; residual risk accepted.
- **Telegram runs longer than hoped** if the Apple greenlight is slow — by
  design, not by accident.
- **Docs drift:** plan.md / context.md still describe alpha/beta/launch as
  pending; Nic has declared the webapp launched (v1.0.0). To be corrected at
  session end 2026-08-18.
