# Session 17.10 — Backend Updates: GitHub Bug Sync + Nightly Script Fix

_Written: 2026-05-08._

---

## What was built

Updated the bug reporting system to automatically sync bugs to GitHub issues nightly, and resolved a merge conflict in the nightly runner script.

---

## Files created

| File | Purpose |
|---|---|
| `supabase/migrations/0015_bug_github_issue.sql` | Adds `github_issue_url` column to `bug_reports` table to track GitHub issue URLs |

## Files modified

| File | Change |
|---|---|
| `scripts/sync-bugs.ts` | Complete rewrite: now creates GitHub issues for new bugs, closes them when marked fixed |
| `src/lib/supabase/queries/bugs.ts` | Added `github_issue_url` field to `BugReport` type; added `updateGitHubIssueUrl()` helper function |
| `scripts/greenqubes-nightly.bat` | Resolved merge conflict: kept environment variable exports + updated step numbering to [3/4] and [4/4] |
| `.env.local.example` | Added `GITHUB_TOKEN`, `GITHUB_REPO`, `BUG_LOG_DIR`, `APP_VERSION` documentation |

---

## Architecture decisions

### GitHub issue creation
Each new open bug automatically creates a GitHub issue with:
- **Title:** `[PRIORITY] Bug reported by {user}`
- **Labels:** `bug` + `priority-{level}` (low/medium/high/urgent)
- **Body:** Full diagnostics (time, user, page, platform, OS, screen, screenshot link)

### Issue closure
When a bug is marked `fixed` in the admin UI, the nightly script automatically closes the corresponding GitHub issue by issue number extracted from the stored URL.

### Environment variables
- `GITHUB_TOKEN` — GitHub personal access token (repo scope). If unset, GitHub sync silently skips.
- `GITHUB_REPO` — Target repo in format `Owner/repo` (default: `Greenqubes/greenqubes-ops`)
- `BUG_LOG_DIR` — Local folder for markdown files (dev only)
- `APP_VERSION` — Version scope for bug folder structure (default: `pre-alpha`)

### Merge conflict resolution
The incoming branch had an outdated version of the nightly script without the bug sync step. Resolved by keeping HEAD's environment variable exports (needed for backup.sh) while accepting the step count update to [3/4] and [4/4], since the bug sync step (step 4) already existed in the codebase.

---

## Setup required

Before the feature works, user must:

1. **Create GitHub personal access token**
   - Go to https://github.com/settings/tokens
   - Create new token with `repo` scope
   - Copy the token

2. **Apply database migration**
   ```bash
   npx supabase db push
   ```

3. **Set environment variables in `.env.local`**
   ```
   GITHUB_TOKEN=ghp_your_token_here
   GITHUB_REPO=Greenqubes/greenqubes-ops
   ```

4. **Verify on next nightly run** or test immediately with:
   ```bash
   npm run sync-bugs
   ```

---

## What's next — Session 17.11+

Possible improvements:
- **Screenshot URLs in GitHub issues** — Currently shows R2 key; could generate short-lived presigned URLs for direct image embedding in GitHub issue body
- **Link GitHub PRs to bugs** — Track which code changes resolve which bugs (auto-close on PR merge)
- **Bug metrics dashboard** — Count bugs by priority/role/page; show resolution time trends
- **Escalation workflow** — Auto-create alerts if urgent bugs aren't closed within X hours

But for now, the core feature is complete: bugs report locally → sync to GitHub nightly → close automatically when fixed.
