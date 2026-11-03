import { NextRequest, NextResponse } from 'next/server'
import { cronSecretOk } from '@/lib/autofix/auth'
import { fireFixer, fixerConfigured } from '@/lib/autofix/fire'
import { groupCrashes } from '@/lib/autofix/crash-signature'
import { crashFollowUp } from '@/lib/autofix/scheduling'
import { unattachedCrashes, latestItemForSignature, attachCrashes, updateItem } from '@/lib/autofix/store'
import { createServiceClient } from '@/lib/supabase/service'

// 02:00 SGT nightly (vercel.json, 0 18 * * * UTC). Wakes the cloud fixer only
// when there is something new — quiet nights cost Nic's Claude plan nothing.
//
// First, repeats of crashes the fixer has already judged are dealt with here
// without waking anyone: noise and known issues are filed away; a crash on the
// very build that was meant to fix it reopens that fix.
// Manual run: GET with Authorization: Bearer <CRON_SECRET>
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!cronSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!fixerConfigured()) return NextResponse.json({ skipped: 'the fixer is not set up yet' })

  const crashes = await unattachedCrashes()
  const byId = new Map(crashes.map(c => [c.id, c]))
  let filed = 0
  let reopened = 0
  for (const g of groupCrashes(crashes)) {
    const item = await latestItemForSignature(g.signature)
    if (!item) continue // new problem — the cloud looks at it
    const decisions = g.rowIds.map(id => crashFollowUp(item, byId.get(id)?.build_id ?? null))
    if (decisions.includes('reopen')) {
      await attachCrashes(g.rowIds, item.id, false)
      await updateItem(item.id, {
        status:    'retry',
        nic_notes: [...item.nic_notes, { at: new Date().toISOString(), text: 'Crashed again on the version that was meant to fix it.', photos: [] }],
      })
      reopened++
    } else {
      await attachCrashes(g.rowIds, item.id, decisions.every(d => d === 'attach-resolve'))
      filed += g.rowIds.length
    }
  }

  const fire = await fireFixer('nightly')

  // Health-tab breadcrumb, same pattern as the other crons.
  await createServiceClient().from('events').insert({
    kind: 'autofix_nightly', actor_id: null, target_id: null, target_table: null,
    payload: { filed, reopened, fired: fire.ok, why: fire.ok ? null : fire.reason }, visibility: [],
  } as never)

  return NextResponse.json({ ok: true, filed, reopened, fired: fire.ok, ...(fire.ok ? {} : { reason: fire.reason }) })
}
