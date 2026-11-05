import { NextRequest, NextResponse } from 'next/server'
import { cronSecretOk } from '@/lib/autofix/auth'
import { watchGoingLive } from '@/lib/autofix/go-live'
import { alertStaleRuns } from '@/lib/autofix/watchdog'
import { staleUnalertedRuns, markRunAlerted } from '@/lib/autofix/store'
import { sendBugTelegramChunks } from '@/lib/telegram/bot'

// Every minute (vercel.json). Two small jobs, both no-ops on almost every tick:
// 1. a fix Nic sent live — has production switched over yet? ("Live at 9:14pm")
// 2. a fixer run that hasn't reported back — one heads-up to Nic; the run is
//    left open so a slow night's report still lands (watchdog.ts).
// Manual run: GET with Authorization: Bearer <CRON_SECRET>
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (!cronSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const going = await watchGoingLive()
  const stalled = await alertStaleRuns({
    stale:       staleUnalertedRuns,
    markAlerted: markRunAlerted,
    tell:        sendBugTelegramChunks,
  })

  return NextResponse.json({ ok: true, going, stalled })
}
