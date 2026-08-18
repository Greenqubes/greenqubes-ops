---
session: ux-notifications (Overdue bell alerts — rich cards, mark-as-read, team scoping)
date: 2026-08-17
branch: dev → main (all changes live on production same day)
---

# Overdue Bell Alerts + Pre-Alpha Green Light — DONE

> Session 19 pre-alpha testing PASSED clean (Nic's solo run, no issues found —
> Session 20 hotfix round skipped; next milestone is Session 21 alpha testing
> with the scheduler). Main build work: the notification drawer's overdue
> alerts went from bare-date red cards to informative, acknowledgeable,
> team-scoped alerts. Also: Bryan's stale settings commit permanently skipped.

## 1 — Session 19 pre-alpha: PASSED clean

- Nic ran the solo end-to-end pass and confirmed a clean result — no bugs, no
  fixes needed. Version stays **V.0.0.0.1**.
- Session 20 (pre-alpha feedback/hotfix) is recorded as **skipped** in
  plan.md + CONTEXT.md. Green light to bring in the scheduler.
- Prep item added to nic-checklist: provision the scheduler's account +
  Telegram chat ID before Session 21.

## 2 — Overdue bell alerts (3 commits, all in `NotificationDrawer.tsx`)

**Rich cards** (`3ab2cf1`): each overdue card now shows project title
(fallback "Untitled job", the app-wide rule), company on its own line
(**"Untitled" when the job has no company** — line only renders when a
project title exists, so no duplicate when the title already fell back to
the company), day+date as `13/08/2026 (Thu)` (Nic's pick over "Thu, 13 Aug
2026"), and location. Day/month names come from **static English tables**
(`fmtOverdueDate`, same pattern as `features/external/format.ts`) — never
`toLocaleDateString`, per the /schedule hydration saga.

**Mark as read** (`7a6df9f`): button in the drawer header (shows whenever
anything is red/unread; replaces the old "Mark all read" which only covered
in-app notifs). One press greys all overdue cards (read-notif styling),
returns the bell to grey, clears the badge, and marks the Updates section
read. Persistence is **per device per user**: localStorage key
`overdue-seen:{auth user id}` mapping `job_id → date`. A card is read only
while the stored date matches the job's date — **rescheduling an overdue job
to a new overdue date re-alerts**. The map is pruned to the current overdue
list on every press, so it can't grow unbounded. Nic chose per-device over a
DB-backed cross-device version (no migration needed).

**Team scoping** (`19a6ef5`): overdue alerts now appear only for people on
the job — `sales_poc_id` (Person-in-Charge), `job_coordinators`, or
`job_assignees` with `is_suggestion = false` (**a suggested installer never
gets the alert** — suggestions stay invisible, the standing rule).
**Scheduler + admin keep the company-wide view** (Nic's call). The query
embeds `job_assignees(user_id, is_suggestion)` + `job_coordinators(user_id)`
onto jobs — child tables, NOT `users`, so the "never embed users on jobs"
rule is respected. Current user resolved auth id → `users.id/role` with one
lookup inside `fetchOverdue`.

**Untouched by design:** the Telegram overdue cron and its recipients; the
in-app "Updates" section layout; the 3-day lookback (cron-side only — the
drawer still has no lower date bound, fine post-wipe).

## Facts worth keeping

- **Preview-as does not exercise the team scoping** — it changes the UI role
  only; the drawer checks the real DB role. Admin (Nic) always sees all
  overdue alerts by his own chosen rule. Real non-admin logins are the only
  way to see the filter act (same caveat as suggestion-hiding).
- `users` row lookup by `auth_id` works fine from the browser client (own-row
  RLS read).
- The two earlier commits and the `-s ours` merge message say "2026-08-14" —
  wrong date, the whole session actually happened 2026-08-17. Docs are
  correct; commit messages are history, left as-is.

## 3 — Bryan's settings commit permanently skipped

- `165d369` (2026-05-28, origin/dev-bryan: gitignore + untrack
  `.claude/settings.local.json` and `.claude/hooks/`) clashed with Nic's
  active edits to the same file (2026-08-12). Nic's call: **skip permanently**.
- Done via `git merge -s ours origin/dev-bryan` (merge commit `5df3d38`) —
  branch counts as merged, zero content taken, `.claude/settings.local.json`
  **stays tracked**. Session-start `git log dev..dev-bryan` check is quiet
  again; Bryan's future commits merge normally and cannot resurrect the
  deletion (it's behind the merge base now).
- NB the session-start check only looked at the *local* stale `dev-bryan`
  ref — fetching first is what surfaced the commit. Worth fetching (or
  comparing against `origin/dev-bryan`) at every session start.

## Key files

| File | Change |
|---|---|
| `src/features/notifications/NotificationDrawer.tsx` | all three changes — rich overdue cards, mark-as-read, team scoping |
| `docs/plan.md` / `docs/CONTEXT.md` / `docs/nic-checklist.md` | Session 19 PASSED / 20 skipped; session row; alpha prep item |

## ⚠️ Notes for next session

- **Session 21 alpha testing is the milestone.** Blocker: scheduler account
  setup (sign-in → provision → Telegram chat ID; digest subscriber optional).
- The go-live checklist item "paste your TG chat ID into Wei Qing's row for
  testing — remove before go-live" is still outstanding, as are the backup
  follow-ups (health event, Telegram watchdog decision, old-password sweep)
  and the test external contacts cleanup.
