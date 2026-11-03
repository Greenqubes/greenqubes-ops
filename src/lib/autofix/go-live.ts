// Putting one approved fix on the live app — fixed steps, no judgement.
//
// Nic's message on the bug bot is the go-ahead for THAT fix only (a narrow,
// written exception to "push to main" — CLAUDE.md). The fix was tested on its
// own preview first, which is what "never push untested changes to main" is
// for; dev gets it straight afterwards.

import { gateFix } from './gate'
import { mergeInto, deleteBranch, productionDeployState } from './github'
import { buildIdOf, epochFromVercelId, PROD_URL } from './build-id'
import { GO_LIVE_TIMEOUT_MINUTES } from './scheduling'
import { clock12, escapeHtml } from './nightly-message'
import {
  claimItemStatus, updateItem, itemsByStatus, setBugStatus, resolveCrashesOfItem,
  type ItemRow,
} from './store'
import type { Item } from './actions'
import { sendBugTelegramChunks } from '@/lib/telegram/bot'

type Outcome = { ok: true } | { ok: false; reason: string }

export async function startGoLive(item: Item): Promise<Outcome> {
  if (item.status !== 'awaiting_nic' || !item.branch || !item.head_sha) {
    return { ok: false, reason: "it isn't waiting for you" }
  }
  // Re-measured now, not trusted from last night: the branch must be exactly
  // what Nic tested, and still inside the limiter.
  const gate = await gateFix(item.branch, item.head_sha)
  if (!gate.ok) {
    await updateItem(item.id, { status: 'needs_session', reason: gate.reason })
    return { ok: false, reason: gate.reason }
  }
  const now = new Date().toISOString()
  if (!(await claimItemStatus(item.id, 'awaiting_nic', { status: 'going_live', going_live_at: now }))) {
    return { ok: false, reason: "it's already on its way" }
  }

  const merge = await mergeInto('main', item.branch, `fix(autofix): ${item.title ?? 'fix'} (#${item.no}, Nic via Telegram)`)
  if (merge.result === 'merged') {
    await updateItem(item.id, { merge_sha: merge.sha })
    return { ok: true }
  }
  if (merge.result === 'conflict') {
    const reason = 'its change clashes with newer work on the live app, so it needs a session'
    await updateItem(item.id, { status: 'needs_session', reason })
    return { ok: false, reason }
  }
  if (merge.result === 'nothing') {
    const reason = 'its change is already part of the live app — nothing to put live'
    await updateItem(item.id, { status: 'needs_session', reason })
    return { ok: false, reason }
  }
  // GitHub refused for another reason (key expired, outage) — hand it back.
  await updateItem(item.id, { status: 'awaiting_nic', going_live_at: null })
  return { ok: false, reason: `GitHub refused the update (${merge.detail}); you can ask again later` }
}

/**
 * Called every minute by /api/cron/autofix-watch. Does nothing unless a fix is
 * on its way. A fix is live once production serves its merge commit — or a
 * later one (Vercel reports the merge commit's production build as success).
 */
export async function watchGoingLive(): Promise<number> {
  const going = await itemsByStatus(['going_live'])
  if (going.length === 0) return 0

  let version: string | null = null
  let vercelId: string | null = null
  try {
    const res = await fetch(`${PROD_URL}/api/version`, { cache: 'no-store' })
    vercelId = res.headers.get('x-vercel-id')
    version = ((await res.json()) as { version?: string }).version ?? null
  } catch { /* production unreachable this minute — try again next minute */ }

  for (const item of going) {
    const ageMin = (Date.now() - new Date(item.going_live_at ?? item.updated_at).getTime()) / 60_000
    if (item.merge_sha) {
      if (version && version === buildIdOf(item.merge_sha)) {
        // Vercel's own clock (CLAUDE.md release-time rule), not ours.
        await finishLive(item, epochFromVercelId(vercelId) ?? Date.now())
        continue
      }
      const state = await productionDeployState(item.merge_sha)
      if (state === 'success') { await finishLive(item, Date.now()); continue }
      if (state === 'failure') {
        await updateItem(item.id, { status: 'needs_session', reason: 'the update failed to build, so the live app is unchanged' })
        await sendBugTelegramChunks(`Fix ${item.no} failed to build, so nothing changed on the live app. It's now waiting for a session with Claude.`)
        continue
      }
    }
    if (ageMin > GO_LIVE_TIMEOUT_MINUTES) {
      await updateItem(item.id, { status: 'needs_session', reason: "couldn't confirm it went live" })
      await sendBugTelegramChunks(`I couldn't confirm fix ${item.no} went live after ${GO_LIVE_TIMEOUT_MINUTES} minutes. It's waiting for a session with Claude to check.`)
    }
  }
  return going.length
}

async function finishLive(item: ItemRow, epochMs: number): Promise<void> {
  const liveAt = new Date(epochMs).toISOString()
  await updateItem(item.id, {
    status:        'live',
    live_at:       liveAt,
    live_build_id: item.merge_sha ? buildIdOf(item.merge_sha) : null,
  })
  if (item.bug_report_id) await setBugStatus(item.bug_report_id, 'fixed')
  await resolveCrashesOfItem(item.id)

  // dev gets the fix too, so the next session builds on it.
  const dev = await mergeInto('dev', 'main', `chore(autofix): bring dev up to date with fix #${item.no}`)
  const devStuck = dev.result === 'conflict' || dev.result === 'error'
  if (devStuck) await updateItem(item.id, { dev_sync_needed: true })
  if (item.branch) await deleteBranch(item.branch)

  await sendBugTelegramChunks(
    `Fix ${item.no} is live — ${clock12(liveAt)}.${item.title ? ` (${escapeHtml(item.title)})` : ''}` +
    (devStuck ? '\nThe test copy (dev) needs a quick sync at the next session with Claude.' : ''),
  )
}
