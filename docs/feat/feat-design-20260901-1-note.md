---
session: feat-design-2 (Design Load fix round 3 → LIVE on production)
date: 2026-09-01
branch: feat-designer-load-flow → dev (4e90c7b) → main (3577064) — production probed green; worktree removed, branch kept for history
---

# Design Load — fix round 3, merged, live; test data wiped

> Yesterday's queue was B3 + edits 15/16. Nic's re-test grew it to edits 17–19
> (every due-date event now notifies designers), then his merge call, then a
> test-data wipe that the dry run turned from "all jobs" into "9 of 17".

## 1 — B3: the Telegram that "didn't send" (root cause, not a code bug)

Evidence came from the database, not the code — every branch of the send
path read correctly, so I stopped reading and probed (read-only, via REST):

| SGT, 2026-08-31 | What happened | Why no Telegram |
|---|---|---|
| 11:42 | Install date moved **earlier** on Test1 | Only designer: **Wan Jun** — `telegram_chat_id` is NULL. Bell row written; nobody to send to. |
| 11:55:57 | Nic assigned himself | `design_assigned` Telegram logged at 11:55:59 → token, chat id, send path all fine on this preview |
| 11:56:58 | Install date moved **later** | Bell rows for all three designers (Nic's since cleared); Telegram blocked by the **earlier-only rule** |
| 11:57:23 | A third move | No shift at all — the typed-due-date prompt was answered *Keep* → nothing fires, by design |

**Fix:** Telegram on **every** shift (Nic's rule); the silent `catch {}` now
logs `[jobs/patch] … notify failed`, and a warn fires when no designer on the
job has a chat id. Spec + template comments updated.

## 2 — Edits 15–19

- **15 — edge snap** (`useDraggableFab.ts`): on drop the button slides
  (220 ms) to the nearer side edge, 16 px in (= its default `right-4`),
  vertical kept; the snapped spot is persisted; stored/resized positions
  re-snap. Self-review caught a flaw: judging "nearer edge" by the old x
  against the *new* width flips a right-snapped button left when the window
  widens — fixed by judging against the viewport width the position was laid
  out in (`laidOutWidthRef`).
- **16 — copy**: "This marks the design work as done — no design rating is
  recorded." (en + zh).
- **17 — install moved, due kept** → new type `design_install_shift`, bell +
  Telegram "Install Date Moved … Due date: X (unchanged)" (or "not set").
- **18 — cleared due date came back** → root cause: the PATCH route echoed
  `updates.design_due_date ?? job.design_due_date`; a cleared date is NULL in
  `updates`, `??` returned the OLD date, the form re-adopted it and wrote it
  back on the next save. The DB was cleared correctly; the AI scorer was not
  involved (a cleared date is flagged manual, which it respects). Fixed the
  echo; `|| null` guards `''`; a clear now beats the auto-shift in the same
  save. New type `design_due_removed` → "Design Due Date Removed — removed
  (was X)".
- **19 — due date set/changed by hand** → new type `design_due_set` →
  "Design Due Date Set" / "Changed" (old → new). Not sent when "use shifted
  date" discarded the typed value — the Moved message covers that.

Route now decides one of four kinds per save (`due_shift` / `install_shift`
/ `due_removed` / `due_set`); the drawer has a card per type (four
near-identical blocks — consolidation ledgered below). No migration:
`notifications.type` is plain text.

## 3 — Merge (clean cut, like V2)

`feat-designer-load-flow` → `dev`: 90 files, 3 doc conflicts
(`CONTEXT.md`, `plan.md`, `nic-checklist.md` — dev's 2026-08-31 auth text vs
the branch's older "Last updated" lines) resolved dev-side; `en.ts` merged
itself. Type-check + build + all 14 suites (232 checks) green on the merged
tree → pushed `dev` (4e90c7b) → `main` (3577064). Production probes ~80 s
later: `/api/design-load` 401 (new route, self-guarded), `/design-load` and
`/schedule` 307 → login, overdue cron 403, `design-daily` cron 401 (refuses
without `CRON_SECRET`), `/ext/*` 200, `/login` 200.

## 4 — Test-data wipe

One-off `scripts/wipe-test-data.mts` (dry-run default, `--execute` to
delete; deleted after use like the 2026-08-13 wipe). **The dry run listed 17
jobs — 8 are real client work** (Luxottica, Fossil, Onitsuka Tiger, ASICS,
Aydan Co; created 18–26 Aug, several completed). Script switched to an
explicit allowlist of 9 id prefixes that aborts on a count mismatch and prints
what is KEPT. Nic confirmed the 9 (incl. two carrying real client names).
Deleted: 9 jobs + cascade (10 files, 1 message, 36 buckets, 5 assignees, 8
designers, 21 design_scores, 26 notifications incl. planted reminders) + 10
R2 objects (13.5 MB). Verified 0 remaining; 8 real jobs untouched.

## Facts worth keeping

- **Test designer accounts Wan Jun / Yu Fei have no Telegram chat id.** Any
  Telegram test needs Nic's own account as an assigned designer, and a save
  that actually changes something.
- R2 keys are `jobs/{r2_folder}/{kind}/{uuid}.ext` (pre-0042 jobs:
  `jobs/{id}/…`) — a prefix without the leading `jobs/` lists nothing.
- One-off scripts with top-level `await` must be `.mts` (the repo compiles
  `.ts` scripts as CommonJS). Invocation:
  `node --use-system-ca --import tsx --env-file=.env.local scripts/<file>.mts`.
- `git worktree remove` on Windows can fail with "Permission denied" after
  detaching the folder — `git worktree prune` + `rm -rf` finishes the job.
- Never wipe "all jobs" from a description — the dry run is what caught the
  8 real jobs.

## Follow-ups ledgered (quiet session)

- Consolidate the four design notification cards in `NotificationDrawer.tsx`
  into one helper (identical shells, only the lines differ).
- Earlier ledger still stands: portal the NotificationDrawer like NavDrawer,
  de-duplicate the double-mounted bell/profile fetches, remaining
  hover-reveal buttons in 3 files, extract `DesignerActionBar` from the 1.7k-line
  `JobDetailShell`.

## ⚠️ Next session

- **2026-09-02 08:30 SGT — first real `design_daily_cron` run** should show
  in Admin → Health. Nic checks; if missing, investigate.
- Seven small Design Load owner decisions remain in nic-checklist.md.
- Backlog unchanged: mobile app spec review; filing-only Office attachments;
  Office-file reading (dependency OK needed); instant vault→KB promotion;
  Telegram watchdog; backup event logging; lower-priority security hardening.
