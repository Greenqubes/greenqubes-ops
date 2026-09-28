import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRetention, setRetention, listBin } from '@/lib/supabase/queries/job-bin'
import { RETENTION_OPTIONS, countExpiringUnder, type RetentionKey } from '@/lib/utils/bin-rules'

// Admin → Settings. One setting today: how long the bin keeps deleted jobs
// (Nic, 2026-09-28 — "time set by admin for all, drop down month or years").

/** The admin's own user id, or null. Real role, like every admin route. */
async function guardAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string; role: string } | null; error: unknown }
  return profile?.role === 'admin' ? profile.id : null
}

export async function GET() {
  if (!(await guardAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const svc = createServiceClient()
  const [retention, rows] = await Promise.all([getRetention(svc), listBin(svc)])
  const now = new Date().toISOString()
  const deletedAts = rows.map(r => r.deleted_at)
  // How many binned jobs each choice would empty at the next nightly run —
  // so shortening the time can say so before it is saved.
  const expiringByOption = Object.fromEntries(
    RETENTION_OPTIONS.map(o => [o.key, countExpiringUnder(deletedAts, o.key, now)]),
  ) as Record<RetentionKey, number>
  return NextResponse.json({ retention, options: RETENTION_OPTIONS, expiringByOption })
}

export async function PUT(req: NextRequest) {
  const adminId = await guardAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json().catch(() => ({})) as { retention?: unknown }
  if (!RETENTION_OPTIONS.some(o => o.key === body.retention)) {
    return NextResponse.json({ error: 'Unknown retention' }, { status: 400 })
  }
  await setRetention(createServiceClient(), body.retention as RetentionKey, adminId)
  return NextResponse.json({ ok: true, retention: body.retention })
}
