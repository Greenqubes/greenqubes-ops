// The cloud fixer's work list (GET /api/autofix/inbox).
//
// What it may see is decided here. No reporter names or emails go out — the
// cloud doesn't need them to fix a bug, and the app adds them back when it
// writes to Nic. Screenshots and Nic's photos are served through the app's own
// /api/autofix/file route, so the cloud needs no other host allowed.

import { buildIdOf, PROD_URL } from './build-id'
import { groupCrashes } from './crash-signature'
import { MAX_FIXES_PER_RUN } from './scheduling'
import { MAX_FILES, MAX_LINES } from './path-rules.mjs'
import {
  newBugReports, unattachedCrashes, retryItems, listItems, getBugReport, crashesForItem,
  type BugRow, type ItemRow,
} from './store'

const fileUrl = (q: string) => `${PROD_URL}/api/autofix/file?${q}`

function bugOut(b: BugRow) {
  return {
    id:            b.id,
    createdAt:     b.created_at,
    route:         b.route,
    role:          b.user_role,
    priority:      b.priority,
    message:       b.message,
    buildId:       b.build_id ?? null,
    screenshotUrl: b.screenshot_key ? fileUrl(`bug=${b.id}`) : null,
  }
}

async function retryOut(i: ItemRow) {
  const [bug, crashes] = await Promise.all([
    i.bug_report_id ? getBugReport(i.bug_report_id) : Promise.resolve(null),
    i.crash_signature ? crashesForItem(i.id) : Promise.resolve([]),
  ])
  return {
    itemId:          i.id,
    no:              i.no,
    title:           i.title,
    verdict:         i.verdict,
    previousReason:  i.reason,
    branch:          i.branch,
    headSha:         i.head_sha,
    attempts:        i.attempts,
    bug:             bug ? bugOut(bug) : null,
    crashSignature:  i.crash_signature,
    recentCrashes:   crashes.map(c => ({
      occurredAt: c.occurred_at, route: c.route, errorMessage: c.error_message,
      stackTrace: c.stack_trace, componentStack: c.component_stack, buildId: c.build_id ?? null,
    })),
    notes: i.nic_notes.map(n => ({
      at: n.at, text: n.text, photoUrls: n.photos.map(p => fileUrl(`tg=${encodeURIComponent(p)}`)),
    })),
  }
}

export async function buildInbox(runId: string) {
  const [bugs, crashes, retries, open] = await Promise.all([
    newBugReports(), unattachedCrashes(), retryItems(), listItems('open'),
  ])
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  return {
    runId,
    limits: {
      maxFixes:     MAX_FIXES_PER_RUN,
      maxFiles:     MAX_FILES,
      maxLines:     MAX_LINES,
      branchPrefix: 'claude/autofix-',
    },
    productionBuild: sha ? buildIdOf(sha) : null,
    bugs:            bugs.map(bugOut),
    crashGroups:     groupCrashes(crashes).map(g => ({ ...g, rowIds: undefined, rows: g.count })),
    retries:         await Promise.all(retries.map(retryOut)),
    openItems:       open.map(i => ({
      itemId: i.id, no: i.no, source: i.source, title: i.title, verdict: i.verdict,
      status: i.status, crashSignature: i.crash_signature, bugReportId: i.bug_report_id,
    })),
  }
}
