import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'
import { externalLinkMode } from '@/lib/utils/job-stage-rules'
import { loadJobStatus } from '@/lib/supabase/queries/job-status'

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

  type Row = { contact_id: string; status: string; is_suggestion: boolean; assigned_at: string; suggested_by: string | null }
  const { data, error } = await supabase
    .from('job_external_contacts')
    .select('contact_id, status, is_suggestion, assigned_at, suggested_by')
    .eq('job_id', jobId) as { data: Row[] | null; error: unknown }
  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  // by_scheduler: was this suggestion made by the scheduler side? On an
  // Ongoing job only those ride in a To arrange offer (review fix,
  // 2026-11-04), so the bucket has to tell them apart from sales' picks.
  const rows = data ?? []
  const suggesters = [...new Set(rows.map(r => r.suggested_by).filter((id): id is string => !!id))]
  const { data: users } = suggesters.length
    ? await supabase.from('users').select('id, role').in('id', suggesters) as { data: Array<{ id: string; role: string }> | null }
    : { data: [] as Array<{ id: string; role: string }> }
  const schedulerSide = new Set((users ?? []).filter(u => u.role === 'scheduler' || u.role === 'admin').map(u => u.id))
  return NextResponse.json(rows.map(r => ({ ...r, by_scheduler: !!r.suggested_by && schedulerSide.has(r.suggested_by) })))
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

  // Managers make a real link — but on an Ongoing job only a suggestion: crew
  // is confirmed once the job is on the schedule (spec 2026-10-09), and the
  // contractor's page shows confirmed links only. That suggestion is how a
  // scheduler puts a contractor into a To arrange offer; Client OK confirms
  // it (spec 2026-11-04). Sales always suggest.
  const mode = externalLinkMode(effectiveRole, await loadJobStatus(supabase, jobId) ?? '')

  if (mode === 'link') {
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

  if (mode === 'suggest') {
    // Suggestion only. Sales never overwrite an existing (real or suggested)
    // link. A manager on an Ongoing job DOES re-stamp an existing suggestion
    // as his own — that is how he takes a sales suggestion into his To
    // arrange offer (review fix, 2026-11-04).
    const isManager = MANAGE_ROLES.includes(effectiveRole)
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
        { onConflict: 'job_id,contact_id', ignoreDuplicates: !isManager },
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
