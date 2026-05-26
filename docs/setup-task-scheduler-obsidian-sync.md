# Setting Up Nightly Obsidian Sync on Server PC

Do this when you're on the server PC. Takes about 10 minutes.

**Repo path on server PC:** `C:\greenqubes-ops`

---

## Step 1 — Open PowerShell

Press the **Windows key**, type **PowerShell**, open it.

---

## Step 2 — Clone the repo

```
cd C:\greenqubes-ops
git clone https://github.com/Greenqubes/greenqubes-ops.git .
```

The `.` at the end clones into the current folder (not a subfolder).

---

## Step 3 — Install dependencies

```
npm install
```

This takes a few minutes. Wait for it to finish.

---

## Step 4 — Copy your `.env.local` file

Copy `.env.local` from your workstation and paste it into:

```
C:\greenqubes-ops\.env.local
```

---

## Step 5 — Update the bat file paths

Open this file in Notepad:

```
C:\greenqubes-ops\scripts\nightly-obsidian-sync.bat
```

Replace its contents with:

```bat
@echo off
cd /d C:\greenqubes-ops\vault
git pull

cd /d C:\greenqubes-ops
node --use-system-ca --env-file=.env.local node_modules/.bin/tsx scripts/obsidian-sync.ts
```

Save and close.

---

## Step 6 — Test the bat file manually

In PowerShell, run:

```
C:\greenqubes-ops\scripts\nightly-obsidian-sync.bat
```

You should see it pull the vault from GitHub, then show `✓` lines as it embeds each note. If it works, move to Step 7.

---

## Step 7 — Open Task Scheduler

Press the **Windows key**, type **Task Scheduler**, open it.

---

## Step 8 — Create the task

Click **"Create Basic Task…"** on the right side panel.

- **Name:** `Greenqubes Obsidian Sync`
- Click **Next**

---

## Step 9 — Set the trigger

- Select **Daily**
- Click **Next**
- Set time to **2:30 AM**
- Click **Next**

---

## Step 10 — Set the action

- Select **"Start a program"**
- Click **Next**
- In the **Program/script** box, paste:

```
C:\greenqubes-ops\scripts\nightly-obsidian-sync.bat
```

- Leave all other boxes blank
- Click **Next** → **Finish**

---

## What this does every night at 2:30 AM

1. Pulls the latest vault files from GitHub (including auto-written digest notes)
2. Embeds all vault notes and syncs them to Supabase so the AI assistant can retrieve them

The backup task already runs at 2:00 AM — this runs 30 minutes later so they don't overlap.
