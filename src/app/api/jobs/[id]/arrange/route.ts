import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { stageOf } from '@/lib/utils/job-stage'
import {
  canArrange, nextArrangeState, parseArrangeAction, parseArrangeState, parseArrangement,
} from '@/lib/utils/arrange-rules'
import { runArrangeAction, ARRANGE_JOB_SELECT, type ArrangeJobRow } from '@/lib/arrange/actions'
import type { Role } from '@/lib/supabase/types'

/**
 * To arrange — the ONE write path for every button (spec 2026-11-04):
 *   sales side:      ready · client_ok · client_no · pull_back
 *   scheduler side:  offer · send_back · withdraw
 *
 * Checks, in order: signed in → the job is visible to the CALLER (read on
 * their own session, so 0062 pending privacy still decides) → it is Ongoing →
 * they are on the right side for this action (the REAL admin role counts,
 * since getEffectiveRole answers 'scheduler' for a plain admin) → the move is
 * valid from the state just read. The writes then happen on the service key
 * in src/lib/arrange/actions.ts, each conditional on that same state.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase.from('users').select('id, name, role')
    .eq('auth_id', user.id).maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)

  const raw = await req.json().catch(() => null)
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const action = parseArrangeAction(body.action)
  if (!action) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const { data: job } = await supabase.from('jobs').select(ARRANGE_JOB_SELECT)
    .eq('id', jobId).maybeSingle() as { data: ArrangeJobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (stageOf(job.status) !== 'ongoing') return NextResponse.json({ error: 'not_ongoing' }, { status: 409 })

  const viewer = { id: profile.id, role, isAdmin: profile.role === 'admin' }
  const rulesJob = {
    status: job.status, created_by: job.created_by, sales_poc_id: job.sales_poc_id,
    coordinatorIds: job.job_coordinators.map(c => c.user_id),
  }
  if (!canArrange(viewer, rulesJob, action)) return NextResponse.json({ error: 'not_permitted' }, { status: 403 })

  const state = parseArrangeState(job.arrange_state)
  if (nextArrangeState(state, action) === 'invalid') return NextResponse.json({ error: 'invalid_move' }, { status: 409 })

  const result = await runArrangeAction(
    { job, state, arrangement: parseArrangement(job.arrangement), viewer: { id: profile.id, name: profile.name } },
    action, body,
  )
  return NextResponse.json(result.body, { status: result.status })
}
