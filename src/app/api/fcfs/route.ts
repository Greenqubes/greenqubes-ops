import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getFCFSDay } from '@/lib/supabase/queries/fcfs'
import type { Role } from '@/lib/supabase/types'

// The board is a planning tool for every office role. Installers are the one
// role without it (Nic, 2026-07-22) — they only need their own jobs.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveRole = await getEffectiveRole(profile.role)
  if (effectiveRole === 'installer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const date = new URL(req.url).searchParams.get('date') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const jobs = await getFCFSDay(date)
  return NextResponse.json(jobs)
}
