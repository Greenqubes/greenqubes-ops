# Bryan's Checklist

> Your personal task tracker for the Greenqubes app. Updated by Nic as tasks come in.

_Last updated: 2026-05-25_

---

## Onboarding Setup — Do This First

- [ ] Install Node.js (v20 LTS) — nodejs.org
- [ ] Install Git — git-scm.com
- [ ] Install VS Code — code.visualstudio.com
- [ ] Create a GitHub account and send Nic your username
- [ ] Accept the GitHub collaborator invite (check your email)
- [ ] Clone the repo: `git clone https://github.com/Greenqubes/greenqubes-ops.git`
- [ ] Get the `.env.local` file from Nic and place it in the `greenqubes-ops` folder
- [ ] Run `npm install` inside the folder
- [ ] Run `npm run dev` and confirm the app opens at `http://localhost:3000`
- [ ] Switch to your branch: `git checkout dev-bryan && git pull`
- [ ] Log in to the app with your Google account and confirm it works
- [ ] Install Claude Code: `npm install -g @anthropic-ai/claude-code`
- [ ] Copy your instructions file to your Claude folder (see Step 11 in `docs-bryan/assistant-onboarding.md`)
- [ ] Run `claude` inside VS Code and confirm it starts correctly
- [ ] Install Superpowers skill from the Claude Code marketplace (see Step 12 in `docs-bryan/assistant-onboarding.md`)
- [ ] Install UI/UX Pro Max skill from the Claude Code marketplace (see Step 12 in `docs-bryan/assistant-onboarding.md`)
- [ ] Type `/skills` in Claude Code and confirm both skills appear
- [ ] Read `docs-bryan/assistant-onboarding.md` fully before making any changes

---

## Active Tasks

_Nic will add tasks here as they come in._

---

## Waiting for Nic's Review

_Push your branch and message Nic when something is ready to be checked._

---

## Completed ✓

_Tick things off here once Nic confirms they're merged._

---

## Ground Rules (read once, keep handy)

- Always work on the `dev-bryan` branch. Never touch `dev` or `main`.
- Pull before you start every session: `git checkout dev-bryan && git pull`
- Commit often with clear messages: `git commit -m "what you changed"`
- Message Nic before starting anything — confirm what file or page you're working on so you don't overlap
- Never share or upload the `.env.local` file
- When in doubt, ask Nic before pushing
