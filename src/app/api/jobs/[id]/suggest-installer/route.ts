import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

// Sales toggles a tentative installer suggestion (yellow) on a job. This does
// NOT formally assign — a coordinator/scheduler does that via assign-installers,
// which clears suggestions and turns the pick green.
export async function POST(
  req: NextRequest,
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

  const body = await req.json().catch(() => ({}))
  const userId: string | undefined = typeof body.user_id === 'string' ? body.user_id : undefined
  const action: string | undefined = typeof body.action === 'string' ? body.action : undefined
  // Phase 4: sales can also suggest SUB-installers — same amber rules, kept in
  // a separate bucket via is_sub_installer (confirmed by sub-installers route).
  const isSub: boolean = body.is_sub === true
  if (!userId || (action !== 'add' && action !== 'remove')) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  if (action === 'add') {
    // Never overwrite an existing row — a formal assignment must not become a
    // suggestion, and the PK is (job_id, user_id) so one row per person.
    const { data: existing } = await supabase
      .from('job_assignees')
      .select('is_suggestion')
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .maybeSingle() as { data: { is_suggestion: boolean } | null }

    if (!existing) {
      await supabase.from('job_assignees').insert({
        job_id:           jobId,
        user_id:          userId,
        is_suggestion:    true,
        suggested_by:     profile.id,
        is_sub_installer: isSub,
      } as never).throwOnError()
    }
  } else {
    // Only remove suggestion rows in the matching bucket — formal assignments
    // and the other bucket's suggestions stay untouched.
    await supabase.from('job_assignees')
      .delete()
      .eq('job_id', jobId)
      .eq('user_id', userId)
      .eq('is_suggestion', true)
      .eq('is_sub_installer', isSub)
      .throwOnError()
  }

  return NextResponse.json({ ok: true })
}
