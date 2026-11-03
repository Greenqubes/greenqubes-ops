import { NextRequest, NextResponse } from 'next/server'
import { cronSecretOk } from '@/lib/autofix/auth'
import { watchGoingLive } from '@/lib/autofix/go-live'
import { staleUnalertedRuns, markRunAlerted, finishRun } from '@/lib/autofix/store'
import { sendBugTelegramChunks } from '@/lib/telegram/bot'
import { escapeHtml } from '@/lib/autofix/nightly-message'

// Every minute (vercel.json). Two small jobs, both no-ops on almost every tick:
// 1. a fix Nic sent live — has production switched over yet? ("Live at 9:14pm")
// 2. a fixer run that never reported back — tell Nic rather than go quiet.
//    A cloud run can stall waiting for a person who isn't there.
// Manual run: GET with Authorization: Bearer <CRON_SECRET>
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!cronSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const going = await watchGoingLive()

  const stale = await staleUnalertedRuns()
  for (const r of stale) {
    await markRunAlerted(r.id)
    await finishRun(r.id, 'stalled')
    await sendBugTelegramChunks(
      "The fixer's run didn't finish, so nothing new was sorted this time." +
      (r.session_url ? `\nIts log: ${escapeHtml(r.session_url)}` : ''),
    )
  }

  return NextResponse.json({ ok: true, going, stalled: stale.length })
}
