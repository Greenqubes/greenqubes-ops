---
session: feat-jobs (chat on Ongoing jobs, multi-file chat, gallery batch download, multi-day jobs not red)
date: 2026-11-18 → 2026-11-19
branch: dev (worked in the main folder) → main on Nic's "push to main", pushed by sha
migrations: none
release: 3114579 live 19 Nov 12:44 SGT (build dff12c0ffc67; the four pieces in 3915368, the download-naming fix in 3114579); What's new for 19 Nov committed to dev, waiting on its own "push to main"
status: LIVE
---

# Chat on Ongoing jobs, multi-file chat, gallery batch download, multi-day jobs not red

Four asks from Nic in one sitting, built test-first on `dev`, checked on the dev preview, then a fifth fix from his test before it went live. The AI importance question was skipped at session start (Nic's call).

## The asks

- "update job chat to enable during ongoing status": chat opens on Ongoing jobs; Drafts stay locked (stated default, no objection).
- "allow multiple attachments selection for job chat".
- "allow multiple selection to batch download from gallery too".
- "a job with multiple day shouldn't be flagged red as it's an ongoing job, only after completion": red / overdue only once past the last day and still not completed.
- From his preview test: batch-downloaded photos shared a name, so the phone asked to replace the first one.

## What was built

- **Chat by stage, one rule:** `chatOpenAtStage` (`src/lib/utils/job-stage-rules.ts`), every stage except draft. The lock was only ever on screen (`JobDetailShell` passed draft OR ongoing); RLS 0071 and the messages route never check the stage. ChatSection's prop is now `draftLocked`; the banner key is `chatDraftMessage` (en + zh; bn falls back to English, per the freeze).
- **Several files per chat pick:** the input takes `multiple`; every file goes through the checked `uploadJobFile` (kind `attachment`). Before, a failed upload or PUT still showed in chat as sent. One `{ kind: 'attachment', count }` POST per batch; the route clamps it (`attachmentNotifyCount`, 1–50) and adds it to the unseen total, since `countUnseenMessages` counts message rows only. Toast via `batchSummary` (all / "Sent 2 of 3. Not sent: …" / failed with reason).
- **Gallery batch download:** a Download button beside Delete in Select mode. `saveFileToDevice` (`gallery/useSignedUrls.ts`) saves each file in the page (signed link → blob → `<a download>`), because browsers block every new tab after the first. Names from `galleryDownloads` (`src/lib/utils/gallery.ts`): a name with no ending borrows the stored file's (voice notes are all "Voice note"); same-named files, ignoring capitals, are numbered (2), (3)… oldest first over the WHOLE gallery, so a file has one name in any batch.
- **Overdue, one rule:** `isOverdue` (`src/lib/utils/overdue.ts`) — overdue only past the last day (`date_end` when later than `date`), or past `time_end` on that day. Used by the schedule card and date strip, the bell and the overdue Telegram cron. `getOverdueJobs` counts its 3-day lookback from the last day. The bell took "today" from UTC, so before 8am it used yesterday; it now uses the device's local date.

## How it was checked

- Test-first; new suites for overdue (16 checks), chat attachments, batch summary, plus gallery download naming (12 checks). 99 test files, 0 failing; `tsc` and `next build` clean (build not re-run for the small naming fix; the preview built it).
- Live read-only run of the overdue Telegram's query: 10 jobs read, overdue 5 → 4. The one dropped was the running 16–19 Nov job; none added.
- The naming bug confirmed on live data: 5 files in one job all "Nicholas 18 Nov 2026 12:53.jpeg".
- Dev preview and production each confirmed by hashing the commit against `/api/version`. Release time from production's `x-vercel-id`.

## Rulings

- Drafts keep chat locked; only Ongoing opens up.
- Batch download numbering: the oldest keeps the plain name (the usual (2), (3) convention), counted across the whole gallery rather than the ticked batch.
- The Telegram count is capped at 50 per batch so a bad request can't inflate it.

## Deploy notes

- A docs-only commit from a parallel window (8e46560, the "when to suggest ultracode" rule in CLAUDE.md) sat on `dev` between the feature commits and rode along to `main`.
- Main got exactly 3114579, a fast-forward from e61f33c; it also carried the previous session's two docs commits.
- The 19 Nov What's new was written after the release (its time comes from production), so it waits on `dev` for its own "push to main".
