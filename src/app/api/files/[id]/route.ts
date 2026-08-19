import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { deleteObject } from '@/lib/storage/r2'
import { canManageJobFiles } from '@/lib/storage/job-file-permissions'
import type { Role } from '@/lib/supabase/types'

// Delete one attachment: R2 object first, then the DB row. The files table has
// no client-side DELETE policy (RLS deny-by-default), so this route is the only
// path that can actually remove a row — the browser delete silently did nothing.
export async function DELETE(
  _req: NextRequest,
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

  const role = await getEffectiveRole(profile.role)
  const service = createServiceClient()

  type FileRow = { id: string; job_id: string | null; r2_key: string }
  const { data: file } = await service
    .from('files')
    .select('id, job_id, r2_key')
    .eq('id', fileId)
    .maybeSingle() as { data: FileRow | null; error: unknown }
  // Already gone — treat as success so a double-tap never shows an error.
  if (!file) return NextResponse.json({ ok: true })

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

  return NextResponse.json({ ok: true })
}
