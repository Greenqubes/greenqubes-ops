// Applying what the cloud fixer reported (POST /api/autofix/report), then
// sending Nic his one message.
//
// The run is claimed first (finishRun succeeds once), so a cloud retry that
// posts the same report twice changes nothing the second time and Nic never
// gets a duplicate message.

import { groupCrashes } from './crash-signature'
import { gateFix } from './gate'
import { statusForVerdict, type Report, type ReportItem } from './report-parse'
import { buildNightlyMessage, dateLabel, shortDate, type NightlyInput } from './nightly-message'
import { sendBugTelegramChunks, sendBugTelegramPhoto } from '@/lib/telegram/bot'
import { getDownloadUrl } from '@/lib/storage/r2'
import {
  getRun, finishRun, getItem, itemForBug, latestItemForSignature, insertItem, updateItem,
  unattachedCrashes, attachCrashes, getBugReport, setBugStatus, userNamesByEmail,
  type ItemRow,
} from './store'

export type ApplyResult =
  | { status: 'ok'; applied: number; telegramSent: boolean }
  | { status: 'unknown-run' }
  | { status: 'conflict' }

async function resolveItem(ri: ReportItem): Promise<ItemRow | null> {
  const ref = ri.ref
  if (ref.kind === 'item') return getItem(ref.itemId)
  if (ref.kind === 'bug') {
    const existing = await itemForBug(ref.bugReportId)
    if (existing) return existing
    if (!(await getBugReport(ref.bugReportId))) return null // not a real report
    return insertItem({ source: 'bug', bug_report_id: ref.bugReportId })
  }
  const existing = await latestItemForSignature(ref.signature)
  // A live fix whose crash came back is a new problem, not the old item.
  if (existing && existing.status !== 'live') return existing
  return insertItem({ source: 'crash', crash_signature: ref.signature })
}

export async function applyReport(report: Report): Promise<ApplyResult> {
  const run = await getRun(report.runId)
  if (!run) return { status: 'unknown-run' }
  if (run.finished_at || !(await finishRun(run.id, 'reported'))) return { status: 'conflict' }

  const groups = new Map(groupCrashes(await unattachedCrashes()).map(g => [g.signature, g.rowIds]))
  const touched: ItemRow[] = []
  let repeats = 0

  for (const ri of report.items) {
    const item = await resolveItem(ri)
    if (!item) continue

    let status = statusForVerdict(ri.verdict, !!ri.fix)
    let reason = ri.reason
    const patch: Partial<ItemRow> = {
      verdict:         ri.verdict,
      severity:        ri.severity ?? null,
      title:           ri.title,
      summary:         ri.summary,
      whats_new_line:  ri.whatsNewLine ?? null,
      reported_run_id: run.id,
    }

    if (ri.fix) {
      patch.branch      = ri.fix.branch
      patch.head_sha    = ri.fix.headSha
      patch.preview_url = ri.fix.previewUrl
      patch.attempts    = item.attempts + 1
      // The app measures the fix itself before Nic is ever offered it.
      const gate = await gateFix(ri.fix.branch, ri.fix.headSha)
      if (gate.ok) {
        patch.diff_files = gate.files
        patch.diff_lines = gate.lines
      } else {
        status = 'needs_session'
        reason = gate.reason
      }
    }
    patch.status = status
    patch.reason = reason
    await updateItem(item.id, patch)

    const signature = item.crash_signature ?? (ri.ref.kind === 'crash' ? ri.ref.signature : null)
    if (signature) {
      const rowIds = groups.get(signature) ?? []
      await attachCrashes(rowIds, item.id, status === 'closed')
      repeats += Math.max(0, rowIds.length - 1)
    }
    if (item.bug_report_id) {
      if (ri.verdict === 'already_fixed') await setBugStatus(item.bug_report_id, 'fixed')
      else if (status === 'closed')      await setBugStatus(item.bug_report_id, 'closed')
    }
    touched.push({ ...item, ...patch } as ItemRow)
  }

  const telegramSent = await tellNic(touched, repeats)
  return { status: 'ok', applied: touched.length, telegramSent }
}

async function tellNic(items: ItemRow[], repeats: number): Promise<boolean> {
  const wishItems = items.filter(i => i.verdict === 'wish' && i.bug_report_id)
  const wishBugs  = await Promise.all(wishItems.map(i => getBugReport(i.bug_report_id as string)))
  const names     = await userNamesByEmail(wishBugs.map(b => b?.user_email).filter((e): e is string => !!e))

  const input: NightlyInput = {
    dateLabel: dateLabel(new Date().toISOString()),
    fixes: items
      .filter(i => i.status === 'awaiting_nic' && i.preview_url)
      .map(i => ({ no: i.no, title: i.title ?? 'Untitled fix', severity: i.severity ?? 'minor', previewUrl: i.preview_url as string })),
    wishes: wishItems.flatMap((i, k) => {
      const b = wishBugs[k]
      if (!b) return []
      return [{
        no:         i.no,
        reporter:   (b.user_email && names.get(b.user_email)) || b.user_email || 'someone',
        route:      b.route ?? '—',
        priority:   b.priority,
        message:    b.message,
        reportedOn: shortDate(b.created_at),
      }]
    }),
    needsSession: items
      .filter(i => i.status === 'needs_session')
      .map(i => ({ no: i.no, title: i.title ?? 'Untitled', reason: i.reason ?? '' })),
    closed: {
      junk:         items.filter(i => i.verdict === 'junk').length,
      noise:        items.filter(i => i.verdict === 'noise').length,
      known:        items.filter(i => i.verdict === 'known').length,
      repeats,
      alreadyFixed: items.filter(i => i.verdict === 'already_fixed').map(i => i.title ?? 'untitled'),
    },
  }

  const text = buildNightlyMessage(input)
  if (!text) return false
  const sent = await sendBugTelegramChunks(text)

  // "together with the whole report" (Nic) — a wish's screenshot follows it.
  for (const [k, i] of wishItems.entries()) {
    const key = wishBugs[k]?.screenshot_key
    if (!key) continue
    try {
      await sendBugTelegramPhoto(await getDownloadUrl(key), `Wish ${i.no} — screenshot`)
    } catch (e) {
      console.error('[autofix] wish screenshot failed', e)
    }
  }
  return sent
}
