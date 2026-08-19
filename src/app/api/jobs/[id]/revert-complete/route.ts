import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Revert an accidentally completed job back to 'scheduled'. Every role except
// installer may do this (Nic, 2026-08-19). Runs through the service client
// because jobs RLS blocks sales (own pending only) and designer (no UPDATE)
// from touching completed rows — same pattern as the file-delete routes.
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
  if (role === 'installer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  type JobRow = { id: string; status: string; scheduled_at: string | null }
  const { data: job } = await service
    .from('jobs')
    .select('id, status, scheduled_at')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Double-tap after a successful revert — nothing left to do.
  if (job.status === 'scheduled') return NextResponse.json({ ok: true })
  if (job.status !== 'completed') {
    return NextResponse.json({ error: 'Job is not completed' }, { status: 409 })
  }

  const { error: updateError } = await service
    .from('jobs')
    .update({ status: 'scheduled', completed_at: null } as never)
    .eq('id', jobId)
    .eq('status', 'completed')
  if (updateError) {
    console.error('[revert-complete] update failed', jobId, updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // The stamp_scheduled_at trigger (0038) just re-stamped the FCFS rank to
  // now(); an undo must not send the job to the back of the queue. This
  // second update doesn't touch status, so the trigger stays quiet.
  if (job.scheduled_at) {
    const { error: rankError } = await service
      .from('jobs')
      .update({ scheduled_at: job.scheduled_at } as never)
      .eq('id', jobId)
    if (rankError) {
      // Job is already back on the schedule — losing the old rank is not
      // worth failing the whole revert over. Log and carry on.
      console.error('[revert-complete] rank restore failed', jobId, rankError)
    }
  }

  return NextResponse.json({ ok: true })
}
