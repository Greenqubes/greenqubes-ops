import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { deleteObject } from '@/lib/storage/r2'
import { canManageJobFiles, canDeleteJobFile } from '@/lib/storage/job-file-permissions'
import { canDeleteForEveryone, pageFileGates } from '@/lib/storage/gallery-delete'
import { gallerySourceOf } from '@/lib/utils/gallery'
import { loadDeleteContext, recordChatDeletion } from '@/lib/supabase/queries/gallery'
import { callerCanSeeJob } from '@/lib/supabase/queries/job-visibility'
import type { Role } from '@/lib/supabase/types'

// Move one attachment to another bucket on the same job. The R2 object never
// moves — a bucket is only the bucket_id column on the files row. The files
// table has no client-side UPDATE policy (RLS deny-by-default), so this route
// is the only path that can move a row. Same permission rules as delete:
// office roles, never installers, completed jobs locked.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: fileId } = await params

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

  const { bucketId } = await req.json() as { bucketId?: string }
  if (!bucketId) return NextResponse.json({ error: 'bucketId is required' }, { status: 400 })

  const role    = await getEffectiveRole(profile.role)
  const service = createServiceClient()

  type FileRow = { id: string; job_id: string | null }
  const { data: file } = await service
    .from('files')
    .select('id, job_id')
    .eq('id', fileId)
    .maybeSingle() as { data: FileRow | null; error: unknown }
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (file.job_id) {
    // Service client below bypasses RLS — ask the caller's own session first,
    // so a draft they do not share stays out of reach (pending privacy, 0062).
    if (!(await callerCanSeeJob(supabase, file.job_id))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
  }

  let jobStatus: string | null = null
  if (file.job_id) {
    const { data: job } = await service
      .from('jobs')
      .select('status')
      .eq('id', file.job_id)
      .maybeSingle() as { data: { status: string } | null; error: unknown }
    jobStatus = job?.status ?? null
  }

  const decision = canManageJobFiles(role, jobStatus)
  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.reason === 'completed' ? 'Job is completed' : 'Forbidden' },
      { status: 403 },
    )
  }

  // The target bucket must exist on the SAME job — no cross-job moves.
  const { data: bucket } = await service
    .from('attachment_buckets')
    .select('id, job_id')
    .eq('id', bucketId)
    .maybeSingle() as { data: { id: string; job_id: string } | null; error: unknown }
  if (!bucket || bucket.job_id !== file.job_id) {
    return NextResponse.json({ error: 'Bucket is not on this job' }, { status: 400 })
  }

  const { error: dbError } = await service
    .from('files')
    .update({ bucket_id: bucketId } as never)
    .eq('id', fileId)
  if (dbError) return NextResponse.json({ error: 'Database update failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// Delete one file: R2 object first, then the DB row. The files table has no
// client-side DELETE policy (RLS deny-by-default), so this route is the only
// path that can actually remove a row — the browser delete silently did nothing.
//
// Who may delete is canDeleteForEveryone (src/lib/storage/gallery-delete.ts),
// the SAME rule the job page's sections and the Gallery use (Nic, 2026-11-11):
// it follows the page, which is stricter than the database — production is
// view-only on the Files folders, designers on the photo sections, non-sharers
// on an Ongoing job's Files. A chat photo or file may be deleted by whoever
// sent it, schedulers and admin, and leaves a grey "deleted by" line.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: fileId } = await params

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
  const isAdmin = profile.role === 'admin'
  const service = createServiceClient()

  type FileRow = { id: string; job_id: string | null; r2_key: string; kind: string; bucket_id: string | null
    uploader_id: string | null; name: string | null; ts: string }
  const { data: file } = await service
    .from('files')
    .select('id, job_id, r2_key, kind, bucket_id, uploader_id, name, ts')
    .eq('id', fileId)
    .maybeSingle() as { data: FileRow | null; error: unknown }
  // Already gone — treat as success so a double-tap never shows an error.
  if (!file) return NextResponse.json({ ok: true })

  let allowed: boolean
  let refusal = 'Forbidden'
  const source = gallerySourceOf(file)
  if (file.job_id) {
    // Service client below bypasses RLS — ask the caller's own session first,
    // so a draft they do not share stays out of reach (pending privacy, 0062).
    if (!(await callerCanSeeJob(supabase, file.job_id))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const job = await loadDeleteContext(service, file.job_id)

    // Only matters for the last completion photo on a completed job.
    let otherCompletionFiles = 0
    if (file.kind === 'completion' && job?.status === 'completed') {
      const { count, error } = await service
        .from('files')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', file.job_id)
        .eq('kind', 'completion')
        .neq('id', file.id)
      // Unknown count → assume this is the last one; refusing is the safe side.
      otherCompletionFiles = error ? 0 : (count ?? 0)
    }

    const gates = job
      ? pageFileGates({ role, isAdmin, viewerId: profile.id, job })
      : { filesLocked: false, designBriefEditable: false }
    allowed = canDeleteForEveryone({
      role, isAdmin, viewerId: profile.id, source, fileKind: file.kind, byId: file.uploader_id,
      jobStatus: job?.status ?? null, completedAt: job?.completed_at ?? null, otherCompletionFiles,
      filesLocked: gates.filesLocked, designBriefEditable: gates.designBriefEditable,
    })
    if (!allowed) {
      // Keep the old, specific wording where the photo-section rule applies.
      const legacy = canDeleteJobFile({
        role, jobStatus: job?.status ?? null, completedAt: job?.completed_at ?? null,
        fileKind: file.kind, otherCompletionFiles,
      })
      if (!legacy.allowed && legacy.reason === 'completed') refusal = 'Job is completed — files lock 24 hours after completion'
      if (!legacy.allowed && legacy.reason === 'last-completion') refusal = 'A completed job must keep at least one completion photo — upload the right one first'
    }
  } else {
    // An orphaned file (its job is gone): office clean-up, as before.
    allowed = canDeleteJobFile({ role, jobStatus: null, completedAt: null, fileKind: file.kind, otherCompletionFiles: 0 }).allowed
  }
  if (!allowed) return NextResponse.json({ error: refusal }, { status: 403 })

  // R2 object goes first; a failure here leaves the row (and the file) intact
  // rather than stranding an invisible object in storage.
  if (file.r2_key) {
    try {
      await deleteObject(file.r2_key)
    } catch (e) {
      console.error('[files delete] R2 delete failed', file.r2_key, e)
      return NextResponse.json({ error: 'Storage delete failed' }, { status: 502 })
    }
  }

  const { error: dbError } = await service.from('files').delete().eq('id', fileId)
  if (dbError) {
    console.error('[files delete] DB delete failed', fileId, dbError)
    return NextResponse.json({ error: 'Database delete failed' }, { status: 500 })
  }

  if (source === 'chat' && file.job_id) {
    await recordChatDeletion(service, {
      jobId: file.job_id, itemName: file.name ?? file.r2_key, isVoice: false, itemTs: file.ts,
      deletedBy: profile.id, deletedByName: profile.name,
    })
  }

  return NextResponse.json({ ok: true })
}
