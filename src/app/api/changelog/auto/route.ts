import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { autoLineFor, todaySgt, type AutoLine } from '@/lib/autofix/whats-new'

// Auto-fix lines for the What's new pop-up — the one-line, reader's-side
// sentence the fixer wrote for each fix that went live, dated by Nic's rule:
// major on the day, minor on the following Monday. Only those three fields
// leave the server. Fail-soft: before migration 0069 (or on any error) the
// answer is [] and the pop-up shows its hand-written entries as before.
export const dynamic = 'force-dynamic'

type Row = {
  severity:       'major' | 'minor' | null
  whats_new_line: string | null
  status:         string
  live_at:        string | null
  going_live_at:  string | null
  merge_sha:      string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const headers = { 'Cache-Control': 'no-store' }
  try {
    const { data, error } = await createServiceClient()
      .from('autofix_items' as never)
      .select('severity, whats_new_line, status, live_at, going_live_at, merge_sha')
      .in('status', ['live', 'going_live'])
      .not('whats_new_line', 'is', null)
    if (error) return NextResponse.json([], { headers })

    // A fix whose merge commit IS the build answering this request is live for
    // this reader even if the once-a-minute watcher hasn't marked it yet — a
    // tab that refreshed straight after the deploy must still see the line.
    const running = process.env.VERCEL_GIT_COMMIT_SHA
    const today = todaySgt()
    const lines: AutoLine[] = []
    for (const r of (data ?? []) as Row[]) {
      const liveAt = r.status === 'live' ? r.live_at : (running && r.merge_sha === running ? r.going_live_at : null)
      if (!liveAt || !r.severity || !r.whats_new_line) continue
      const line = autoLineFor({ severity: r.severity, liveAt, line: r.whats_new_line })
      if (line.date <= today) lines.push(line)
    }
    return NextResponse.json(lines, { headers })
  } catch {
    return NextResponse.json([], { headers })
  }
}
