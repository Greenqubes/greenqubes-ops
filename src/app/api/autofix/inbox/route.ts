import { NextRequest, NextResponse } from 'next/server'
import { autofixSecretOk } from '@/lib/autofix/auth'
import { buildInbox } from '@/lib/autofix/inbox'
import { getRun } from '@/lib/autofix/store'

// The cloud fixer's work list for one run. Its only way to see reports and
// crashes — the cloud never holds a database key. Secret required (fails
// closed), and only for a run the app itself started.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!autofixSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const runId = req.nextUrl.searchParams.get('run')
  if (!runId) return NextResponse.json({ error: 'run is required' }, { status: 400 })
  const run = await getRun(runId)
  if (!run) return NextResponse.json({ error: 'Unknown run' }, { status: 404 })
  if (run.finished_at) return NextResponse.json({ error: 'Run already finished' }, { status: 409 })
  return NextResponse.json(await buildInbox(runId), { headers: { 'Cache-Control': 'no-store' } })
}
