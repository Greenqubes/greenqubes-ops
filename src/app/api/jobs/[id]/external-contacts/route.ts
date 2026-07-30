import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Assign / suggest / unassign an external contact on one job.
//
//   scheduler / coordinator / admin  → real link (contact's page shows the job)
//   sales                            → SUGGESTION (amber; invisible to the
//                                      contact until a scheduler confirms —
//                                      same rules as installer suggestions)
//   designer / production            → read-only
//
// Confirming = a manager POSTing a contact who currently has a suggestion row:
// the row upgrades in place (is_suggestion → false).

const MANAGE_ROLES = ['scheduler', 'coordinator', 'admin']
const READ_ROLES   = ['sales', 'scheduler', 'coordinator', 'admin', 'designer', 'production']

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, profile: null, effectiveRole: '' }

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return { supabase, profile: null, effectiveRole: '' }

  const effectiveRole = await getEffectiveRole(profile.role)
  return { supabase, profile, effectiveRole }
}

// GET — contacts linked to this job (with response status + suggestion flag)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, profile, effectiveRole } = await getProfile()
  if (!profile || !READ_ROLES.includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('job_external_contacts')
    .select('contact_id, status, is_suggestion, assigned_at')
    .eq('job_id', jobId)
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — managers link (or confirm a suggestion); sales suggest
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, profile, effectiveRole } = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const contactId: string | undefined =
    typeof body.contact_id === 'string' ? body.contact_id : undefined
  if (!contactId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  if (MANAGE_ROLES.includes(effectiveRole)) {
    // Real link. Upsert so confirming an existing sales suggestion upgrades
    // the same row (PK job_id+contact_id) instead of failing.
    const { error } = await supabase
      .from('job_external_contacts')
      .upsert(
        { job_id: jobId, contact_id: contactId, status: 'pending', is_suggestion: false } as never,
        { onConflict: 'job_id,contact_id' },
      )
    if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (effectiveRole === 'sales') {
    // Suggestion only — never overwrite an existing (real or suggested) link.
    const { error } = await supabase
      .from('job_external_contacts')
      .upsert(
        {
          job_id:        jobId,
          contact_id:    contactId,
          status:        'pending',
          is_suggestion: true,
          suggested_by:  profile.id,
        } as never,
        { onConflict: 'job_id,contact_id', ignoreDuplicates: true },
      )
    if (error) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// DELETE — managers remove any link; sales retract only suggestion rows
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const { supabase, profile, effectiveRole } = await getProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const contactId: string | undefined =
    typeof body.contact_id === 'string' ? body.contact_id : undefined
  if (!contactId) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  if (MANAGE_ROLES.includes(effectiveRole)) {
    const { error } = await supabase
      .from('job_external_contacts')
      .delete()
      .eq('job_id', jobId)
      .eq('contact_id', contactId)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (effectiveRole === 'sales') {
    const { error } = await supabase
      .from('job_external_contacts')
      .delete()
      .eq('job_id', jobId)
      .eq('contact_id', contactId)
      .eq('is_suggestion', true)
    if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
