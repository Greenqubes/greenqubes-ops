import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { deleteObject } from '@/lib/storage/r2'
import { canManageJobFiles } from '@/lib/storage/job-file-permissions'
import type { Role } from '@/lib/supabase/types'

// Delete a bucket AND its files (R2 objects + rows). files.bucket_id is
// ON DELETE SET NULL, so deleting only the bucket row would orphan its
// attachment rows into job chat (chat = kind 'attachment' with no bucket).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: bucketId } = await params

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

  type BucketRow = { id: string; job_id: string; name: string }
  const { data: bucket } = await service
    .from('attachment_buckets')
    .select('id, job_id, name')
    .eq('id', bucketId)
    .maybeSingle() as { data: BucketRow | null; error: unknown }
  // Already gone — treat as success so a double-tap never shows an error.
  if (!bucket) return NextResponse.json({ ok: true })

  // The Designer JO bucket is protected for every role, including scheduler
  // and admin (Task 8) — this route runs on the service client and bypasses
  // RLS, so the AttachmentBuckets UI hiding the trash icon isn't enough on
  // its own; the design-complete route and the Task 9 3-day reminder both
  // find this bucket by name, and a stray delete would silently break both.
  if (/designer\s*jo/i.test(bucket.name)) {
    return NextResponse.json({ error: 'Protected bucket' }, { status: 403 })
  }

  const { data: job } = await service
    .from('jobs')
    .select('status')
    .eq('id', bucket.job_id)
    .maybeSingle() as { data: { status: string } | null; error: unknown }

  const decision = canManageJobFiles(role, job?.status ?? null)
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason === 'completed' ? 'Job is completed' : 'Forbidden' },
      { status: 403 },
    )
  }

  type FileRow = { id: string; r2_key: string }
  const { data: files } = await service
    .from('files')
    .select('id, r2_key')
    .eq('bucket_id', bucketId) as { data: FileRow[] | null; error: unknown }

  for (const file of files ?? []) {
    if (!file.r2_key) continue
    try {
      await deleteObject(file.r2_key)
    } catch (e) {
      console.error('[bucket delete] R2 delete failed', file.r2_key, e)
      return NextResponse.json({ error: 'Storage delete failed' }, { status: 502 })
    }
  }

  const { error: filesError } = await service.from('files').delete().eq('bucket_id', bucketId)
  if (filesError) {
    console.error('[bucket delete] files DB delete failed', bucketId, filesError)
    return NextResponse.json({ error: 'Database delete failed' }, { status: 500 })
  }

  const { error: bucketError } = await service.from('attachment_buckets').delete().eq('id', bucketId)
  if (bucketError) {
    console.error('[bucket delete] bucket DB delete failed', bucketId, bucketError)
    return NextResponse.json({ error: 'Database delete failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, filesDeleted: (files ?? []).length })
}
