import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseArrangeAction } from '@/lib/utils/arrange-rules'
import { runArrangeAction } from '@/lib/arrange/actions'
import { loadArrangeRequest } from '@/lib/arrange/check-request'
import type { Role } from '@/lib/supabase/types'

/**
 * To arrange — the ONE write path for every button (spec 2026-11-04):
 *   sales side:      ready · client_ok · client_no · pull_back
 *   scheduler side:  offer · send_back · withdraw
 *
 * Checks, in order: signed in → the job is visible to the CALLER (read on
 * their own session, so 0062 pending privacy still decides) → it is Ongoing →
 * they are on the right side for this action (the REAL admin role counts,
 * since getEffectiveRole answers 'scheduler' for a plain admin) → the move is
 * valid from the state just read. Those checks live in loadArrangeRequest
 * (src/lib/arrange/check-request.ts), shared with the bulk pull back. The
 * writes then happen on the service key in src/lib/arrange/actions.ts, each
 * conditional on that same state.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase.from('users').select('id, name, role')
    .eq('auth_id', user.id).maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = await req.json().catch(() => null)
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  const action = parseArrangeAction(body.action)
  if (!action) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const check = await loadArrangeRequest(supabase, profile, jobId, action, body)
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

  const result = await runArrangeAction(check.ctx, action, body)
  return NextResponse.json(result.body, { status: result.status })
}
