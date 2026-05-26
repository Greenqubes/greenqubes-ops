# Session Note — feat-vault — 2026-05-26

**Branch:** dev → merged to main
**Session type:** Feature — Obsidian vault convention + auto-write on digest promotion
**Status:** Complete

---

## What was built

### Vault folder scaffolding

Created 7 folders in the `greenqubes-kb` vault repo (via git, committed and pushed):

```
vault/
  clients/      client profiles, contacts, preferences
  suppliers/    pricing, lead times, rep contacts
  sops/         install playbooks, procedures
  jobs/         post-job lessons, what-went-wrong notes
  templates/    quote, PTW, onboarding checklist masters
  contacts/     venue managers, BCA, internal contacts
  digest/       auto-generated notes from promoted assistant chats
```

Submodule pointer updated in main repo.

---

### Vault convention spec

Full naming, tagging, and visibility rules documented at:
`docs/superpowers/specs/2026-05-26-obsidian-vault-convention-design.md`

Key rules:
- File naming: slug-style for evergreen content, date-prefixed for `digest/` and `jobs/`
- Frontmatter: `visibility` + `tags` on every note
- Visibility by content type: pricing/supplier costs = `[role:sales, role:scheduler]`; SOPs/lessons = `[public-internal]`
- Manual override: edit frontmatter in Obsidian, nightly sync picks it up

---

### Auto-write on digest promotion

**New files:**
- `src/lib/github/vault.ts` — GitHub Contents API helper; `commitVaultFile()` + `topicToSlug()`
- `src/lib/digest/autoPromote.ts` — full promotion flow: fetch chat → Sonnet summary → assemble frontmatter from stored visibility/tags → commit to `vault/digest/`

**Updated files:**
- `src/app/api/digest/promote/[id]/route.ts` — replaced copy-paste HTML page with `autoPromoteToVault()` call; returns JSON `{ ok, path }`
- `src/app/api/telegram/digest-webhook/route.ts` — removed `buildPromoteUrl`; majority vote now calls `autoPromoteToVault()` fire-and-forget; Telegram message updated to "note is being written to Obsidian vault automatically"

**Model:** Claude Sonnet (`claude-sonnet-4-6`) for summary generation — quality matters for permanent knowledge base entries.

**Env vars added:** `GITHUB_VAULT_REPO=Greenqubes/greenqubes-kb`, `GITHUB_VAULT_TOKEN` — in `.env.local` and Vercel dashboard (Production + Preview).

---

### Nightly obsidian sync script

- `scripts/nightly-obsidian-sync.bat` — runs `git pull` on vault then `obsidian-sync.ts`; closes the gap where Obsidian might be closed on the server PC
- `docs/setup-task-scheduler-obsidian-sync.md` — step-by-step Task Scheduler setup guide for server PC; trigger at 2:30 AM (after backup at 2:00 AM)

---

## Flow (end to end)

```
User chats with AI assistant
       ↓
Chat saved to asst_chats (auto-tagged importance 1–5)
       ↓
Monday 9 AM SGT: Vercel cron sends importance 4–5 chats to Telegram digest
       ↓
Digest subscribers vote Promote / Skip
       ↓
Majority Promote → webhook fires → autoPromoteToVault()
       ↓
Sonnet generates clean prose summary
Frontmatter assembled from chat.visibility + chat.tags
File committed to vault/digest/{date}-{slug}.md via GitHub API
       ↓
Obsidian-git pulls every 11 min → file appears in Obsidian
       ↓
2:30 AM nightly: nightly-obsidian-sync.bat runs git pull + obsidian-sync.ts
       ↓
kb_chunks in Supabase updated → AI can retrieve it
```

---

## Key decisions

- Promoted chats land in `vault/digest/` only — other folders (clients, suppliers, etc.) are manually authored
- Sonnet used instead of Haiku for digest notes — these are permanent KB entries, quality matters
- `chat.visibility` from `asst_chats` is used directly for the note's frontmatter — no re-classification needed
- Fire-and-forget auto-promote in webhook keeps the Telegram response fast
- `/api/digest/promote/[id]` route kept as a signed manual fallback trigger

---

## Server PC setup — progress log

Attempted in same session (2026-05-26) from server PC directly.

**What was completed:**
- `C:\greenqubes-ops` folder created
- Repo cloned via `git clone https://github.com/Greenqubes/greenqubes-ops.git .`
- `npm install` completed
- `.env.local` copied manually from workstation
- Vault submodule initialized (`git submodule update --init`) and checked out onto `main` branch (was in detached HEAD state)
- `scripts/nightly-obsidian-sync.bat` updated to use `tsx.cmd` instead of `tsx` (Windows requires the `.cmd` wrapper) — pushed to main

**What's left:**
- Run `git pull` to get the tsx.cmd fix, then test the bat file (Step 6 in the guide)
- If bat runs cleanly (vault pull + obsidian-sync.ts embeds), proceed to Task Scheduler setup (Steps 7–10)

**Install VSCode on server PC first** so Claude Code can run the remaining setup steps directly.

---

## Pending from this session

- [ ] **Task Scheduler setup** — repo ready on server PC, just needs bat file test + Task Scheduler entry. Install VSCode on server PC, open Claude Code, run from there.
- [ ] **R2 human-readable folder names** — currently job files stored under UUID; rename to `{date}_{client-slug}_{short-id}` before go-live; needs design + plan
