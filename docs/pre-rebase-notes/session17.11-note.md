# Session 17.11 — Git Maintenance + Security Fix

_Written: 2026-05-09._

---

## What was done

Maintenance session — no app features. Git history cleanup, security incident response, and tooling.

---

## Security incident

**GitGuardian alert received:** hardcoded PostgreSQL URI detected in `scripts/set-db-url.ps1` (pushed 2026-05-08).

Actions taken:
1. Rotated database password in Supabase dashboard (Settings → Database → Reset password)
2. Replaced hardcoded URI in `set-db-url.ps1` with a placeholder template — committed as `security: remove hardcoded PostgreSQL URI from set-db-url.ps1`
3. Old credential still exists in git history — but it is now a dead credential (rotated), so no further action required

**Note for other machines:** `SUPABASE_DB_URL` system env var on the server PC needs updating with the new password. Get the new URI from Supabase dashboard → Settings → Database → Connection string → URI.

---

## Git history cleanup

Rebased `dev` branch from 94 commits → 24 clean session-based commits.

Each session now has exactly one commit. Old noisy docs/fix/chore commits within each session were squashed. Force-pushed to `origin/dev`.

**On other machines (workstation + server PC), run:**
```bash
git fetch origin
git reset --hard origin/dev
```

Backup branch `backup-before-squash` preserved locally as safety net.

---

## Files removed from repo

These files were tracked in git but served no ongoing purpose:

| File | Reason |
|---|---|
| `docs/conversation-archive-1.md` (192KB) | Archived chat log |
| `docs/prototype-archive.jsx` (268KB) | Old prototype, superseded by `greenqubes-phase0.jsx` |
| `docs/greenqubes-architecture.html` (40KB) | One-off HTML export |
| `docs/greenqubes-setup-guide.html` (44KB) | One-off HTML export |
| `docs/Claude Start up instructions.pdf` (12KB) | PDF in a code repo |

All five added to `.gitignore` to prevent re-adding.

---

## Tooling

- Added `.claude/skills/` to `.gitignore` — Claude Code skill files are local dev tooling, not app code. Reinstall on any machine with: `npx uipro-cli init --ai claude`
- Installed **ui-ux-pro-max** skill (v2.5.0) locally — design intelligence for future Session 18.X work

---

## What's next

- Session 17.X: Backend performance review (profiling page load times, parallelising Supabase queries)
- Session 18.X: Additional design improvements and feature implementations before pre-alpha
- Session 19: Pre-alpha testing (solo end-to-end run)
