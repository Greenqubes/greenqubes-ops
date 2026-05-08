# Session 17.10 — Nightly Bug Sync

_Written: 2026-05-08. Completed same sitting as Session 17.9._

---

## What was built

Nightly automated sync of bug reports from Supabase to local markdown files, with auto-commit and push to `dev` each morning.

---

## Files created

| File | Purpose |
|---|---|
| `scripts/sync-bugs.ts` | Pulls all open + fixed bug reports from Supabase, writes/updates local markdown files in `bugs_reported/{version}/` and `bugs_reported/{version}/fixed/` |

## Files modified

| File | Change |
|---|---|
| `scripts/greenqubes-nightly.bat` | Added Step 4: runs `npm run sync-bugs`, then commits and pushes any new markdown files to `dev` via `git add bugs_reported\`, `git commit`, `git push origin dev` |
| `package.json` | Added `sync-bugs` script: `tsx scripts/sync-bugs.ts` |
| `docs/plan.md`, `docs/CONTEXT.md` | Updated to reflect 17.10 complete |

---

## Architecture decisions

### Why auto-commit to dev
Bug reports should be visible in VS Code on the next `git pull` without any manual action. The nightly bat already has git available, so committing + pushing is zero-friction. Uses `[skip ci]` commit message to avoid triggering Vercel deploys on file-only commits.

### No duplication risk
`sync-bugs.ts` is idempotent — it overwrites existing files by filename, never creates duplicates.

---

## What's next — Session 17.11

Maintenance: git history cleanup, security audit, tooling.
