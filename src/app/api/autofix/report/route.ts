import { NextRequest, NextResponse } from 'next/server'
import { autofixSecretOk } from '@/lib/autofix/auth'
import { parseReport } from '@/lib/autofix/report-parse'
import { applyReport } from '@/lib/autofix/report'

// The cloud fixer hands back its verdicts and fixes here. Everything is
// validated (parseReport) and every fix re-measured by the app (gateFix)
// before Nic is told about it. A second report for the same run → 409.
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  if (!autofixSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 }) }
  const parsed = parseReport(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const result = await applyReport(parsed.report)
  if (result.status === 'unknown-run') return NextResponse.json({ error: 'Unknown run' }, { status: 404 })
  if (result.status === 'conflict')    return NextResponse.json({ error: 'Run already reported' }, { status: 409 })
  return NextResponse.json({ ok: true, applied: result.applied, telegramSent: result.telegramSent })
}
