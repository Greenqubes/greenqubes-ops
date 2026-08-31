---
session: feat-design (Design Load — designer workflow V2.5: brainstorm → spec → subagent-driven build → two feedback rounds)
date: 2026-08-18 (design) · 2026-08-26 → 2026-08-28 (build + feedback rounds)
branch: feat-designer-load-flow (worktree ../greenqubes-ops-design-load) — NOT merged
---

# Design Load — BUILT, awaiting one fix + Nic's merge

> Nic's "Workflow V2.5 Designers" diagram became a full feature: designer
> assignment, Design brief card, AI complexity scoring, auto-shifting due dates,
> a Design Load board, a rating slider with a trust check, 3-day reminders and an
> admin AI Scores tab — then two rounds of Nic's smoke-test feedback (16 edits)
> reshaped roles, navigation and notifications along the way. 13 of 14 round-2
> checks cleared; **B3 (Telegram on due-date shifts) + edits 15/16 are queued.**

## 1 — Design (2026-08-18)

- Brainstormed one question at a time from the PDF. Key calls: Design Load for
  sales/scheduler/coordinator/designer/admin (one shared view; designers get a
  Board | My Jobs toggle); multiple designers per job; **AI decides urgency** from
  the brief (Haiku text-only / Sonnet with attachments), scored on real change
  only, urgency colour computed live; **no survey** — a draft baseline table
  ships in the prompt and the designer's **required 1–5 rating at completion**
  is the ground truth, cross-checked against the AI prediction + real turnaround
  (suspect ratings quarantined; admin Keep/Discard). No mid-flight manual score
  correction. Brief required on every edit-save of a scheduled job with a
  designer — pre-booking exempt. Due dates **follow install-date moves** (gap
  preserved). Whiteboard parked for its own session.
- Spec `docs/superpowers/specs/2026-08-18-design-load-design.md` (+ Addendum
  2026-08-27 for the coordinator/created_by/production changes); 16-task plan
  `docs/superpowers/plans/2026-08-18-designer-load-flow.md`.

## 2 — Build (2026-08-26 → 27): subagent-driven, per-task reviews

- 12 planned tasks + 4 addendum tasks; each implemented by a fresh subagent from
  a brief, reviewed (opus for the risky diffs), fixed in scoped rounds, plus two
  whole-branch reviews (fable). Migrations **0048** (job_designers, design
  columns, design_scores), **0049** (designer file RLS — their uploads couldn't
  read back; protected DESIGNER JO bucket), **0050** (created_by trigger,
  coordinator/production file RLS — production photo uploads had been silently
  broken since V2). Claude ran all three `db push`es at Nic's request (remote).
- **Reviews caught ~15 real bugs before Nic saw a preview.** Highlights: Save
  button never enabling on a designers-only change · `design_brief` missing from
  the upload whitelist (whole attachment path dead — only the whole-branch
  review could see it) · designer rescore lever with no assignment check or
  cooldown · fire-and-forget scoring that Vercel would freeze (→ `after()`) ·
  0049's UPDATE policy missing `WITH CHECK` (would have stranded any job that
  lost its JO bucket) · job Delete silently no-op for sales (pre-existing RLS
  gap; false success toast) · coordinator losing the clash pre-flight on time
  moves when demoted · nav drawer's z-index trapped in the top bar's stacking
  context · the old green installer tint never rendering (Tailwind drops alpha
  on `var()` colours).

## 3 — Feedback rounds (2026-08-27 → 28): 16 edits, all built + pushed incrementally

Logged verbatim in `docs/superpowers/specs/2026-08-27-design-load-smoke-feedback.md`.
Round 1 (edits 1–11): scheduler bypasses the brief rule · board bottom-anchored,
full-width, bubble beside the bar · designers picker as a tile card · notification
drawer: tap-to-read, assigner name, X + Clear All (reminder rows sealed from every
delete path), "Due date:" label + client/install date, Telegram parity, answered
reminders vanish · bigger always-visible file buttons · designers can Reopen ·
**coordinator suggest-only for installers everywhere incl. FCFS** (reverses part
of Phase 2) + full-green assigned cards · production buckets view-only · zh
labels + CJK header size · **mobile hamburger drawer** replacing the bottom nav.
Round 2 (edits 12–16): draggable floating buttons (chat panel follows the
bubble) · sales/coordinator complete + reopen (override path, no rating) ·
designers grid moved into the brief card (PC-only collapse) · edge-snap on
release (queued) · modal copy (queued).

## Facts worth keeping

- **Vercel previews block API calls** (302 → SSO) — cron routes can't be hit on a
  preview; plant the rows via Supabase REST instead (done for reminder tests).
  The reminder cron's first real run is the first production morning.
- **Coordinator = sales on jobs** (create/push/delete incl. bulk/duplicate; sets
  PIC at creation) but **suggest-only for installers**; scheduler alone assigns.
- Replacing a departed designer: new Google account + alias, never rename the
  old one (would hand over private chats, attribution, Telegram link).
- Test data to clean: Test DL* / Test1 jobs, planted reminder rows, Test DL A's
  JO file `ts` backdated 4 days.

## ⚠️ Next session

1. Check out `feat-designer-load-flow` (worktree) — `dev` is behind.
2. Fix **B3** (bell card works, Telegram doesn't; fire on **every** shift), **edit
   15** (edge-snap), **edit 16** (modal copy); Nic re-tests B3; then his merge
   `feat-designer-load-flow → dev → main`.
3. Seven small owner decisions in nic-checklist.md (suggestion ownership,
   external-contact confirm rights, bulk mark-as-read, who-moved on shift cards,
   job-form top bar, Reopen on installation-completed jobs, iPad drawer check).
4. Follow-ups ledgered: portal the NotificationDrawer like NavDrawer (stacking
   trap), de-duplicate the double-mounted bell/profile fetches, remaining
   hover-reveal buttons in 3 files, JobDetailShell is 1.7k lines (extract
   DesignerActionBar in a quiet session).
