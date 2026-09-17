import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/telegram/summary-status — has the signed-in user pressed START on
// the summary bot? Drives the tick in the account menu.
//
// Read through the SERVICE client because the "started" record lives in
// `events`, which is scheduler-visible only — an installer must still be able
// to see their own state. Scoped to the caller's own id and returns nothing
// but a boolean, so it leaks no one else's.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle() as
    { data: { id: string } | null }
  if (!profile) return NextResponse.json({ connected: false })

  const db = createServiceClient()
  const { count } = await db
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'summary_bot_started')
    .eq('actor_id', profile.id)

  return NextResponse.json({ connected: (count ?? 0) > 0 })
}
