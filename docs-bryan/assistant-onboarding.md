# Assistant Onboarding Guide
# Setting Up Your Computer to Work on the Greenqubes App

Welcome! This guide walks you through everything you need to install and do before you can start making changes to the app. Follow each step in order. If something doesn't work, message Nic before trying to fix it yourself.

---

## Before You Start

You will need:
- A computer running Windows or Mac
- A stable internet connection
- The `.env.local` file from Nic (he'll send this to you separately — it contains secret keys, never share it with anyone)

Estimated setup time: **30–45 minutes**

---

## Step 1 — Install Node.js

Node.js is the engine that runs the app on your computer.

1. Go to **https://nodejs.org**
2. Click the button that says **"LTS"** (it usually says something like "Recommended for most users")
3. Download and run the installer
4. Click through all the defaults — just keep pressing Next/Continue
5. When it's done, open a terminal (see below) and type:
   ```
   node -v
   ```
   You should see a version number like `v20.x.x`. That means it worked.

> **How to open a terminal:**
> - **Windows:** Press the Windows key, type `cmd`, press Enter
> - **Mac:** Press Cmd + Space, type `terminal`, press Enter

---

## Step 2 — Install Git

Git is the tool that downloads the code and saves your changes.

1. Go to **https://git-scm.com/downloads**
2. Download the version for your operating system
3. Run the installer — click through all the defaults
4. When it's done, in your terminal type:
   ```
   git -v
   ```
   You should see something like `git version 2.x.x`. That means it worked.

---

## Step 3 — Install VS Code

VS Code is the app you'll use to read and edit the code. Think of it like Microsoft Word, but for code.

1. Go to **https://code.visualstudio.com**
2. Click **Download** and run the installer
3. Click through the defaults

---

## Step 4 — Create a GitHub Account

GitHub is where the code is stored online. Think of it like Google Drive, but for code.

1. Go to **https://github.com** and sign up for a free account
2. Send Nic your GitHub username
3. Nic will add you to the project — you'll get an email invite; accept it

---

## Step 5 — Download the Code

This copies the project from GitHub onto your computer. You only do this once.

1. Open your terminal
2. Navigate to a folder where you want to store the project. For example, to put it in your Documents folder:
   ```
   cd Documents
   ```
3. Then type this exactly:
   ```
   git clone https://github.com/Greenqubes/greenqubes-ops.git
   ```
4. Press Enter. It will download the code. When it's done you'll see a new folder called `greenqubes-ops`.
5. Open VS Code, go to **File → Open Folder**, and open that `greenqubes-ops` folder.

---

## Step 6 — Add the Secret Keys File

The app needs a file called `.env.local` to connect to the database, handle logins, and send notifications. This file is never included in the download because it contains private keys.

1. Nic will send you the `.env.local` file
2. Place it directly inside the `greenqubes-ops` folder (the same level as the `package.json` file — you'll see it listed in VS Code on the left)
3. The filename must be exactly `.env.local` — note the dot at the start

> **Important:** Never share this file with anyone. Never upload it anywhere. Never commit it to GitHub. Git is already set up to ignore it, but just be aware.

---

## Step 7 — Install the App's Dependencies

The app relies on a lot of small helper packages. This step downloads them all.

1. In your terminal, move into the project folder:
   ```
   cd greenqubes-ops
   ```
2. Then run:
   ```
   npm install
   ```
3. This will take 1–3 minutes. You'll see a lot of text scrolling. Wait for it to finish.

---

## Step 8 — Run the App Locally

This starts a version of the app on your own computer so you can see your changes before they go live.

1. In your terminal (make sure you're still inside the `greenqubes-ops` folder), type:
   ```
   npm run dev
   ```
2. Wait about 10 seconds. When you see text saying `Ready` or `✓ Compiled`, open your browser and go to:
   ```
   http://localhost:3000
   ```
3. You should see the Greenqubes app. Log in with your Google account.

> To stop the app, go back to your terminal and press **Ctrl + C**.

---

## Step 9 — Understand How Saving Changes Works

When you make a change to the code, here's how it gets saved and shared:

Think of it like this: the live app is the **published version** of a document. Your computer is your **personal draft**. Git is the tool that moves your draft into the shared version.

Your branch is called **`dev-bryan`**. This is your dedicated working copy — it already exists on GitHub, you just need to switch to it on your computer.

There are three steps every time you want to save your work:

### 9a — Switch to your branch

Do this once after cloning (Step 5), and you'll stay on it:

```
git checkout dev-bryan
git pull
```

### 9b — Save your changes (a "commit")

Once you've made some changes, save them like this:

```
git add .
git commit -m "short description of what you changed"
```

For example:
```
git commit -m "fix typo on login page"
```

### 9c — Upload your changes to GitHub (a "push")

This sends your saved changes to GitHub so Nic can see them:

```
git push origin dev-bryan
```

After this, message Nic to let him know — he'll review it and merge it into `dev`.

---

## Step 10 — Stay in Sync with Nic's Work

Because two people are working on the same codebase, you need to regularly pull in Nic's latest changes so you're not working on outdated code.

Do this at the **start of every working session**, before touching anything:

```
git checkout dev-bryan
git pull
```

This downloads the latest version of your branch. If Nic has merged new changes into `dev` and wants you to have them, he'll let you know and update your branch for you.

---

## Step 11 — Set Up Claude Code (AI Coding Assistant)

Claude Code is the AI assistant used on this project. It reads a set of instructions specific to your role so it knows how to help you correctly.

### 11a — Install Claude Code

1. In your terminal, type:
   ```
   npm install -g @anthropic-ai/claude-code
   ```
2. When it's done, type:
   ```
   claude
   ```
   It will ask you to log in — follow the prompts in your browser.

### 11b — Point Claude Code to your instructions file

Claude Code automatically loads a personal instructions file from a hidden folder on your computer. You need to create that folder and file so it loads your version of the instructions instead of Nic's.

**On Windows:**

1. Open your terminal and type these one at a time:
   ```
   mkdir "%USERPROFILE%\.claude"
   ```
   ```
   copy "C:\path\to\greenqubes-ops\docs-bryan\CLAUDE-bryan.md" "%USERPROFILE%\.claude\CLAUDE.md"
   ```
   Replace `C:\path\to\greenqubes-ops` with the actual location of your project folder (e.g. `C:\Users\Bryan\Documents\greenqubes-ops`).

**On Mac:**

1. Open your terminal and type these one at a time:
   ```
   mkdir -p ~/.claude
   ```
   ```
   cp ~/Documents/greenqubes-ops/docs-bryan/CLAUDE-bryan.md ~/.claude/CLAUDE.md
   ```
   Adjust the path if you saved the project somewhere other than Documents.

### 11c — Verify it worked

Open VS Code, open the `greenqubes-ops` folder, then open a new terminal inside VS Code and type:
```
claude
```

When Claude Code starts, it should say something about reading your instructions. That means it's using your personalised setup.

> **Note:** If Nic updates `docs-bryan/CLAUDE-bryan.md` with new task instructions, you'll need to repeat the copy command in step 11b to refresh your local copy.

---

## Step 12 — Install Skills (Superpowers + UI/UX Pro Max)

Skills are add-ons for Claude Code that give it extra abilities. This project uses two:

- **Superpowers** — teaches Claude how to plan, debug, and work through tasks in a structured way
- **UI/UX Pro Max** — gives Claude a full design system so it can build and review UI correctly for this project

### 12a — Install Superpowers

1. Open Claude Code (type `claude` in your terminal inside the project folder)
2. Type `/marketplace` and press Enter
3. Search for **Superpowers**
4. Click Install and follow the prompts

### 12b — Install UI/UX Pro Max

1. Still inside Claude Code, type `/marketplace` again
2. Search for **UI/UX Pro Max**
3. Click Install and follow the prompts

### 12c — Verify both are installed

Type `/skills` in Claude Code. You should see both **superpowers** and **ui-ux-pro-max** listed. If they appear, you're all set.

> If you can't find the marketplace or something isn't showing up, message Nic before trying anything else.

---

## Golden Rules

1. **Always work on `dev-bryan`.** Never touch `dev` or `main` directly.
2. **Always pull before you start.** See Step 10.
3. **Commit often.** Small saves with clear descriptions are better than one giant save at the end of the day.
4. **Tell Nic what file you're working on** before you start — this avoids two people editing the same thing at the same time.
5. **Never share or upload the `.env.local` file.**
6. **When in doubt, ask Nic before pushing.**

---

## Quick Reference — Daily Workflow

```
1. git checkout dev-bryan
2. git pull
3. Make your changes in VS Code
4. git add .
5. git commit -m "what you did"
6. git push origin dev-bryan
7. Message Nic to review
```

---

## Something Went Wrong?

- **"npm install" shows errors** → Check that Node.js is installed correctly (Step 1). Try closing and reopening the terminal.
- **App won't start** → Make sure the `.env.local` file is in the right place (Step 6).
- **Can't log in to the app** → Message Nic — your Google account may need to be added to the system.
- **Git is showing errors after a pull** → Don't try to fix it yourself. Screenshot the error and send it to Nic.
