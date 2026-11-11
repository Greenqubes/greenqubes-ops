import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runArrangeAction, titleOf } from '@/lib/arrange/actions'
import { loadArrangeRequest } from '@/lib/arrange/check-request'
import { alertSchedulers } from '@/lib/arrange/notify'
import { parseBulkBody, batchBellText } from '@/lib/utils/bulk-move'
import type { Role } from '@/lib/supabase/types'

/**
 * Bulk "Back to Ongoing" from the To arrange list (Nic, 2026-11-11; spec
 * 2026-11-11-gallery-groups-bulk-sheet-design.md Part 1). Each job passes the
 * SAME checks as its own Not ready / Back to Ongoing button
 * (loadArrangeRequest) and the same write (pull_back), but with that job's
 * bell card held back: the schedulers get ONE card for the whole batch, so
 * twenty jobs don't bury everything else in their bell. A batch of one sends
 * exactly the card a single pull back would, and it opens the job.
 *
 * Jobs run one after another, not all at once: each write is conditional on
 * the state just read, and a batch is small (BULK_MAX).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase.from('users').select('id, name, role')
    .eq('auth_id', user.id).maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobs = parseBulkBody(await req.json().catch(() => null))
  if (!jobs) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const results: Array<{ id: string; ok: boolean; status: number; error?: string }> = []
  const moved: Array<{ id: string; title: string }> = []
  for (const { id, seen } of jobs) {
    const check = await loadArrangeRequest(supabase, profile, id, 'pull_back', { seen })
    if (!check.ok) { results.push({ id, ok: false, status: check.status, error: check.error }); continue }
    const r = await runArrangeAction(check.ctx, 'pull_back', {}, { quiet: true })
    if (r.status === 200) {
      results.push({ id, ok: true, status: 200 })
      moved.push({ id, title: titleOf(check.ctx.job) })
    } else {
      results.push({ id, ok: false, status: r.status, error: typeof r.body.error === 'string' ? r.body.error : undefined })
    }
  }

  if (moved.length > 0) {
    await alertSchedulers(
      moved.length === 1 ? moved[0].id : null,
      { type: 'arrange_pulled_back', ...batchBellText(moved.map(m => m.title), profile.name) },
      null,
    )
  }

  return NextResponse.json({ results })
}
