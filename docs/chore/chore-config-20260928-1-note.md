---
session: chore-config (checklist tidy + PC/GitHub housekeeping)
date: 2026-09-28
branch: dev (docs only)
migrations: none
release: none — nothing reached main
---

# The checklist was the problem

> Nic, after the session-start list ran to ~85 items: "go thru one by one with
> me. lets tidy this list up. its too long." Then, mid-session: "today we work
> on housekeeping only. lets not execute any hard coding around that disturbs
> the main app."

## 1 — The tidy

Every unticked item under "Pending — Next Session" in `docs/nic-checklist.md`
was put to Nic in small batches with a recommendation each (keep / drop /
merge / done). ~85 items became ~25, grouped as:

- **To build** — the real feature queue
- **Quiet-session cleanups** — unused columns, orphaned R2 files, the 3-item
  security tidy-up, the Telegram watchdog
- **Only you** — Connect Summary chase, watching the digest, January holidays
- **Parked** — Voice PA, mobile app
- **Someday ideas** — one line each, no checkbox

Dropped in bulk: items whose date had passed (first cron runs, demo-day tour
corrections, onboarding for a team already using the app), "awareness" notes
that asked nothing of Nic, and duplicates. Nothing was destroyed — the whole
old section is kept word for word in `docs/nic-checklist-archive-20260928.md`
for the reasoning behind each item.

**Going forward:** add new pending items into those groups as one-liners, not
as another long per-session section. That growth is what made the list
unreadable.

## 2 — Parallel sessions collided on the same file

Two other sessions shipped the same day (Support crew filter, and pending
privacy + the Job Bin) and both edited `nic-checklist.md`. The first tidy
commit was made on an older `dev` and would have conflicted with all of it,
so it was rebuilt on the latest `origin/dev`: their five Bin follow-ups kept
at the top of Pending, their shipped Support crew items taken off, and only
"External installers on the New Job form" carried forward.

**Lesson:** fetch `origin/dev` immediately before restructuring a shared doc,
not at the start of the session.

## 3 — Housekeeping done

| What | Checked first |
|---|---|
| `C:\Greenqubes_GitHub\greenqubes-ops-voice-pa` removed | clean, HEAD = `origin/feat-voice-pa`; branch kept on GitHub |
| `C:\Greenqubes_GitHub\greenqubes-ops-hr-leave` removed | clean, HEAD contained in `origin/dev` + `origin/main` |
| `greenqubes-ops-workflow-v3` folder | already gone |
| `feat-provision-organisation` deleted on GitHub | nothing on it missing from `main` |
| Test external contacts | none left — only CK and Fu, real contractors on real completed jobs |

## 4 — Held on purpose

The Files-tab attachment folders getting the photo sections' 24-hour delete
window (`canManageJobFiles`). Nic said yes, but the day was housekeeping only,
so it is first under To build.

## ⚠ Next session

- Files-tab 24-hour window — approved, one small code change.
- Still standing: telling the crew when a scheduled job changes.
