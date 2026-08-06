# Server PC — Obsidian Sync Health Check

> Created 2026-08-03. The nightly vault sync last succeeded on **7 June, 2:30 AM** and has been
> silent since. Everything testable from Nic's machine (script, database, keys) works — the
> problem is on the server PC. This checklist finds out what happened. Bring your phone:
> a photo of each screen is all Claude needs.

**Time needed: ~15 minutes. Nothing here changes anything — it's all just looking.**

---

## Part 1 — Was the PC really on all night? (3 min)

- [ ] **1. Wake the PC and sign in.** Before you touch anything else, notice: after you enter
  your password, are your old windows and programs still open from before?
  - Old windows still there → the PC was just locked. Good sign.
  - Everything opens fresh / empty desktop → the PC **restarted** at some point and was sitting
    at the sign-in screen. Scheduled tasks may not run in that state. Important clue — note it.
- [ ] **2. Check how long the PC has been on.** Right-click the taskbar → **Task Manager** →
  **Performance** tab → click **CPU** → find **"Up time"** near the bottom.
  📸 Photo it. (If up time is short, the PC restarted recently.)

## Part 2 — Did the OTHER nightly job keep running? (2 min)

The same PC runs your 2:00 AM backup. If it also died around 7 June, the whole machine's
scheduled tasks stopped together (points to the sign-in problem). If backups are current,
only the vault sync is broken (points to a GitHub login problem).

- [ ] **3.** Open **`E:\Greenqubes-Archive\db`** in File Explorer. Sort by **Date modified**.
  📸 Photo the newest few files with their dates.
- [ ] **4.** Same for **`E:\Greenqubes-Archive\r2`** — newest date modified.
  📸 Photo.

## Part 3 — What does Task Scheduler say? (4 min)

- [ ] **5.** Press Start, type **Task Scheduler**, open it. Click **Task Scheduler Library**
  in the left panel.
- [ ] **6.** Find the **vault sync task** (name mentions obsidian / vault / sync — it was set
  for 2:30 AM daily). Also find the **backup task** (2:00 AM).
- [ ] **7.** For each of the two tasks, capture these columns:
  **Status** (Ready / Disabled / Running), **Last Run Time**, **Last Run Result**,
  **Next Run Time**. 📸 One photo showing the row is perfect.
  - If Status says **"Running"** — the task may have been stuck for weeks waiting for a GitHub
    login. Don't end it yet, just note it.
- [ ] **8.** Double-click the vault sync task. On the **General** tab, look at the security
  options: is **"Run only when user is logged on"** or **"Run whether user is logged on or
  not"** selected? 📸 Photo this tab.

## Part 4 — Is the vault copy stale? (2 min)

- [ ] **9.** Open **`E:\greenqubes-ops\vault`** in File Explorer.
  - See a folder called **"Table of Content"** → the copy is reasonably current.
  - See old folders like **suppliers / digest / clients** at the top level instead → the copy
    is frozen in early June: the GitHub download has been failing. 📸 Photo the folder list.

## Part 5 — One live test (4 min)

This tests the GitHub connection directly.

- [ ] **10.** Press Start, type **cmd**, open **Command Prompt**. Type these lines, pressing
  Enter after each:
  ```
  E:
  cd \greenqubes-ops
  git status
  ```
  📸 Photo the first few lines it prints (it names which "branch" this copy follows —
  Claude needs this before the next fix step).
- [ ] **11.** Now test the vault download:
  ```
  cd vault
  git pull
  ```
  Watch what happens — this is the key moment:
  - Finishes with file names or "Already up to date" → GitHub connection is fine.
  - **A browser window pops up asking you to sign in to GitHub** → smoking gun: the saved
    login expired. Sign in with the Greenqubes GitHub account and the connection is repaired.
  - Prints an error and stops → 📸 photo the message.
  - Sits there doing nothing for over a minute → it's hanging (this is what likely ate the
    nightly runs). Press **Ctrl+C**, note it, move on.

## Part 6 — Send it all to Claude

- [ ] **12.** Bring back: the up-time photo, the two backup-folder photos, the Task Scheduler
  photos, the vault folder answer, and what step 10 and 11 showed.

**Update (6 Aug):** both sync fixes (visibility reading + note splitting) are now on `main`
as well as `dev`, and the server's manual pull + sync were confirmed working on 6 Aug.
Running the sync on the server is safe — just **always run `git pull` in `E:\greenqubes-ops`
first** so it has the latest fixes. The remaining open question is only whether the 2:30 AM
scheduled task fires on its own (Parts 1–3 above answer why it stopped on 8 June).

---

## What the answers will mean (decoder)

| Finding | Meaning |
|---|---|
| Backups also stopped ~7 June + "Run only when user is logged on" | PC restarted, nobody signed back in → tasks silently stopped. Fix: sign in after restarts, or switch the task to run without login. |
| Backups current, sync task stuck "Running" or pull asks for GitHub login | GitHub login expired → pull hung → sync never finished. Fix: sign in once, then re-run. |
| Task says Disabled or Last Run Result is an error code | Windows stopped the task itself — the code tells Claude exactly why. |
| Vault folder shows old folder names | Confirms the pull was already failing days **before** the sync died — matches why the supplier pricelists vanished from the assistant (already restored on 3 Aug). |
