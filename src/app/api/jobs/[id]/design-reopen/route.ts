import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Undo an accidental (or premature) design completion. Scheduler/admin
// override path mirrors revert-complete's gate + shape (Task 8 brief).
// Smoke feedback edit 6 (Nic, 2026-08-27): an ASSIGNED designer of this job
// may also reopen (last-minute artwork changes) — same job_designers
// membership check as design-complete's isAssignedDesigner. The job
// reappears in the Design Load board because that view derives its open set
// from design_completed_at is null. Rating-clear behaviour below is
// unchanged either way: reopen always clears the rating; re-completing
// re-rates fresh.
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
  const service = createServiceClient()

  const isOverride = ['scheduler', 'admin'].includes(role)
  type DesignerRow = { assigned_at: string }
  const { data: ownAssignment } = await service
    .from('job_designers')
    .select('assigned_at')
    .eq('job_id', jobId)
    .eq('user_id', profile.id)
    .maybeSingle() as { data: DesignerRow | null; error: unknown }
  const isAssignedDesigner = !!ownAssignment

  if (!isOverride && !isAssignedDesigner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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
