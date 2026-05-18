import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

export async function DELETE(
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

  const effectiveRole = await getEffectiveRole(profile.role)
  if (effectiveRole !== 'sales') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  type JobRow = { id: string; status: string }
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending jobs can be deleted' }, { status: 409 })
  }

  await supabase.from('jobs').delete().eq('id', jobId).throwOnError()

  return NextResponse.json({ ok: true })
}
