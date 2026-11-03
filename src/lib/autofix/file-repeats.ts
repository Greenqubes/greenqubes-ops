// Repeats of crashes the fixer has already judged are filed here, in the app,
// without waking the cloud: noise and known issues are put away; a crash that
// shows a fix didn't hold reopens it. Runs before EVERY fire — nightly and
// Nic's "look at this now" alike — so the cloud only ever sees new problems
// (final review, 2026-11-04: a daytime run used to skip this and could then
// overwrite a fix that was waiting for Nic).

import { groupCrashes } from './crash-signature'
import { crashFollowUp } from './scheduling'
import { unattachedCrashes, latestItemForSignature, attachCrashes, updateItem } from './store'

export async function fileRepeatCrashes(): Promise<{ filed: number; reopened: number }> {
  const crashes = await unattachedCrashes()
  const byId = new Map(crashes.map(c => [c.id, c]))
  let filed = 0
  let reopened = 0
  for (const g of groupCrashes(crashes)) {
    const item = await latestItemForSignature(g.signature)
    if (!item) continue // a new problem — the cloud looks at it
    const decisions = g.rowIds.map(id => {
      const c = byId.get(id)
      return crashFollowUp(item, { build_id: c?.build_id ?? null, occurred_at: c?.occurred_at ?? new Date().toISOString() })
    })
    if (decisions.includes('reopen')) {
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
  return { filed, reopened }
}
