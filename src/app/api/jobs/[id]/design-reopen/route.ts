import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Undo an accidental (or premature) design completion. Scheduler/admin only —
// mirrors revert-complete's gate + shape (Task 8 brief: read that route first
// and mirror it). The job reappears in the Design Load board because that
// view derives its open set from design_completed_at is null.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getEffectiveRole(profile.role)
  if (!['scheduler', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  type JobRow = { id: string; design_completed_at: string | null }
  const { data: job } = await service
    .from('jobs')
    .select('id, design_completed_at')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Double-tap after a successful reopen — nothing left to do.
  if (!job.design_completed_at) return NextResponse.json({ ok: true })

  const { error: updateError } = await service
    .from('jobs')
    .update({
      design_completed_at:      null,
      design_completed_by:      null,
      design_rated_complexity:  null,
      design_rating_suspect:    false,
      design_rating_resolution: null,
    } as never)
    .eq('id', jobId)
    .not('design_completed_at', 'is', null)
  if (updateError) {
    console.error('[design-reopen] update failed', jobId, updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
