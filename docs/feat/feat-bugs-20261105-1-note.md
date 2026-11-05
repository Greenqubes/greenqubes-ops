---
session: feat-bugs (auto-fixer — Claude sorts and fixes the Bug and Crashes tabs overnight; Nic approves each fix on the bug bot)
date: 2026-11-04 → 2026-11-05
branch: feat-auto-fixer (scratchpad worktree, built overnight) → dev → main; 5 Nov follow-ups on autofix-guard-redirects → dev → main
migrations: 0069_autofix.sql (applied 2026-11-05)
release: 77ddac6 live 22:40 SGT 4 Nov → 26747c3 22:50 (two-chat bot) → 0fe79c5 23:08 (RULES step 0) → 0b33ee0 23:34 (progress on request); fixes 3 + 4 merged by the bot 23:43 (build ea1cc21d624d); 51d88b5 live 18:38 SGT 5 Nov (build 384ddec87c6c)
status: LIVE — first real run sorted 22 items; fixes 3 + 4 went live through the bot
---

# Auto-fixer

Session start ran in full on 4 Nov; Nic skipped the AI-importance question, and Bryan was skipped. A parallel Claude session held the main folder on `dev` (To arrange), so everything here was built in a scratchpad worktree.

## The ask

> "is it possible connect my website to anthropic cloud services becuase i want claude to help me fix any bugs arises under bug tab automatically. i dont have time to go thru daily. in fact it should be smart enough to filter what actually needs fixing vs whats spam or not important"
>
> "plus crashes tab in admin too. it should detect and rectify because im not going to read thru it at all. i wont understand whats happening anyways."

Nic's rules, given during the design:

- **Crashes:** record who had the crash ("so i know which desk its from").
- **Wishes:** a Telegram ping with the whole report; never built.
- **Approving fixes:**
  - One Telegram per night, with a test link per fix.
  - Nic approves each fix by chatting with the bug bot ("like claude on telegram"), so the bot became two-way.
- **What's new:** a major fix pops up once on the day it goes live; minor fixes show once a week, on Monday morning. Claude decides which is which.
- **Limiter:**
  - "just fix enough to get it working again" — nothing that breaks other components.
  - If a fix can't pass after a few tries, flag it and stop, "to not burn tokens".
- **Fixer model:** Opus 5.5 at xhigh.

Spec: `docs/superpowers/specs/2026-11-04-auto-fixer-design.md`. Plan: `docs/superpowers/plans/2026-11-04-auto-fixer.md`. Nic's setup steps: `docs/autofix/SETUP.md`. The cloud's instructions: `docs/autofix/RULES.md`.

## What was built

- **The split:** the cloud judges; the app acts.
  - **The cloud** is a Claude Code routine in Anthropic's cloud:
    - API trigger only, Opus 5.5 xhigh, network limited to the app and GitHub.
    - It sorts each new bug report and crash group into fix / wish / junk / needs a session / unclear.
    - Fixes go on `claude/autofix-*` branches.
    - It never holds the database key. It talks to the app only through `/api/autofix/{inbox,report,file,progress}` with `AUTOFIX_SECRET`.
  - **The app** (`src/lib/autofix/`) does everything with power:
    - the 02:00 SGT cron, which fires only when there is new work;
    - Telegram to both admin chats, and the two-way bot (Sonnet, tools gated by `actions.ts`);
    - go-live: claim → gate (branch head equals the tested sha, limiter re-checked on GitHub's diff) → overlap check against main → merge the sha → per-minute deploy watch → sync dev, delete the branch, mark the bug fixed and resolve its crashes;
    - What's new lines, stored in the database and merged into the popup.
- **Limiter**, written once in `path-rules.mjs` and enforced twice:
  - The rules: 3 files and 60 lines excluding tests; feature screens and en/zh only; no new or removed files.
  - First check: the cloud's `PreToolUse` guard, `scripts/autofix-guard.mjs`. It does nothing unless `GQ_AUTOFIX=1`.
  - Second check: the app's gate, before Nic sees a fix and again at go-live.
- **Retry cap:** 3 tries per item. After that it goes to needs_session and the fixer stops.
- **Crashes:**
  - Each crash now records the signed-in user, the device and the build.
  - Crashes are grouped by signature: last night's 40 crashes made 10 groups.
  - A repeat crash is filed under its existing item, so it is never judged twice.
- **Migration 0069:** adds `autofix_items`, `autofix_runs` and `autofix_chat`, plus build ids on crashes and bug reports, and `closed` as a bug status. RLS is on, grants go to `authenticated` and `service_role` only, and there is a sequence grant.

## Setup, and what went wrong on the first night

- **The cloud environment must have no setup script.** It runs before the repo is cloned, so the first run's `npm ci` failed instantly at 22:54.
  - The routine was paused while Nic cleared the script on his PC.
  - RULES.md step 0 now runs `npm ci` inside the run.
  - The dead run's row had to be closed by hand: the app cannot see a run that dies before reporting.
- **The bug bot's chat id was the GreenqubesAI admin account**, not Nic's own. `TELEGRAM_BUG_CHAT_ID` became a comma list of both. Broadcasts go to both chats; a reply goes to the chat that asked.
- **The `0069` db push was refused** because the remote already had 0068 (from feat-to-arrange) and this branch didn't have that file.
  - Fix: a temporary uncommitted copy of 0068, a dry run, then push only 0069, then delete the copy.
  - `migration repair` was never used.
  - Branches without the 0069 file now get `DbPushMissingLocalError`; the fix is to bring the file in.
- **The first "push to main" pushed `origin/dev`**, which had picked up the other session's docs commit. Since then every push is by the exact sha Nic checked (memory: push the exact sha).

## First real run (23:09–23:32 SGT, 4 Nov)

- 22 items sorted:
  - 2 fixes;
  - 2 need a session: #5, the schedule heading on phones, where Nic picks what moves to a second line; and #22, a one-off crash on 9 Sep;
  - 18 closed.
- Fix 3 (major: New Job crashed when an added name was refused) and fix 4 (minor: the bottom bar hid the last buttons) went live through the bot at 23:43.
  - Dev was synced, the branches deleted, the bug marked fixed and the crashes resolved.
  - What's new: fix 3 shows on 5 Nov, fix 4 on Monday 9 Nov.
- "How's it going?" (progress on request) was built while the run was going and went live at 23:34. The fixer's one-line note sits in `autofix_runs.outcome` and is replaced by the final result.

## Morning tidy-up (5 Nov)

- **Fixer key rotated.**
  - The old key had shown in the chat: Nic highlighted the file in VS Code, and the IDE sends a selection to Claude.
  - The first new key was exposed the same way while Nic copied it.
  - The second went to the clipboard with `clip.exe`. It didn't take on the cloud side (see below).
  - Each swap was the Vercel env, then the cloud network secret, then a production redeploy.
  - Checked: the new key gets 400 (accepted), no key gets 403.
  - Every key file is deleted and the clipboard cleared.
- **Guard:** the fixer's own push may end in `2>&1` or `>/dev/null`. Run 2 had been refused for it. Only trailing redirections are dropped, so one can never hide a second ref. 62 guard tests.
- **The bot claimed it started a run when nothing ran.**
  - At 18:27 Nic wrote "Look at this now". The bot replied "Started a fresh run right now", but no `autofix_runs` row existed.
  - The run row is written before the cloud is called, so the tool was never called.
  - **Replay:** the real `autofix_chat` rows, with tools stubbed. Sonnet skipped run_now 2 times in 20, and read "Take a look now" as progress 6 times in 6. Last night's wrong advice ("ping me with 'look at this now' and I'll check progress") is still in its 20-message history.
  - **Root cause:** the history keeps only the bot's sentences, not the tools behind them, so describing an action looks like doing it.
  - **Fix:** `chat-request.ts`. The first round uses `tool_choice: any`, with a `no_action` tool for thanks and greetings. The prompt maps "take a look now" to run_now and lets the rules override earlier replies.
  - **Replay after the fix:** every phrase picked the right tool, 10–20 tries each.
  - The bot, guard and docs went live as `51d88b5` at 18:38. Nic's next "look at this now" started a real run at 18:39.
- **That run was refused: the key still didn't match.**
  - The inbox returned 403 four times. The fixer followed RULES: it retried once after a minute, stopped, and sent a phone alert.
  - The app can't see a run that dies, so the row was closed by hand.
  - Key 4 went into a file. Nic opened it in **Notepad**, not VS Code, so his selection never reached Claude. He re-added the network secret from scratch (bin → Add secret → Save changes).
  - Vercel got the same file, then a redeploy.
- **The cloud starts from a STORED copy of the repo, not a fresh clone.**
  - At 18:39 its `origin/main` was `0fe79c5`, from 23:08 the night before. "Fetching repository" in the run log did not refresh it.
  - So it read old RULES.md (no progress notes) and the old guard.
  - Fix: the routine's prompt now begins `git fetch origin main && git checkout -B autofix-base origin/main`, then RULES.md. The change was made via RemoteTrigger update; model, effort, environment and tools are unchanged.
  - Fix branches always started from a fresh `origin/main` anyway (RULES step 1). Only the rules and guard the run follows were stale.
- **Check run, 18:48–18:49:**
  - fetched `0fe79c5..51d88b5`;
  - inbox 200;
  - two progress notes accepted;
  - today's iPhone "Load failed" on /installer sorted as junk (dropped connection, older build);
  - report applied, Telegram sent;
  - 77 seconds in all.
- Merged branch `feat-auto-fixer` deleted on GitHub and locally (Nic: once all checks pass).

## Verification

- 80 suites green; `tsc` clean.
- `/api/version` hashed against the pushed sha before each "it's live".
- Release times decoded from `x-vercel-id`: 18:38 SGT on 5 Nov.

## Process notes

- The IDE sends Nic's text selections to Claude. Give Nic a secret as a file to open in **Notepad**, never in VS Code.
- To check a key change end to end, start a run and read its log (RemoteTrigger `list_runs` → `get_run_log`), together with `vercel logs --json`. The app's 403s are the only sign of a mismatch.
- The permission classifier refused two things:
  - editing CLAUDE.md's deploy rule as self-modification, until Nic approved the wording;
  - `vercel env pull` as credential materialization.
- Shell heredocs passed to `node -` lost backslashes in regexes. Use the Edit tool for code with backslashes.
- This repo has no ESLint config, so `next lint` asks to set one up. `tsc` and the suites are the checks.

## Next

- #5, the schedule heading on phones: a session once Nic decides the layout.
- Auto-fixer page in Admin (checklist, To build).
- Vercel → Settings → Deployment Retention for Preview, about 2 weeks, so old test links expire.
- Deferred and agreed to leave: double "is live" message, old retry branches, popup timing, What's new line on a retried live fix, pre-migration log noise.
