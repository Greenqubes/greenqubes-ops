import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Assign / unassign an existing external contact to one job. The contact's
// persistent link automatically starts showing the job (status 'pending' until
// they Accept/Decline from their /ext page).

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, ok: false }

  type ProfileRow = { role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return { supabase, ok: false }

  const effectiveRole = await getEffectiveRole(profile.role)
  return { supabase, ok: ['scheduler', 'coordinator', 'admin'].includes(effectiveRole) }
}

// GET — contacts linked to this job (with response status)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, ok } = await requireManager()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('job_external_contacts')
    .select('contact_id, status, assigned_at')
    .eq('job_id', jobId)
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — link an existing contact to this job
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, ok } = await requireManager()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const contactId: string | undefined =
    typeof body.contact_id === 'string' ? body.contact_id : undefined
  if (!contactId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { error } = await supabase
    .from('job_external_contacts')
    .upsert(
      { job_id: jobId, contact_id: contactId, status: 'pending' } as never,
      { onConflict: 'job_id,contact_id', ignoreDuplicates: true },
    )
  if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — unlink a contact from this job (their other jobs are untouched)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, ok } = await requireManager()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const contactId: string | undefined =
    typeof body.contact_id === 'string' ? body.contact_id : undefined
  if (!contactId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { error } = await supabase
    .from('job_external_contacts')
    .delete()
    .eq('job_id', jobId)
    .eq('contact_id', contactId)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
