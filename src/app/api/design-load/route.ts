import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getDesignLoad, getMyDesignJobs } from '@/lib/supabase/queries/design-load'
import type { Role } from '@/lib/supabase/types'

// Client-callable refetch for DesignLoadShell's live updates — mirrors
// /api/fcfs/route.ts. Installers have no stake in design load (they only
// need their own jobs, same split as FCFS) and production has none either
// (design load sits between sales handoff and production readiness).
export async function GET(req: NextRequest) {
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
  if (effectiveRole === 'installer' || effectiveRole === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // `mine=1` adds the My Jobs payload for the CALLER's own id — the id is
  // always derived from the authenticated session above, never taken from
  // the query string, so a client can't request another user's jobs.
  const wantMine = new URL(req.url).searchParams.get('mine') === '1'

  const [data, myJobs] = await Promise.all([
    getDesignLoad(),
    wantMine ? getMyDesignJobs(profile.id) : Promise.resolve(undefined),
  ])

  return NextResponse.json(wantMine ? { ...data, myJobs } : data)
}
