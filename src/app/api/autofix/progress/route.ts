import { NextRequest, NextResponse } from 'next/server'
import { autofixSecretOk } from '@/lib/autofix/auth'
import { parseProgress } from '@/lib/autofix/progress'
import { setRunProgress } from '@/lib/autofix/store'

// The cloud fixer's one-line "where I'm up to" note during a run (Nic,
// 2026-11-05). Stored quietly; Nic sees it only when he asks the bot "how's it
// going?". Same secret as the inbox and report (fails closed), and only for a
// run that is still going — a finished run keeps its final result.
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!autofixSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 }) }
  const p = parseProgress(body)
  if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 })
  const stored = await setRunProgress(p.runId, p.note)
  if (!stored) return NextResponse.json({ error: 'Unknown or finished run' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
