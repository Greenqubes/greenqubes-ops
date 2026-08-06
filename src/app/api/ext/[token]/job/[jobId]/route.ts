import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getContactByToken, getContactJobLink } from '@/lib/supabase/queries/external'
import { getDownloadUrl } from '@/lib/storage/r2'

// PUBLIC route — full job detail for the external contact's link page.
// Unlocks only AFTER the contact accepted the job (mockup rule: attachments
// etc. stay hidden while a job is pending or declined).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; jobId: string }> },
) {
  const { token, jobId } = await params

  const check = await getContactByToken(token)
  if (check.state !== 'valid') {
    return NextResponse.json({ error: 'invalid' }, { status: 410 })
  }

  const link = await getContactJobLink(check.contact.id, jobId)
  if (link !== 'accepted') {
    return NextResponse.json({ error: 'not_accepted' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: job } = await supabase
    .from('jobs')
    .select(`
      id, project_title, client, location, date, date_end, time_start, time_end,
      punctuality, status, description, notes, client_poc_name, client_poc_phone,
      sales_poc_id
    `)
    .eq('id', jobId)
    .maybeSingle()
  if (!job) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Job document buckets (Permit-to-Work, BCA, Designer JO, …) — read-only.
  // Chat files (kind 'attachment' with no bucket) are NOT exposed.
  const { data: files } = await supabase
    .from('files')
    .select('id, kind, r2_key, name, url_text, ts')
    .eq('job_id', jobId)
    .not('bucket_id', 'is', null)
    .order('ts', { ascending: true })

  const attachments = await Promise.all(
    (files ?? []).map(async f => ({
      id:   f.id,
      kind: f.kind,
      name: f.kind === 'url_link'
        ? (f.url_text ?? 'Link')
        : (f.name ?? f.r2_key.split('/').pop() ?? 'file'),
      url:  f.kind === 'url_link' ? (f.url_text ?? '') : await getDownloadUrl(f.r2_key, f.name ?? undefined),
    })),
  )

  const { data: tasks } = await supabase
    .from('job_tasks')
    .select('id, text, is_completed, sort_order')
    .eq('job_id', jobId)
    .order('sort_order', { ascending: true })

  // Person-in-charge (chat is deferred — externals ring them instead).
  // Separate query: never embed users directly onto jobs (standing rule).
  let personInCharge: { name: string; phone: string | null } | null = null
  if (job.sales_poc_id) {
    const { data: poc } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', job.sales_poc_id)
      .maybeSingle()
    if (poc) personInCharge = { name: poc.name, phone: poc.phone }
  }

  return NextResponse.json({
    job,
    attachments,
    tasks: tasks ?? [],
    personInCharge,
  })
}
