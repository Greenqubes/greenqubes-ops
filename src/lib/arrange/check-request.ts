import type { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { stageOf } from '@/lib/utils/job-stage'
import {
  canArrange, nextArrangeState, parseArrangeState, parseArrangement, seenMatches, type ArrangeAction,
} from '@/lib/utils/arrange-rules'
import { ARRANGE_JOB_SELECT, type ArrangeJobRow, type ArrangeCtx } from './actions'
import type { Role } from '@/lib/supabase/types'

type SessionClient = Awaited<ReturnType<typeof createClient>>

export type ArrangeCheck =
  | { ok: true; ctx: ArrangeCtx }
  | { ok: false; status: number; error: string }

/**
 * Every check a To arrange button passes before anything is written, in the
 * order the single-job route has always run them (spec 2026-11-04):
 *   the job is visible to the CALLER (their own session, so 0062 pending
 *   privacy still decides) → it is Ongoing → they are on the right side for
 *   this action (the REAL admin role counts — getEffectiveRole answers
 *   'scheduler' for a plain admin) → the move is valid from the state just
 *   read → the screen saw that same state.
 * Shared by POST /api/jobs/[id]/arrange and the bulk pull back
 * (/api/arrange/pull-back-bulk) so the two can never drift apart.
 */
export async function loadArrangeRequest(
  supabase: SessionClient,
  profile: { id: string; name: string; role: Role },
  jobId: string,
  action: ArrangeAction,
  body: Record<string, unknown>,
): Promise<ArrangeCheck> {
  const role = await getEffectiveRole(profile.role)

  const { data: job } = await supabase.from('jobs').select(ARRANGE_JOB_SELECT)
    .eq('id', jobId).maybeSingle() as { data: ArrangeJobRow | null; error: unknown }
  if (!job) return { ok: false, status: 404, error: 'Not found' }
  if (stageOf(job.status) !== 'ongoing') return { ok: false, status: 409, error: 'not_ongoing' }

  const viewer = { id: profile.id, role, isAdmin: profile.role === 'admin' }
  const rulesJob = {
    status: job.status, created_by: job.created_by, sales_poc_id: job.sales_poc_id,
    coordinatorIds: job.job_coordinators.map(c => c.user_id),
  }
  if (!canArrange(viewer, rulesJob, action)) return { ok: false, status: 403, error: 'not_permitted' }

  const state = parseArrangeState(job.arrange_state)
  const arrangement = parseArrangement(job.arrangement)
  if (nextArrangeState(state, action) === 'invalid') return { ok: false, status: 409, error: 'invalid_move' }
  // The screen says what it saw. A withdraw + re-offer leaves the state
  // 'offered' again, so without this a stale screen could answer an offer
  // it never showed (review fix, 2026-11-04).
  if (!seenMatches(state, arrangement, body.seen)) return { ok: false, status: 409, error: 'state_changed' }

  return { ok: true, ctx: { job, state, arrangement, viewer: { id: profile.id, name: profile.name } } }
}
