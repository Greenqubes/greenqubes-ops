import { NextRequest, NextResponse } from 'next/server'
import { runDigest } from '@/lib/digest/run'

// Called by Vercel cron every Monday at 09:00 SGT (01:00 UTC) — see vercel.json.
// Also callable manually: GET /api/cron/monday-digest
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
    const result = await runDigest()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/monday-digest]', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
