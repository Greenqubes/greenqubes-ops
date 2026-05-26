# Setting Up Nightly Obsidian Sync on Server PC

Do this when you're on the server PC. Takes about 5 minutes.

---

## Step 1 — Pull the latest repo

You don't need VS Code or Claude for this — just open **PowerShell** directly.

Press the **Windows key**, type **PowerShell**, open it. Then run these one at a time:

```
cd C:\Greenqubes_GitHub\greenqubes-ops
git pull
```

This downloads the `scripts/nightly-obsidian-sync.bat` file onto the server PC.

---

## Step 2 — Open Task Scheduler

Press the **Windows key**, type **Task Scheduler**, open it.

---

## Step 3 — Create a new task

Click **"Create Basic Task…"** on the right side panel.

- **Name:** `Greenqubes Obsidian Sync`
- Click **Next**

---

## Step 4 — Set the trigger

- Select **Daily**
- Click **Next**
- Set time to **2:30 AM**
- Click **Next**

---

## Step 5 — Set the action

- Select **"Start a program"**
- Click **Next**
- In the **Program/script** box, paste exactly:

```
C:\Greenqubes_GitHub\greenqubes-ops\scripts\nightly-obsidian-sync.bat
```

- Leave all other boxes blank
- Click **Next** → **Finish**

---

## What this does every night at 2:30 AM

1. Pulls the latest vault files from GitHub (including any auto-written digest notes)
2. Embeds all vault notes and syncs them to Supabase so the AI assistant can retrieve them

The backup task already runs at 2:00 AM — this runs 30 minutes later so they don't overlap.
