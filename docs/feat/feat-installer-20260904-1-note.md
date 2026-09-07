---
session: feat-installer (installer completion flow + colour-class sweep)
date: 2026-09-04
branch: dev (built directly on dev per Nic's inline-work rule; merged dev → main `edeaf62` same day, LIVE on production)
---

# Installer completion flow — built, colour-fixed and live in one session

> Nic's ask: "ground breaking feature missing" — installers had NO way to
> finish their own jobs. Only the scheduler had a Mark-job-complete button.
> Three asks, all shipped: the photo-gated Completed button, the Signed DO
> field hiding when no DO is required, and the Completed tab opening ALL
> past jobs to every installer ("real installers refer backwards").

## 1 — Design (Nic's decisions, via AskUserQuestion round)

- **"DO required" = production's existing `do_issued` tick** — the installer
  view already renders "No DO Required" / "Please Sign DO Provided" off the
  same flag, so the rule is consistent: the "Signed DO (Optional)" upload
  section only appears once DO issued is ticked, and an already-uploaded
  signed DO always stays visible (files never vanish from view).
- **Old completed jobs show CHAT too** (Nic chose the wider option over
  details+photos-only). Task list and formal crew ride along; job pages
  open fully read-only for non-assigned installers.
- **Telegram to the sales POC on completion** — new `tplJobCompleted`
  ("✅ Job Completed … Completed by: {installer}"), awaited (Vercel
  fire-and-forget lesson), never fails the completion, failures logged
  as `[jobs/complete] telegram failed`.
- Confirm modal before completing — installers cannot revert (office-only).

## 2 — What was built

- `src/lib/utils/completion-rules.ts` — pure rules (TDD, 11-check
  standalone suite): `installerCompleteState` (hidden unless installer +
  scheduled; disabled until ≥1 completion photo; else enabled) and
  `showSignedDoSection` (doIssued || files exist).
- `POST /api/jobs/[id]/complete` — installer-only (`getEffectiveRole`),
  modelled on revert-complete: formal assignment checked
  (`is_suggestion = false` — a suggestion is not an assignment), status
  must be `scheduled` (idempotent ok on double-tap after success),
  ≥1 `files.kind='completion'` row, then service-client update (installers
  have NO jobs UPDATE RLS — deliberate). Status guard `.eq('status',
  'scheduled')` on the update.
- JobDetailShell: button in the installer action bar above Back to Jobs,
  `bg-brand-green` enabled / `bg-line text-muted` disabled + hint line,
  confirm modal, 409 `no_completion_photo` mapped to the hint toast.
  Colour flips live — uploads `router.refresh()` and the count reads
  `job.files` directly.
- ProductionReadySection: Signed DO section gated on
  `watch('do_issued')` (JobDetailShell is its only consumer; NewJobShell
  never renders it).
- **Migration 0053** (applied by Claude at Nic's request — dry-run first,
  only 0053 pending): additive SELECT-only policies — installers read all
  completed `jobs`, plus `files` / `messages` / `job_tasks` / formal
  `job_assignees` rows on completed jobs. **`job_is_completed()` is
  SECURITY DEFINER** because the 0037 jobs policy already references
  job_assignees — a job_assignees policy referencing jobs directly would
  recurse (same rationale as get_my_role in 0002). `/api/r2/download-url`
  auto-widened for free: it authorizes by the caller's jobs RLS.
- `getInstallerJobs` trimmed to scheduled-only — the dashboard never
  rendered completed rows, and post-0053 the old `.in(...completed)` would
  have dragged the whole company's history into every dashboard load.
- i18n: en + zh only (bn freeze respected) — `installerCompletedBtn`,
  `installerCompleteNeedsPhoto`, confirm title/body.

## 3 — The colour bug (Nic's catch → app-wide fix)

Nic: "completed button not visible in daylight view… its the color thats
wrong." Root cause: `bg-green` **is not a class in this app** — the teal
token is `brand-green` (tailwind.config maps only `brand-*` names), and
Tailwind's default palette has no bare `green`/`amber`/`blue` either. The
enabled button was white text on NO background — invisible in light mode.

Sweeping for the species found **30 bare `green`/`amber`/`blue` utilities
across 9 files that had never compiled** (verified by grepping the built
`.next/static/css` before and after): ClashResolutionModal (resolved
banner, substitute selection, Free/Conflict badges), WorkloadPreviewModal
(the blue day-count circle — its number was white-on-white!),
BugReportButton + admin BugReportsTab severity colours, admin mark-fixed
green, assistant + floating-chat source chips, HistoryList pinned-chat
amber, UserMenu preview-as ring, ChatSection zip icon. All renamed to
`brand-*` with a boundary-safe regex; numbered default shades
(`amber-700`, `amber-300`, `amber-50`) untouched.

## 4 — Verification + ship

- 20 standalone suites green (incl. new completion-rules); tsc + prod
  build clean before each of the 3 commits.
- Nic tested on the dev preview **as a real installer** (preview-as can't
  test RLS). Deploy-lag lesson recurred: his first test hit the old bundle
  → "refresh open tabs after a deploy" strikes again.
- Merge: `main..dev` enumerated first (only this session's 3 commits +
  5 doc-only commits already public on dev) — the feat-tour parallel-agent
  lesson applied. dev → main fast-forward `edeaf62`; production probed
  green (complete-route 401, login 200, schedule 307).

## 5 — Facts worth keeping

- **Bare `green` / `amber` / `blue` Tailwind classes do not exist here —
  always `brand-green` / `brand-amber` / `brand-blue`** (and `-soft`
  variants). When a tint looks missing, grep the compiled CSS: a class
  that generates no rule fails silently.
- `job_is_completed(uuid)` SECURITY DEFINER now exists for any future
  policy that needs "is this job completed" without touching jobs RLS.
- The scheduler's photo-free "Mark job complete" override is untouched;
  the installer route never bypasses the photo requirement.
- Dev preview URL used for probes:
  https://greenqubes-ops-git-dev-greenqubes-projects.vercel.app (bypass
  secret in `.env.local`; a new API route answering 401-not-404 is a clean
  "new bundle deployed" signal).
- Session skips (Nic's calls): AI importance question, Bryan branch check
  (on leave), V3 worktree untouched.

## ⚠️ Next

- Nothing pending from this session.
- V3 round 2 (schedule folding) remains the next big build; guided-tour
  中文/বাংলা corrections still pending from the demo.
