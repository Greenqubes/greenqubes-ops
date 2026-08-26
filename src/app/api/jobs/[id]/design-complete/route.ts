import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { ratingSuspect } from '@/lib/utils/design-rating-trust'
import type { Role } from '@/lib/supabase/types'

// Tick a job's design work as done. Two paths:
//  - Designer path: the assigned designer (a job_designers row for this job
//    + user) MUST send a 1-5 rating — it feeds ratingSuspect (trust check)
//    against the AI's own brief-time complexity guess and the actual time
//    taken, both stored for Task 11's Flagged strip.
//  - Override path: scheduler/admin who is NOT an assigned designer (an
//    assigned designer can't also be scheduler/admin — one role per user, no
//    special case needed) ticks it with no rating — never fake data.
// Both paths 409 unless the job's DESIGNER JO bucket already has >=1 file —
// the tick and the Task 9 3-day reminder both key off that bucket's contents.
export async function POST(
  req: NextRequest,
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

  const effectiveRole = await getEffectiveRole(profile.role)
  const svc = createServiceClient()

  type JobRow = { id: string; design_complexity: number | null }
  const { data: job } = await svc
    .from('jobs')
    .select('id, design_complexity')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type DesignerRow = { assigned_at: string }
  const { data: ownAssignment } = await svc
    .from('job_designers')
    .select('assigned_at')
    .eq('job_id', jobId)
    .eq('user_id', profile.id)
    .maybeSingle() as { data: DesignerRow | null; error: unknown }
  const isAssignedDesigner = !!ownAssignment
  const isOverride = ['scheduler', 'admin'].includes(effectiveRole)

  if (!isOverride && !isAssignedDesigner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: joBucket } = await svc.from('attachment_buckets')
    .select('id, name').eq('job_id', jobId).ilike('name', '%designer jo%').maybeSingle()
  let hasJoFile = false
  if (joBucket) {
    const { count } = await svc.from('files')
      .select('id', { count: 'exact', head: true }).eq('bucket_id', joBucket.id)
    hasJoFile = (count ?? 0) > 0
  }
  if (!hasJoFile) return NextResponse.json({ error: 'no-jo-file' }, { status: 409 })

  if (isAssignedDesigner) {
    const { rating } = await req.json().catch(() => ({})) as { rating?: unknown }
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'rating-required' }, { status: 400 })
    }

    // daysTaken: earliest job_designers.assigned_at across the WHOLE design
    // team on this job (work started the moment the first designer landed
    // on it) → now, fractional days.
    const { data: allAssignments } = await svc
      .from('job_designers')
      .select('assigned_at')
      .eq('job_id', jobId) as { data: Array<{ assigned_at: string }> | null; error: unknown }
    const earliestMs = (allAssignments ?? []).reduce<number | null>((min, row) => {
      const t = Date.parse(row.assigned_at)
      return min === null || t < min ? t : min
    }, null)
    const daysTaken = earliestMs === null ? 0 : (Date.now() - earliestMs) / (24 * 60 * 60 * 1000)

    const suspect = ratingSuspect({ rating, aiComplexity: job.design_complexity, daysTaken })
    const { error: updateError } = await svc.from('jobs').update({
      design_completed_at:     new Date().toISOString(),
      design_completed_by:     profile.id,
      design_rated_complexity: rating,
      design_rating_suspect:   suspect,
    } as never).eq('id', jobId)
    if (updateError) {
      console.error('[design-complete] designer update failed', jobId, updateError)
      return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Override path — no rating accepted or written, even if the body sent one.
  const { error: updateError } = await svc.from('jobs').update({
    design_completed_at: new Date().toISOString(),
    design_completed_by: profile.id,
  } as never).eq('id', jobId)
  if (updateError) {
    console.error('[design-complete] override update failed', jobId, updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
