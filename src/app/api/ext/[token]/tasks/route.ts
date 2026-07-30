import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getContactByToken, getContactJobLink } from '@/lib/supabase/queries/external'

// PUBLIC route — the external contact ticks a task off on site. Allowed only
// on jobs they accepted. completed_by stays NULL (external people have no
// users row); completed_at still records when it was done.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const check = await getContactByToken(token)
  if (check.state !== 'valid') {
    return NextResponse.json({ error: 'invalid' }, { status: 410 })
  }

  const body = await req.json().catch(() => ({}))
  const jobId: string | undefined =
    typeof body.job_id === 'string' ? body.job_id : undefined
  const taskId: string | undefined =
    typeof body.task_id === 'string' ? body.task_id : undefined
  const isCompleted: boolean | undefined =
    typeof body.is_completed === 'boolean' ? body.is_completed : undefined
  if (!jobId || !taskId || isCompleted === undefined) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const link = await getContactJobLink(check.contact.id, jobId)
  if (link !== 'accepted') {
    return NextResponse.json({ error: 'not_accepted' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('job_tasks')
    .update({
      is_completed: isCompleted,
      completed_by: null,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', taskId)
    .eq('job_id', jobId)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
