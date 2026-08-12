---
session: feat-realtime (Live updates everywhere — realtime root cause + fix, installer dashboard, hybrid job form)
date: 2026-08-12 (session started 2026-08-06; paused for parallel agent sessions in between)
branch: feat-live-updates → dev → main (live on production; branch kept for archive)
---

# Live Updates Everywhere — DONE, live on production

> Nic's "the site feels unresponsive, I have to refresh to see changes" was
> root-caused: the schedule + FCFS realtime listeners subscribed **without the
> user's JWT**, and RLS only delivers `postgres_changes` to authenticated
> listeners — both were silently deaf, kept alive by the 2-min poll crutch
> from 17.3. Fixed via one shared hook, then extended: assignments + tasks now
> broadcast (migration 0043), the installer dashboard is live, and the job
> form updates live with a "clean syncs, dirty warns" rule that never eats
> unsaved typing. Verified end to end on production, including the
> installer-can't-see-suggestions security check with a real installer login.

## What was done

1. **Root cause investigation** (systematic-debugging, no code until proven):
   Nic suspected the known hydration #418 error — it wasn't (that bug is
   cosmetic; this was stale data). Evidence trail: ChatSection has called
   `realtime.setAuth(access_token)` before subscribing since fix-chat
   (2026-05-19) because the browser client doesn't wire the JWT to realtime on
   its own; ScheduleShell and FCFSShell never got that fix, and the `jobs`
   RLS policies are `TO authenticated` — so their channels received nothing,
   ever. Session 17.3's "unreliable realtime" + 2-min poll was this same bug,
   diagnosed before the cause was known. Additionally `job_assignees` and
   `job_tasks` were **never in the `supabase_realtime` publication** — FCFS's
   assignee listener was waiting for events that were never broadcast.
2. **Immediate fix** committed first: setAuth in both shells (later subsumed
   by the hook refactor).
3. **Brainstorm → spec → plan** (Nic's decisions: "better if everything is
   instant"; job form = Hybrid; admin stays refresh-on-visit; assistant needs
   nothing — it's per-user private data that already streams). Spec:
   `docs/superpowers/specs/2026-08-06-live-updates-design.md`; plan:
   `docs/superpowers/plans/2026-08-06-live-updates.md` (dated 08-06 — the
   session ran across days with pauses for the parallel agent).
4. **`useLiveChannel` hook** (`src/lib/supabase/useLiveChannel.ts`) — the
   auth-then-subscribe dance in exactly one place: getSession →
   `realtime.setAuth` → one channel with N table specs → cleanup; optional
   poll fallback. The original bug existed precisely because this code was
   hand-copied with the auth step lost — it can't be lost again.
5. **ScheduleShell + FCFSShell** refactored onto the hook (behaviour
   identical, 2-min polls kept as fallback).
6. **Migration 0043** — `job_assignees` + `job_tasks` into the publication,
   `replica identity full` on both (idempotent, additive, applied live).
7. **Installer dashboard live** — `jobs` + `job_assignees` events →
   `router.refresh()`. RLS scopes delivery: a formal assignment appears on
   its own; a suggestion produces no event for that installer (0037 policy).
8. **Job form hybrid** — channel filtered to the open job (`jobs` UPDATE,
   `job_assignees`, `job_tasks`, `files`): task ticks + bucket files re-pull
   via a `refreshKey` prop (AttachmentBuckets + TaskListSection; task list
   skips reloads mid-drag; bucket cards keyed by id so a mid-rename survives);
   other file kinds + team changes → `router.refresh()`; a jobs-row change
   applies silently when the form is clean (a `[job]`-effect re-baselines RHF
   via `formValuesFromJob` + resyncs selection state) and shows a sticky amber
   "This job was updated — tap to reload" banner when dirty (tap = explicit
   discard). Own saves are echo-suppressed (5s window bumped by every handler
   that writes to the job) and re-baseline the form on refresh. Chat files
   (kind `attachment`, no `bucket_id`) are ignored — ChatSection owns them.
9. **Testing + rollout**: branch preview two-window tests passed (schedule,
   FCFS, job form silent-sync + banner); merged → dev (re-verified) → main.
   Installer test done on **production** with a real installer login —
   assignment appeared live, suggestion stayed hidden.

## Key decisions

- **Hybrid over banner-only or fully-silent** on the job form: any area with
  unsaved edits never changes by itself; everything clean syncs instantly.
- **Admin stays refresh-on-visit** — single-user page; bug reports already
  ping via Telegram. **Assistant untouched** — nothing external changes it.
- **New branch `feat-live-updates` off main** instead of reusing
  `feat-workflow-v2` (Nic initially suggested reusing it; kept historical per
  the 2026-08-03 rule). Now itself **archived**: historical record only, no
  new pushes — added to CLAUDE.md's branch rule.
- **ChatSection not refactored** onto the hook — it works and has bespoke
  status UI; optional cleanup later.

## Session friction worth remembering

- **Parallel-session collisions**: the other Claude window (same folder)
  switched branches mid-session — one commit briefly landed on `dev` and was
  moved back; its feat-files work also took migration numbers 0041/0042, so
  this session's migration was renumbered → **0043** mid-flight. The
  existing memory stands: parallel sessions should use a worktree.
- **Wrong-preview lesson**: first test round failed because it ran on the
  `dev` branch preview, which didn't have the code — each branch gets its own
  Vercel preview URL (`greenqubes-ops-git-<branch>-…`). Nothing was broken.
- **PowerShell `Get-Content`/`Set-Content` mangled UTF-8 docs** (em-dashes,
  arrows) during the renumbering — restored from git; use
  `[System.IO.File]::ReadAllText/WriteAllText` with explicit UTF-8 instead.

## Key files

| File | Change |
|---|---|
| `src/lib/supabase/useLiveChannel.ts` | new — shared authenticated realtime hook |
| `supabase/migrations/0043_realtime_assignees_tasks.sql` | new — publication + replica identity |
| `src/features/schedule/ScheduleShell.tsx` | onto the hook (auth fix subsumed) |
| `src/features/fcfs/FCFSShell.tsx` | onto the hook; assignee events now real |
| `src/features/installer/InstallerShell.tsx` | live refresh (jobs + assignments) |
| `src/features/job-detail/JobDetailShell.tsx` | live channel, dirty tracking, clean re-baseline, amber banner, echo suppression |
| `src/features/job-detail/AttachmentBuckets.tsx` | `refreshKey` re-pull |
| `src/features/job-detail/TaskListSection.tsx` | `refreshKey` re-pull, drag-safe |
| `src/lib/i18n/{en,zh}.ts` | `jobUpdatedBanner` / `jobUpdatedReload` (no bn, per freeze) |

Migration 0043 applied by Nic (`npx supabase db push`) before the code went live.

## ⚠️ Notes for next session

- **The full security + integrity audit remains Nic's standing priority** —
  explicitly skipped again this session (his call at session start). It has
  now been queue-jumped repeatedly; raise it first.
- **Known limitation**: `setAuth` is called once per page mount with the
  current token (~1h lifetime). A tab left open for hours may go quiet until
  a refresh — the 2-min poll on schedule/FCFS/installer covers it; the job
  form has no poll. Same limitation exists in chat since May. Revisit only if
  someone actually reports it.
- Hydration #418 on /schedule: unchanged, still off-limits — and now clearly
  distinct from the (fixed) stale-data problem it was being blamed for.
- Pre-go-live cleanup still pending (test jobs/contacts/installer TG id), plus
  the backup follow-ups from the 2026-08-12 infra sessions.
