---
session: feat-installer (photo-section deletes standardised + Translate button)
date: 2026-09-28
branch: dev → main (16505f6, changelog a08eb34)
migrations: none
release: 20:36 SGT
---

# Wrong photo, no way back

> Nic, with a screenshot of an installer's completed job: "i need to include
> installer delete button for wrong photo attachments."
>
> Two features shipped. The first is the one worth reading: the bug was not
> a missing button so much as a lock that closed at exactly the wrong moment.

## 1 — What actually happened, from the rows

The screenshot was Xiao Yi's job of 25 Sept ("Fossil Mustafa Set Up").
The live `files` rows told the story in timestamps:

| SGT | What |
|---|---|
| 18:08:50 → 18:09:09 | 4 photos into **Signed DO** |
| 18:09:29 → 18:09:31 | 3 of the same photos into **Completion Photos** |
| 18:10:03 | **Completed** pressed |

Site photos in Signed DO, noticed afterwards. Two reasons there was no bin:

1. **Signed DO had never had a bin for anyone.** `UploadSection` takes a
   `canDelete` prop; the Signed DO instance simply never received one. The
   server would have allowed office staff; the screen never offered it.
2. **The 2026-09-14 installer exception locked on completion.** Installers
   press Completed on site, seconds after uploading, so the one moment they
   could fix a mistake closed before they looked.

Checking the rows first mattered: the obvious reading of the screenshot was
"installers need a bin", and they already had one — it was the timing.

## 2 — The rule, as Nic set it

Offered three options (grace window / any time / office-only), Nic took the
24-hour window and then widened it in one reply:

- **Ownership dropped** — "lets allow colleague to delete each other
  uploads. it doesnt matter now."
- **Office staff get the same window** — "lets standardize it."
- Signed DO has no minimum; open jobs have a bin too.

So for **Production Photos, Signed DO and Completion Photos**:

- anyone permitted there may remove **any** upload;
- while the job is open, **and for 24 hours after `completed_at`**;
- installers get Completion + Signed DO, office staff all three, the
  designer stays view-only;
- **a completed job keeps its last completion photo** — the job was only
  allowed to complete because it had one. Kept as a rule even though Nic
  did not raise it, and stated to him before building.

**Not included:** attachment buckets on the Files tab. `canManageJobFiles`
still locks them on completion. Offered to Nic as a one-line extension.

## 3 — How it's built

- `canDeleteJobFile` in `src/lib/storage/job-file-permissions.ts` is the
  single gate. `canDeleteOwnUpload` and the `not-owner` reason are gone.
- `/api/files/[id]` now reads `completed_at` and, only for a completion file
  on a completed job, counts the OTHER completion files. A failed count is
  treated as zero — refusing is the safe side.
- The job form calls the same function per file. **Its bins are deliberately
  not gated on `readOnly`**, which turns true the instant a job completes —
  gating on it is precisely how the old version locked too early.
- A job completed with no `completed_at` (older data) gets no window.

**The test was run against the old rule first: 21 failures**, including both
halves of the reported case (Signed DO an hour after completion, completion
photo an hour after completion). Then the rule was written and they passed.

## 4 — Translate

Nic's second note, mid-build: a button beside Suggest that translates Job
Description into the viewer's profile language.

Decisions:

- **Display-only, never written back.** A description is shared by the whole
  team; a Chinese-speaking installer's translation overwriting it would
  switch the language for sales and the scheduler. Nobody asked for this
  distinction — it was the design question, raised and accepted.
- **Also on the installer's read-only box**, which has no Suggest: installers
  are the people the feature is for.
- **Bengali gets Bengali** (Nic confirmed). The bn freeze covers hand-written
  UI strings; this is machine-translated content. The button's own label
  still falls back to English for bn.
- **English profiles get no button** (Nic: "english not necessary").
- The target language is read from the caller's own `users.lang` **on the
  server**, never taken from the request.
- Haiku 4.5, temperature 0; names, addresses, dates and numbers kept as
  written; usage logged as `ai/translate`.

Verified on a **real** description pulled from the DB rather than invented
text. Shop names and a person's name survived in both languages. Bengali left
"level 6 warehouse" in English, reading it as a place name — reported, not
tuned, since that is Nic's call once the team has used it.

## 5 — Working alongside another session

A second Claude session held the main folder on `dev` with unpushed
job-bin / pending-privacy work. All of this session ran in a scratchpad
worktree from `origin/dev`; the main folder was never touched. `main` was a
clean fast-forward to `dev` (only this session's two commits ahead), so the
other session's unpushed work could not ride along to production by accident.

Deleting the worktree failed with **"Filename too long"** — `node_modules`
paths exceed Windows' limit. `rmdir /s /q "\\?\<path>"` then
`git worktree prune` cleared it.

## Facts worth keeping

- **Photo-section deletes: one gate, `canDeleteJobFile`, open + 24h after
  `completed_at`, anyone permitted, last completion photo kept.** Buckets
  are not part of it.
- **Never hide those bins with `readOnly`** — it is true from the moment of
  completion.
- **Translate is per-viewer and never saved**; language from `users.lang`
  server-side.
- **Read the rows before designing the fix** — the timestamps showed the
  lock timing, not a missing button, was the real problem.

## ⚠ Next session

- Still standing from 2026-09-17: **telling people when a scheduled job
  changes**.
- Nic's choice: extend the 24 hours to attachment buckets?
