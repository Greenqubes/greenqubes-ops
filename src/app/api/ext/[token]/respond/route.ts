import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getContactByToken } from '@/lib/supabase/queries/external'

// PUBLIC route — external contact accepts or declines a job from their link
// page. Only a still-'pending' link can be answered; once accepted/declined
// the buttons are gone and the office re-assigns if plans change.
export async function POST(
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
  const response: string | undefined =
    typeof body.response === 'string' ? body.response : undefined
  if (!jobId || (response !== 'accepted' && response !== 'declined')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('job_external_contacts')
    .update({ status: response })
    .eq('contact_id', check.contact.id)
    .eq('job_id', jobId)
    .eq('status', 'pending')
    .eq('is_suggestion', false)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
