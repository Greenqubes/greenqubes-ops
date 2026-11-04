// Repeats of crashes the fixer has already judged are filed here, in the app,
// without waking the cloud: noise and known issues are put away; a crash that
// shows a fix didn't hold reopens it. Runs before EVERY fire — nightly and
// Nic's "look at this now" alike — so the cloud only ever sees new problems
// (final review, 2026-11-04: a daytime run used to skip this and could then
// overwrite a fix that was waiting for Nic).
//
// A fix that has already been tried MAX_ATTEMPTS times is not reopened again:
// it is flagged for a session and Nic is told once (Nic, 2026-11-05: "flag it
// instead and stop fixing to not burn tokens").

import { groupCrashes } from './crash-signature'
import { crashFollowUp, EXHAUSTED_REASON } from './scheduling'
import { escapeHtml } from './nightly-message'
import { unattachedCrashes, latestItemForSignature, attachCrashes, updateItem } from './store'
import { sendBugTelegramChunks } from '@/lib/telegram/bot'

export async function fileRepeatCrashes(): Promise<{ filed: number; reopened: number; flagged: number }> {
  const crashes = await unattachedCrashes()
  const byId = new Map(crashes.map(c => [c.id, c]))
  let filed = 0
  let reopened = 0
  const flagged: string[] = []
  for (const g of groupCrashes(crashes)) {
    const item = await latestItemForSignature(g.signature)
    if (!item) continue // a new problem — the cloud looks at it
    const decisions = g.rowIds.map(id => {
      const c = byId.get(id)
      return crashFollowUp(item, { build_id: c?.build_id ?? null, occurred_at: c?.occurred_at ?? new Date().toISOString() })
    })
    if (decisions.includes('flag')) {
      await attachCrashes(g.rowIds, item.id, false)
      await updateItem(item.id, { status: 'needs_session', reason: `it crashed again — ${EXHAUSTED_REASON}` })
      flagged.push(`<b>${item.no}</b> — ${escapeHtml(item.title ?? 'Untitled')}`)
    } else if (decisions.includes('reopen')) {
      await attachCrashes(g.rowIds, item.id, false)
      await updateItem(item.id, {
        status:    'retry',
        nic_notes: [...item.nic_notes, {
          at:     new Date().toISOString(),
          text:   item.verdict === 'already_fixed'
            ? 'It was marked already fixed, but it crashed again.'
            : 'Crashed again after the fix went live.',
          photos: [],
        }],
      })
      reopened++
    } else {
      await attachCrashes(g.rowIds, item.id, decisions.every(d => d === 'attach-resolve'))
      filed += g.rowIds.length
    }
  }
  if (flagged.length > 0) {
    await sendBugTelegramChunks(
      `These crashed again after 3 tries, so I've stopped working on them to save effort — they need a session with Claude:\n${flagged.join('\n')}`,
    )
  }
  return { filed, reopened, flagged: flagged.length }
}
