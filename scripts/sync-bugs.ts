/**
 * Pulls all bug reports from Supabase and writes them as markdown files locally.
 * Open bugs  → bugs_reported/{version}/bugs_{role}_{date}_{N}.md
 * Fixed bugs → bugs_reported/{version}/fixed/bugs_{role}_{date}_{N}.md
 *
 * Run: npm run sync-bugs
 * Safe to re-run — skips files that already exist (idempotent).
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

  for (const bug of bugs) {
    const relativePath = bug.markdown_file
    if (!relativePath) {
      console.warn(`[sync-bugs] Bug ${bug.id} has no markdown_file path — skipping`)
      continue
    }

    // Determine destination based on status
    // DB stores: "{version}/bugs_{role}_{date}_{N}.md"
    // Fixed goes: "{version}/fixed/bugs_{role}_{date}_{N}.md"
    let destRelative: string
    if (bug.status === 'fixed') {
      const versionDir = path.dirname(relativePath)
      const filename   = path.basename(relativePath)
      destRelative     = path.join(versionDir, 'fixed', filename)
    } else {
      destRelative = relativePath
    }

    const destAbs = path.join(BUG_LOG_DIR!, destRelative)

    // Skip if already exists
    if (fs.existsSync(destAbs)) {
      skipped++
      continue
    }

    // Ensure directory exists
    fs.mkdirSync(path.dirname(destAbs), { recursive: true })

    // Write markdown
    const content = buildMarkdown(bug as Parameters<typeof buildMarkdown>[0])
    fs.writeFileSync(destAbs, content, 'utf8')
    console.log(`[sync-bugs] ✓ ${destRelative}`)
    written++
  }

  console.log(`\n[sync-bugs] Done — ${written} written, ${skipped} already existed.`)
}

main().catch(e => {
  console.error('[sync-bugs] Unexpected error:', e)
  process.exit(1)
})
