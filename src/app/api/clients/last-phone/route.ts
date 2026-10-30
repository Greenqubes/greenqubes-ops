import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lastNumberFor, likePattern, type PastClientJob } from '@/lib/utils/client-phone'

// The last number typed for a client at a company — the job form's Client
// Contact No. auto-fill (Nic, 2026-10-30). Runs on the caller's own session,
// so RLS decides which past jobs count: a private draft someone else shares
// can never leak its client's number. Answers null when there is none.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q       = req.nextUrl.searchParams
  const company = q.get('company')?.trim() ?? ''
  const name    = q.get('name')?.trim() ?? ''
  if (!company || !name) return NextResponse.json(null)

  // The ILIKEs only narrow the read; lastNumberFor makes the exact match.
  const { data, error } = await supabase
    .from('jobs')
    .select('id, client, client_poc_name, client_poc_phone, date, created_at')
    .ilike('client', likePattern(company))
    .ilike('client_poc_name', likePattern(name))
    .not('client_poc_phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    lastNumberFor((data ?? []) as PastClientJob[], company, name, q.get('exclude') ?? undefined),
  )
}
