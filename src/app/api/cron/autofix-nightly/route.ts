import { NextRequest, NextResponse } from 'next/server'
import { cronSecretOk } from '@/lib/autofix/auth'
import { fireFixer, fixerConfigured } from '@/lib/autofix/fire'
import { fireFailureNotice } from '@/lib/autofix/scheduling'
import { sendBugTelegramChunks } from '@/lib/telegram/bot'
import { createServiceClient } from '@/lib/supabase/service'

// 02:00 SGT nightly (vercel.json, 0 18 * * * UTC). Wakes the cloud fixer only
// when there is something new — quiet nights cost Nic's Claude plan nothing.
// fireFixer files repeats of already-judged crashes first, without the cloud.
// A fire that BREAKS (not "nothing to do") is told to Nic, so a revoked token
// can never mean silent nights forever.
// Manual run: GET with Authorization: Bearer <CRON_SECRET>
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!cronSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!fixerConfigured()) return NextResponse.json({ skipped: 'the fixer is not set up yet' })

  const fire = await fireFixer('nightly')
  if (!fire.ok) {
    const notice = fireFailureNotice(fire)
    if (notice) await sendBugTelegramChunks(notice)
  }

  // Health-tab breadcrumb, same pattern as the other crons.
  await createServiceClient().from('events').insert({
    kind: 'autofix_nightly', actor_id: null, target_id: null, target_table: null,
    payload: { fired: fire.ok, why: fire.ok ? null : fire.reason }, visibility: [],
  } as never)

  return NextResponse.json({ ok: true, fired: fire.ok, ...(fire.ok ? {} : { reason: fire.reason }) })
}
