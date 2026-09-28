import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

const HANDOVER_ROLES: Role[] = ['sales', 'coordinator', 'scheduler', 'admin']

// Hand a DRAFT to a different sales person-in-charge (final review,
// 2026-09-28). Drafts are private to their sharers (migration 0062), and a
// sharer who is only the PIC cannot write a row that stops being theirs:
// Postgres checks the new row against the SELECT policy and refuses the whole
// UPDATE. So the caller's right is checked here on the SESSION client — they
// must be able to see the draft — and the one column is written on the
// service client. Everything else on the form still saves the ordinary way.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string; role: Role } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!HANDOVER_ROLES.includes(await getEffectiveRole(profile.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Visible on the caller's own session = they share this draft (or are admin).
  const { data: job } = await supabase
    .from('jobs').select('id, status').eq('id', jobId)
    .maybeSingle() as { data: { id: string; status: string } | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.status !== 'pending' && job.status !== 'awaiting_approval') {
    return NextResponse.json({ error: 'Only drafts are handed over this way' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({})) as { salesPocId?: string | null }
  const to = body.salesPocId || null
  const svc = createServiceClient()
  if (to) {
    const { data: target } = await svc.from('users').select('id, deleted_at').eq('id', to)
      .maybeSingle() as { data: { id: string; deleted_at: string | null } | null; error: unknown }
    if (!target || target.deleted_at) return NextResponse.json({ error: 'That person is not available' }, { status: 400 })
  }

  const { data: saved, error } = await svc.from('jobs')
    .update({ sales_poc_id: to } as never).eq('id', jobId).select('id')
  if (error || !saved?.length) return NextResponse.json({ error: 'Handover failed' }, { status: 500 })

  // Whether the caller can still see the draft now it has changed hands — if
  // not, the form sends them back to their list rather than leaving them on a
  // page whose next save would be refused.
  const { data: still } = await supabase.from('jobs').select('id').eq('id', jobId).maybeSingle()
  return NextResponse.json({ ok: true, stillVisible: Boolean(still) })
}
