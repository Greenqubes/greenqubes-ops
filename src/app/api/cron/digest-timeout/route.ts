import { NextRequest, NextResponse } from 'next/server'
import { runDigestTimeout } from '@/lib/digest/timeout'

// Called by Vercel cron daily at 00:00 UTC (08:00 SGT) — see vercel.json.
// Also callable manually: GET /api/cron/digest-timeout
// with Authorization: Bearer <CRON_SECRET>

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const result = await runDigestTimeout()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/digest-timeout]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
