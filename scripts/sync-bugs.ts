/**
 * Pulls all bug reports from Supabase and:
 * 1. Writes them as markdown files locally
 * 2. Creates/closes GitHub issues in greenqubes-ops repo
 *
 * Open bugs  → bugs_reported/{version}/bugs_{role}_{date}_{N}.md
 * Fixed bugs → bugs_reported/{version}/fixed/bugs_{role}_{date}_{N}.md
 * GitHub issues automatically created and closed based on bug status.
 *
 * Run: npm run sync-bugs
 * Requires: GITHUB_TOKEN env var (personal access token with repo scope)
 */

import fs   from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/lib/supabase/types'

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const BUG_LOG_DIR = process.env.BUG_LOG_DIR
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO || 'Greenqubes/greenqubes-ops'

if (!BUG_LOG_DIR) {
  console.error('[sync-bugs] BUG_LOG_DIR not set in .env.local')
  process.exit(1)
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toSGT(ts: string): string {
  return new Date(ts).toLocaleString('en-SG', {
    day:      '2-digit',
    month:    'short',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'Asia/Singapore',
  }) + ' SGT'
}

function buildMarkdown(bug: {
  priority:       string
  created_at:     string
  user_email:     string | null
  user_role:      string | null
  route:          string | null
  ip_address:     string | null
  platform:       string | null
  os:             string | null
  screen:         string | null
  screenshot_key: string | null
  message:        string
  status:         string
  resolved_at:    string | null
}): string {
  const sgtTime     = toSGT(bug.created_at)
  const resolvedStr = bug.resolved_at ? `\n**Resolved:** ${toSGT(bug.resolved_at)}` : ''
  const screenshot  = bug.screenshot_key
    ? `R2 key: \`${bug.screenshot_key}\``
    : 'none'

  return [
    `# Bug Report — ${bug.priority.toUpperCase()} — ${sgtTime}`,
    '',
    `**Status:** ${bug.status}${resolvedStr}`,
    `**Time:** ${sgtTime}`,
    `**User:** ${bug.user_email ?? 'unknown'} (${bug.user_role ?? 'unknown'})`,
    `**Page:** ${bug.route ?? 'unknown'}`,
    `**Priority:** ${bug.priority}`,
    `**IP:** ${bug.ip_address ?? 'unknown'}`,
    `**Platform:** ${bug.platform ?? 'unknown'}`,
    `**OS:** ${bug.os ?? 'unknown'}`,
    `**Screen:** ${bug.screen ?? 'unknown'}`,
    `**Screenshot:** ${screenshot}`,
    '',
    '## Description',
    '',
    bug.message,
  ].join('\n')
}

function buildGitHubIssueBody(bug: {
  priority:       string
  created_at:     string
  user_email:     string | null
  user_role:      string | null
  route:          string | null
  ip_address:     string | null
  platform:       string | null
  browser:        string | null
  os:             string | null
  screen:         string | null
  screenshot_key: string | null
  message:        string
}): string {
  const sgtTime = toSGT(bug.created_at)
  const screenshot = bug.screenshot_key
    ? `[Screenshot](https://your-r2-url/bug-reports/${bug.screenshot_key})`
    : 'None'

  return [
    bug.message,
    '',
    '---',
    '',
    '### Diagnostics',
    `- **Time:** ${sgtTime}`,
    `- **User:** ${bug.user_email ?? 'unknown'} (${bug.user_role ?? 'unknown'})`,
    `- **Page:** ${bug.route ?? 'unknown'}`,
    `- **IP:** ${bug.ip_address ?? 'unknown'}`,
    `- **Platform:** ${bug.platform ?? 'unknown'}`,
    `- **Browser:** ${bug.browser ?? 'unknown'}`,
    `- **OS:** ${bug.os ?? 'unknown'}`,
    `- **Screen:** ${bug.screen ?? 'unknown'}`,
    `- **Screenshot:** ${screenshot}`,
  ].join('\n')
}

async function createGitHubIssue(bug: any): Promise<string | null> {
  if (!GITHUB_TOKEN) {
    console.warn('[sync-bugs] GITHUB_TOKEN not set — skipping GitHub issue creation')
    return null
  }

  const labels = ['bug', `priority-${bug.priority}`]

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `[${bug.priority.toUpperCase()}] Bug reported by ${bug.user_email?.split('@')[0] ?? 'unknown'}`,
          body: buildGitHubIssueBody(bug),
          labels: labels,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      console.warn(`[sync-bugs] GitHub API error: ${response.status}`, error)
      return null
    }

    const issue = await response.json()
    return issue.html_url
  } catch (error) {
    console.warn('[sync-bugs] Failed to create GitHub issue:', error)
    return null
  }
}

async function closeGitHubIssue(issueUrl: string): Promise<boolean> {
  if (!GITHUB_TOKEN) {
    return false
  }

  try {
    const issueNumber = parseInt(issueUrl.split('/').pop() || '', 10)
    if (!issueNumber) return false

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'closed' }),
      }
    )

    return response.ok
  } catch (error) {
    console.warn('[sync-bugs] Failed to close GitHub issue:', error)
    return false
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[sync-bugs] Fetching bug reports from Supabase…')

  const { data: bugs, error } = await db
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[sync-bugs] Failed to fetch bug reports:', error.message)
    process.exit(1)
  }

  if (!bugs || bugs.length === 0) {
    console.log('[sync-bugs] No bug reports found.')
    return
  }

  let written = 0
  let skipped = 0
  let issuesCreated = 0
  let issuesClosed = 0

  for (const bug of bugs) {
    const relativePath = bug.markdown_file
    if (!relativePath) {
      console.warn(`[sync-bugs] Bug ${bug.id} has no markdown_file path — skipping`)
      continue
    }

    // Determine destination based on status
    let destRelative: string
    if (bug.status === 'fixed') {
      const versionDir = path.dirname(relativePath)
      const filename   = path.basename(relativePath)
      destRelative     = path.join(versionDir, 'fixed', filename)
    } else {
      destRelative = relativePath
    }

    const destAbs = path.join(BUG_LOG_DIR!, destRelative)

    // Handle markdown file
    if (fs.existsSync(destAbs)) {
      skipped++
    } else {
      fs.mkdirSync(path.dirname(destAbs), { recursive: true })
      const content = buildMarkdown(bug as any)
      fs.writeFileSync(destAbs, content, 'utf8')
      console.log(`[sync-bugs] ✓ ${destRelative}`)
      written++
    }

    // Handle GitHub issues
    if (bug.status === 'fixed' && bug.github_issue_url) {
      // Close the GitHub issue if it's fixed
      const closed = await closeGitHubIssue(bug.github_issue_url)
      if (closed) {
        console.log(`[sync-bugs] ✓ Closed GitHub issue ${bug.github_issue_url}`)
        issuesClosed++
      }
    } else if (bug.status === 'open' && !bug.github_issue_url) {
      // Create a GitHub issue for new open bugs
      const issueUrl = await createGitHubIssue(bug)
      if (issueUrl) {
        // Update the database with the issue URL
        const { error: updateError } = await db
          .from('bug_reports')
          .update({ github_issue_url: issueUrl })
          .eq('id', bug.id)

        if (!updateError) {
          console.log(`[sync-bugs] ✓ Created GitHub issue ${issueUrl}`)
          issuesCreated++
        } else {
          console.warn(`[sync-bugs] Failed to save issue URL to DB:`, updateError.message)
        }
      }
    }
  }

  console.log(`\n[sync-bugs] Done — ${written} markdown files written, ${skipped} already existed.`)
  console.log(`[sync-bugs] GitHub — ${issuesCreated} issues created, ${issuesClosed} issues closed.`)
}

main().catch(e => {
  console.error('[sync-bugs] Unexpected error:', e)
  process.exit(1)
})
