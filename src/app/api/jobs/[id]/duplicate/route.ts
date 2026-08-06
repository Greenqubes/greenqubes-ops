import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { copyObject, generateKey } from '@/lib/storage/r2'
import type { Role, FileKind } from '@/lib/supabase/types'

const DUPLICATE_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

// Duplicate a job: Details-tab fields + attachment buckets + production photos
// copy over; location is blanked, team/chat/tasks start empty, status pending.
// Stored files are truly copied in R2 so the two jobs never share an object.
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
  if (!DUPLICATE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  type SourceJob = {
    project_title: string | null; date: string; date_end: string | null
    time_start: string | null; time_end: string | null; client: string
    description: string | null; client_poc_name: string | null
    client_poc_phone: string | null; production_ready: boolean
    do_issued: boolean; punctuality: string
    production_instructions: string | null
  }
  const { data: source } = await service
    .from('jobs')
    .select('project_title, date, date_end, time_start, time_end, client, description, client_poc_name, client_poc_phone, production_ready, do_issued, punctuality, production_instructions')
    .eq('id', jobId)
    .maybeSingle() as { data: SourceJob | null; error: unknown }
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── New pending job — location blanked, POC = duplicator ────────────────────
  const { data: newJob, error: insertError } = await service
    .from('jobs')
    .insert({
      status:                  'pending',
      project_title:           source.project_title ? `${source.project_title} (Copy)` : null,
      date:                    source.date,
      date_end:                source.date_end,
      time_start:              source.time_start,
      time_end:                source.time_end,
      client:                  source.client,
      location:                '',
      description:             source.description,
      client_poc_name:         source.client_poc_name,
      client_poc_phone:        source.client_poc_phone,
      production_ready:        source.production_ready,
      do_issued:               source.do_issued,
      punctuality:             source.punctuality,
      production_instructions: source.production_instructions,
      notes:                   null,
      sales_poc_id:            profile.id,
      visibility:              ['role:sales', 'role:scheduler'],
    } as never)
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: Error | null }
  if (insertError || !newJob) {
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }

  // ── Copy attachment buckets (old id → new id map) ───────────────────────────
  type BucketRow = { id: string; name: string; position: number }
  const { data: buckets } = await service
    .from('attachment_buckets')
    .select('id, name, position')
    .eq('job_id', jobId)
    .order('position') as { data: BucketRow[] | null; error: unknown }

  const bucketMap = new Map<string, string>()
  for (const bucket of buckets ?? []) {
    const { data: newBucket } = await service
      .from('attachment_buckets')
      .insert({ job_id: newJob.id, name: bucket.name, position: bucket.position } as never)
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: unknown }
    if (newBucket) bucketMap.set(bucket.id, newBucket.id)
  }

  // ── Copy files: bucket uploads/links + production photos ────────────────────
  // Chat attachments (kind 'attachment', NULL bucket_id) and do/completion
  // proof photos are deliberately excluded.
  type FileRow = {
    bucket_id: string | null; kind: FileKind; r2_key: string
    url_text: string | null; visibility: string[]
  }
  const { data: sourceFiles } = await service
    .from('files')
    .select('bucket_id, kind, r2_key, url_text, visibility')
    .eq('job_id', jobId)
    .or('bucket_id.not.is.null,kind.eq.production_instructions') as { data: FileRow[] | null; error: unknown }

  let skippedFiles = 0
  for (const file of sourceFiles ?? []) {
    const newBucketId = file.bucket_id ? bucketMap.get(file.bucket_id) ?? null : null
    if (file.bucket_id && !newBucketId) { skippedFiles++; continue }

    let newKey = file.r2_key
    if (file.kind !== 'url_link' && file.r2_key) {
      // True storage copy under the new job's folder; keep the extension.
      newKey = generateKey(newJob.id, file.kind, file.r2_key.split('/').pop() ?? 'file')
      try {
        await copyObject(file.r2_key, newKey)
      } catch {
        skippedFiles++
        continue
      }
    }

    const { error: fileError } = await service.from('files').insert({
      job_id:      newJob.id,
      bucket_id:   newBucketId,
      kind:        file.kind,
      r2_key:      newKey,
      url_text:    file.url_text,
      uploader_id: profile.id,
      visibility:  file.visibility,
    } as never)
    if (fileError) skippedFiles++
  }

  return NextResponse.json({ id: newJob.id, skippedFiles })
}
