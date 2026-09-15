import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { copyObject, deleteObject, generateKey } from '@/lib/storage/r2'
import { ownsNewJobScratchKey, isDefaultBucketName } from '@/lib/storage/new-job-attachments'

// Moves files from the New Job form's holding area onto the job that was just
// created (Nic, 2026-09-15). Called by NewJobShell straight after the insert.
//
// The keys arrive from the browser, so EVERY one is checked against the
// caller's own holding area before anything is copied — without that, a caller
// could name any object in the bucket and have it copied onto their new job,
// including a file from a job they are not allowed to open. See
// ownsNewJobScratchKey, which is tested for exactly that.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // The job must be visible to the caller under their OWN policies — this is
  // the session client, not the service one, so RLS answers the question.
  type JobRow = { id: string; r2_folder: string | null }
  const { data: job } = await supabase
    .from('jobs')
    .select('id, r2_folder')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({})) as {
    files?: Array<{ key?: string; name?: string; bucket?: string }>
  }
  const incoming = Array.isArray(body.files) ? body.files : []
  if (incoming.length === 0) return NextResponse.json({ attached: 0, skipped: 0 })

  const service = createServiceClient()

  // Each file carries the NAME of the bucket it was filed into on the form —
  // IDs did not exist then. Matching them up here is what makes a permit
  // filed under PERMIT-TO-WORK still be there after the job is saved, rather
  // than reappearing under OTHERS as if it had moved (Nic, 2026-09-15).
  type BucketRow = { id: string; name: string }
  const { data: buckets } = await service
    .from('attachment_buckets')
    .select('id, name')
    .eq('job_id', jobId) as { data: BucketRow[] | null; error: unknown }

  const bucketIdByName = new Map((buckets ?? []).map(b => [b.name, b.id]))

  let attached = 0
  let skipped  = 0
  // Why each file was skipped, in the response AND in the Vercel log. Counting
  // silently is what made the 2026-09-15 failure undiagnosable: the job saved,
  // the files did not, and nothing recorded the reason. Same `[route] …`
  // logging the design-brief PATCH added for the same lesson.
  const reasons: string[] = []
  const skip = (why: string) => {
    skipped++
    if (!reasons.includes(why)) reasons.push(why)
    console.error(`[attach-pending-files] job=${jobId} skipped: ${why}`)
  }

  for (const item of incoming) {
    const key  = typeof item?.key === 'string' ? item.key : ''
    const name = typeof item?.name === 'string' && item.name ? item.name : 'file'

    if (!ownsNewJobScratchKey(profile.id, key)) { skip('key not in your holding area'); continue }

    // An unknown bucket name would file the upload nowhere visible, which is
    // the confusion this whole change exists to remove — so fall back to
    // OTHERS rather than leaving the file with no bucket at all.
    const wanted   = typeof item?.bucket === 'string' && isDefaultBucketName(item.bucket)
      ? item.bucket
      : 'OTHERS'
    const bucketId = bucketIdByName.get(wanted) ?? bucketIdByName.get('OTHERS') ?? null

    const destKey = generateKey(job.r2_folder ?? job.id, 'attachment', name)
    try {
      await copyObject(key, destKey)
    } catch (e) {
      skip('copy failed: ' + (e instanceof Error ? e.message : 'unknown'))
      continue
    }

    const { error: fileError } = await service.from('files').insert({
      job_id:      jobId,
      bucket_id:   bucketId,
      kind:        'attachment',
      r2_key:      destKey,
      name,
      uploader_id: profile.id,
      visibility:  ['role:sales', 'role:scheduler'],
    } as never)

    if (fileError) {
      // The copy landed but the row did not — remove the orphan rather than
      // leave a file in the job's folder that nothing points at.
      await deleteObject(destKey).catch(() => {})
      skip('could not record the file: ' + (fileError.message ?? 'unknown'))
      continue
    }

    attached++
    // The holding-area copy has served its purpose. A failure here is not
    // worth failing the request over: the cleanup cron sweeps the prefix.
    await deleteObject(key).catch(() => {})
  }

  console.error(`[attach-pending-files] job=${jobId} sent=${incoming.length} attached=${attached} skipped=${skipped}`)
  return NextResponse.json({ attached, skipped, error: reasons.join('; ') || undefined })
}
