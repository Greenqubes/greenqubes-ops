import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNewJobUploadUrl, checkUpload } from '@/lib/storage/r2'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Signed PUT for a file attached on the New Job form, before the job exists
// (Nic, 2026-09-15). The object lands in the caller's OWN holding area
// (new-job/{userId}/…) — never in a job folder, never as a `files` row until
// the job is created and the file is copied across.
//
// Gated to the roles that can actually create a job (migration 0050's INSERT
// policy): there is no reason for anyone else to be filling a holding area.
const CREATE_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string; role: Role } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Not provisioned' }, { status: 403 })

  const role = await getEffectiveRole(profile.role)
  if (!CREATE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    filename?: string; contentType?: string; size?: number
  }
  const { filename, contentType, size } = body
  if (!filename || !contentType || typeof size !== 'number') {
    return NextResponse.json({ error: 'filename, contentType and size are required' }, { status: 400 })
  }

  // Same rules the job form's own uploads use, so a file accepted here cannot
  // be refused later when it is copied onto the job — the failure would land
  // after the job was already created, which is the worst possible moment.
  const check = checkUpload('attachment', contentType, size)
  if (!check.ok) {
    return NextResponse.json(
      { error: check.reason === 'type' ? 'That file type cannot be attached' : 'File too large' },
      { status: 400 },
    )
  }

  const { url, key } = await getNewJobUploadUrl(profile.id, filename, contentType)
  return NextResponse.json({ url, key })
}
