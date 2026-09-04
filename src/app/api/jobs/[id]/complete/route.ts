import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobCompleted } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

// An installer finishes their own job from the field (Nic, 2026-09-04).
// Installer-only: office roles keep their existing client-side paths (the
// scheduler's photo-free "Mark job complete" override stays untouched).
// Runs through the service client because installers have no jobs UPDATE
// policy — same pattern as revert-complete. The gate mirrors the button's
// completion-rules: formally assigned + scheduled + ≥1 completion photo.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getEffectiveRole(profile.role)
  if (role !== 'installer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  type JobRow = {
    id: string; status: string; sales_poc_id: string | null
    project_title: string | null; client: string; date: string
    time_start: string | null; time_end: string | null; location: string
  }
  const { data: job } = await service
    .from('jobs')
    .select('id, status, sales_poc_id, project_title, client, date, time_start, time_end, location')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Only a FORMALLY assigned installer may complete — a suggestion is not
  // an assignment (Workflow V2 rule, migration 0037).
  const { data: assignment } = await service
    .from('job_assignees')
    .select('user_id')
    .eq('job_id', jobId)
    .eq('user_id', profile.id)
    .eq('is_suggestion', false)
    .maybeSingle() as { data: { user_id: string } | null; error: unknown }
  if (!assignment) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Double-tap after a successful completion — nothing left to do.
  if (job.status === 'completed') return NextResponse.json({ ok: true })
  if (job.status !== 'scheduled') {
    return NextResponse.json({ error: 'Job is not scheduled' }, { status: 409 })
  }

  // Photo-required completion: at least one completion photo must exist.
  // The scheduler's override lives elsewhere; this route never bypasses it.
  const { count: photoCount } = await service
    .from('files')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('kind', 'completion')
  if (!photoCount) {
    return NextResponse.json({ error: 'no_completion_photo' }, { status: 409 })
  }

  const { error: updateError } = await service
    .from('jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() } as never)
    .eq('id', jobId)
    .eq('status', 'scheduled')
  if (updateError) {
    console.error('[jobs/complete] update failed', jobId, updateError)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  // Tell the sales POC the job is done (Nic's call, 2026-09-04). Awaited —
  // Vercel kills fire-and-forget work — but never fails the completion.
  if (job.sales_poc_id) {
    try {
      const { data: poc } = await service
        .from('users')
        .select('telegram_chat_id')
        .eq('id', job.sales_poc_id)
        .is('deleted_at', null)
        .maybeSingle() as { data: { telegram_chat_id: string | null } | null; error: unknown }
      if (poc?.telegram_chat_id) {
        await sendTelegram(poc.telegram_chat_id, tplJobCompleted({
          projectTitle:  job.project_title,
          jobClient:     job.client,
          jobDate:       job.date,
          timeStart:     job.time_start,
          timeEnd:       job.time_end,
          location:      job.location,
          installerName: profile.name,
          jobUrl:        `${APP_URL}/jobs/${jobId}`,
        }))
      }
    } catch (err) {
      console.error('[jobs/complete] telegram failed', jobId, err)
    }
  }

  return NextResponse.json({ ok: true })
}
