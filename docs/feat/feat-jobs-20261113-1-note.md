---
session: feat-jobs (installer All Jobs + Team box; job Gallery; bulk move back; the old jobsheet filled by the app; chat open to the office; job groups)
date: 2026-11-10 → 2026-11-13
branch: feature branches in scratchpad worktrees (feat-bulk-move, feat-jobsheet-link, feat-job-gallery, feat-job-groups, fix-groups-minors) → dev → main; all deleted after merging
migrations: 0070_gallery_hides_and_chat_deletions, 0071_chat_open_to_office_roles, 0072_job_groups, 0073_job_groups_keep_while_used — each applied on Nic's "apply", before its code
release: installer work live 11 Nov 14:35 SGT (changelog 68732bb); f6ffbb6 live 12 Nov 20:08 (build a222744d13f8); 5de80ba live 13 Nov 16:23 (build 93aec50d674d); 8b076b8 live 18:55 (build ddb25f175111); changelog 561c167 + 005b24a (build 6866b8e57e2a)
status: LIVE — everything on production; Nic switches the real sheet to the new script, view only, at 6pm 13 Nov
---

# Gallery, job groups, bulk move back, the jobsheet, installer All Jobs

One long session over four days, through several context compactions. Each piece was built in its own scratchpad worktree from a written plan, reviewed by a fresh reviewer at the end, merged to dev, checked on the preview by Nic, then pushed to main by exact sha.

## The ask

- **Installers** (10 Nov): make their view closer to the office one, and add an **All Jobs** button to see the day's other jobs.
- **Four things in one design** (11 Nov, `docs/superpowers/specs/2026-11-11-gallery-groups-bulk-sheet-design.md`):
  1. **Bulk move back** — Nic had pushed 22 near-identical tent-card jobs into To arrange too early.
  2. **Old Google Sheet** — keep the team's "Greenqubes Jobs" sheet filled from the app during the move off it.
  3. **Job Gallery** — every photo, file and link on a job in one place, WhatsApp-style.
  4. **Job groups** — fold near-identical jobs (one campaign, many stores) into one row.
- Mid-session: "chat rule should just be open for everyone" (installers already only see their own jobs); sender's Delete for everyone limited to 24 hours and bigger viewer buttons; the sheet changed to **full automation** ("replace whole old sheet information", "including cell header", "view only", in the existing sheet); then "fix those" for the six deferred groups minors.

## What was built

- **Installer** (spec `2026-11-10-installer-team-and-panel-lines-design.md`): All Jobs (every confirmed job for a day, look-only, untimed first like My Jobs, today marked in the strip); a Team box on cards (driver / support crew / external); full address. My jobs side panel: address + description lines.
- **Bulk move back:** tick → To arrange → Ongoing (sales) or Ongoing → Drafts, one `/api/jobs/[id]/stage` call per job (max 200), so the single-job rules hold. Jobs that can't move stay ticked with the reason.
- **Gallery:** phone = fifth tab after Chat; computer = below the chat. Media | Docs | Links with counts, grouped by day, source marks, filter chips; full-screen viewer, PDFs in-app. Delete for me per person (`job_item_hides`, `chat_deletions`, 0070). Delete for everyone in `src/lib/storage/gallery-delete.ts`: scheduler/admin any time before completion; the sender within 24 hours (`OWN_DELETE_WINDOW_MS`), then only Delete for me.
- **Chat open to every office role** (0071, additive policies). Found while checking the gallery: some office roles couldn't read job chats.
- **Old jobsheet:** a private key link (Admin → Settings → Old jobsheet) serving `/api/sheet/jobs`, and an Apps Script kept in the repo (`scripts/google-sheet/jobsheet-sync.gs`) that Nic pastes into the sheet. First version wrote below a yellow bar; reworked to full automation: every hour it rewrites this week through 10 weeks ahead whole (title row, pinned column header, days, jobs), makes missing tabs in date order, never touches past weeks or non-week tabs, skips a week with two tabs. Setup guide page: https://claude.ai/artifact/UCbTw5uY9eSrNPBBedNPXF and `docs/google-sheet-jobsheet-setup.md`.
- **Job groups** (plan `docs/superpowers/plans/2026-11-12-job-groups.md`): `job_groups` + `jobs.group_id` (0072). Jobs tab only: tick → Group (name suggested from the shared start of the titles), Add to group / Remove from group, drag in and out on a computer, Rename / Ungroup inside an open group. Folded row shows name, shared company and sales person, count. Writes only via `POST /api/job-groups`; a group is readable only while it holds a job the reader can see. Duplicate keeps the group; bin restore drops a group that's gone.
- **Groups fixes** (Nic: "fix those"): create removes its group if the jobs can't move in; 0073 makes the database refuse to delete a group still holding a job (was `on delete set null`), and ungroup clears jobs first — so two people at once can't lose a job; a failed group read shows plain rows instead of erroring the tab, and runs alongside the panel query; the rename box resets during render (no stale-name frame); non-uuid ids → 400 and ids lower-cased; Jobs tab screen-reader labels and the "Untitled job" fallback translated; dragging from a title pictures the whole row (`setDragImage`).

## How it was checked

- Every change test-first; the full suite ended at **94 test files, 0 failing**, plus `tsc` and a full `next build` before each merge.
- A fresh reviewer read each finished branch; Critical/Important findings fixed with a failing test first.
- **Privacy on the live database**, with rolled-back role tests (`db query --linked`, a DO block that always raises): chat open to the office roles; the groups policy (the owner sees their group, can't write directly; another sales person sees neither the draft nor the group); 0073's rule (delete refused while a job is in the group, an empty group deletes) — nothing saved.
- Every preview and production deploy confirmed by hashing the pushed commit against `/api/version`. Release times read from production's `x-vercel-id`.
- Nic tested on the previews: the sheet script on a copy of the sheet ("works fine"), groups ("dragging works so far").

## Rulings (calls made during the build)

- Group name suggestions never cut a word in half ("Daikin" is not the start of "Daikinx Jem").
- On Ongoing, the dated and "Date to be confirmed" sections fold separately — a group can show in both.
- The My Jobs highlight blinks once per jump, after the job's group has opened.
- Remove from group runs without a confirm box (it only unfolds; easy to undo).
- Drag, rename and ungroup keep the person's ticks; Group / Add / Remove clear them. Dragging pauses while a change saves.
- Left as the design set them: ungroup also unfolds other people's private drafts in that group; groups of only scheduled/completed jobs stay in the table; admin viewing-as keeps group rights.
- Fixes: the drag picture uses `setDragImage` on the row rather than `draggable={false}` on the link (one place, works for both lists). Not mouse-selecting a title's text stays as is — links never allowed that.
- Fixes: the group-name read overlaps the scheduled-jobs query rather than being embedded in the jobs query (embedding would let a groups failure break the Jobs tab and the schedule) or unfiltered (would hit the 1,000-row cap as groups pile up).

## Deferred

- None from groups (all six fixed). The rename box and drag picture fixes can only be seen in a browser — Nic to glance at them in use.

## Deploy notes

- **The .gs script is not deployed by the app.** Any change to `scripts/google-sheet/jobsheet-sync.gs` means Nic presses Copy script (Admin → Settings) and pastes it over the old one in the sheet. Its `DEFAULT_COLUMNS` must match `SHEET_COLUMNS` (tested).
- **Any future code that deletes a group must clear its jobs first** — 0073 refuses otherwise (23503).
- A test copy of the sheet keeps filling itself hourly until deleted (in Nic's checklist).
