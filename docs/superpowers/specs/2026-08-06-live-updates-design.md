# Live Updates Everywhere

**Date:** 2026-08-06
**Status:** Approved by Nic (pending spec review)
**Branch:** `feat-live-updates` (off latest `main`; `feat-workflow-v2` stays a historical record per the 2026-08-03 rule)

---

## Problem

Nic reported the site feels unresponsive — changes often don't appear until a
manual refresh. Investigation this session found the root cause: the realtime
listeners on the schedule page and FCFS board subscribed **without the user's
login token**, and the `jobs` RLS policy only delivers events to authenticated
listeners — so live refresh never fired and both pages fell back to their
2-minute poll. The job chat had the identical bug and was fixed on 2026-05-19
(`realtime.setAuth()` before subscribe), but only for chat. That fix is now
applied to both shells (first commit on this branch).

Three gaps remain:

1. **Assignments and task ticks are never broadcast at all.** The
   `supabase_realtime` publication contains only `jobs`, `messages`, `files`
   (migrations 0009/0010). `job_assignees` and `job_tasks` are missing — the
   FCFS board's assignee listener has been waiting for events that never come.
2. **The installer dashboard has no live update mechanism** — data is fresh
   only on page load. An installer doesn't see a newly assigned job until they
   reopen the page (the Telegram ping is the only nudge).
3. **The job form is live for chat only.** Attachments, task ticks, status,
   and team changes made by someone else don't appear while the form is open.

## Decisions made during brainstorming (Nic, 2026-08-06)

- **"Everything instant" where it means something.** Installer dashboard and
  job form go live. **Admin stays as-is** (fresh on every visit; only Nic uses
  it; new bugs already ping via Telegram). **Assistant needs nothing** — it is
  per-user private data that streams in real time already.
- **Job form uses the hybrid rule:** any area with unsaved local edits never
  changes by itself; everything clean updates instantly. If an outside change
  touches typed fields while the form is dirty, show an amber
  "This job was updated — tap to reload" banner instead of clobbering typing.
- **One shared piece of plumbing**, not four hand-copies — this bug existed
  precisely because the setAuth step was lost in a copy. Schedule + FCFS
  shells are refactored onto the shared hook; chat keeps its working
  implementation (it has bespoke status UI; refactor is optional later).
- Built on `feat-live-updates` off `main`, with its own Vercel preview; merges
  `→ dev → main` per the normal workflow once Nic's smoke test passes.

---

## Design

### 1. Migration 0041 — broadcast assignments + task ticks

Same idempotent pattern as 0009/0010: add `job_assignees` and `job_tasks` to
the `supabase_realtime` publication and set `replica identity full` on both.
Purely additive — production code is unaffected until the UI listens, so it is
safe to `db push` while `main` is still live. Event delivery respects RLS
per-row: installers only receive their own formal (non-suggestion) assignee
rows (0037 policy), so suggestion secrecy is preserved; office roles receive
everything.

### 2. Shared hook — `useLiveChannel`

New file `src/lib/supabase/useLiveChannel.ts` (client hook):

```
useLiveChannel({
  name:    'job-form-live',                                  // channel name, unique per caller
  tables:  [{ table: 'jobs', event: 'UPDATE', filter: 'id=eq.<jobId>' },
            { table: 'job_tasks', filter: 'job_id=eq.<jobId>' }, …],
  onEvent: (payload) => …,       // fires per delivered change
  pollMs?: 120_000,              // optional fallback poll (calls onPoll)
  onPoll?: () => …,
})
```

Internally it does, in order: create browser client → `auth.getSession()` →
`realtime.setAuth(access_token)` → subscribe one channel with all table specs →
cleanup (remove channel + clear poll) on unmount. The `active` guard prevents
subscribing after unmount. This is the only place the auth dance lives.

Callers after this feature: `ScheduleShell`, `FCFSShell` (both refactored —
behavior identical to the fix already on this branch), `InstallerShell` (new),
`JobDetailShell` (new). `ChatSection` unchanged.

### 3. Installer dashboard goes live

The installer page is server-rendered; `InstallerShell` adds the hook
listening to `jobs` and `job_assignees` (all events) → `router.refresh()`,
plus the 2-minute fallback poll. RLS scopes events to the installer's own
jobs. A new formal assignment inserts a `job_assignees` row that passes their
policy → event → refresh → job appears on its own. Suggestions don't match
their policy → no event → stay hidden (correct).

### 4. Job form goes hybrid

`JobDetailShell` adds the hook filtered to the open job:

- `jobs` UPDATE, `filter: id=eq.<jobId>` — fields + status
- `job_assignees` all events, `filter: job_id=eq.<jobId>` — team changes
- `job_tasks` all events, `filter: job_id=eq.<jobId>` — task list
- `files` all events, `filter: job_id=eq.<jobId>` — attachments/photos; rows
  the chat already handles (kind `attachment` without `bucket_id`, voice,
  chat photos) are ignored here to avoid double-handling

**The hybrid rule — "clean syncs, dirty warns":**

- **Form clean** (no unsaved typed fields, no pending installer/sub
  selection): apply silently — `router.refresh()` + re-baseline the form from
  the fresh server values, and section components sync from refreshed props.
- **Form dirty**: never touch the user's edits. Show a slim amber banner
  (respecting the overlay z-rule) — i18n keys in en + zh only (bn freeze):
  "This job was updated by someone else — tap to reload". Tapping reloads
  fresh values (discarding is explicit, never silent). Banner clears on tap
  or on the user's own successful save.
- **Own-action echo guard**: the user's own saves/uploads produce events too;
  a short suppression window around own mutations (and the existing
  post-save `reset`) prevents self-triggered banners.
- Sections that keep local working state (attachment buckets, task list, team
  grid) follow the same rule individually: clean → sync, mid-edit → leave
  alone until the trigger resolves. Exact per-section wiring is an
  implementation-plan detail.

### 5. Explicitly out of scope

- Admin page (Nic's call — refresh-on-visit is enough).
- Assistant (nothing external ever changes it).
- New-job page pre-save (no job exists yet for others to touch).
- ChatSection refactor onto the hook (works today; optional later cleanup).
- External `/ext/[token]` pages (no Supabase session — different auth model).

---

## Testing (on the branch preview, two windows / phone + PC)

1. **Schedule**: change a job in window A → window B updates within ~2s.
2. **FCFS**: assign/unassign an installer in A → board B updates within ~2s
   (proves migration 0041 + auth fix together).
3. **Installer dashboard**: assign a job to the logged-in installer → it
   appears on its own; a *suggestion* must NOT appear.
4. **Job form, clean**: in B tick a task / upload a bucket file / change
   status from A → B shows it live without touching the typing areas.
5. **Job form, dirty**: start typing in B, save a field change from A → amber
   banner in B, typed text intact; tap → fresh values load.
6. **Regression**: job chat still live; type-check + production build green.

Rollout: Nic runs `npx supabase db push` for 0041 (safe pre-merge), tests the
preview, then merge `feat-live-updates → dev` (preview check) `→ main`.
