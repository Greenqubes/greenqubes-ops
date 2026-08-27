import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type InAppNotif = {
  id:         string
  type:       string
  job_id:     string | null
  title:      string
  body:       string | null
  read:       boolean
  created_at: string
}

// GET — fetch current user's notifications, newest first
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, job_id, title, body, read, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PATCH — mark notifications as read
// body: { ids?: string[] }  — if ids omitted, marks ALL as read
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json() as { ids?: string[] }

  let query = supabase.from('notifications').update({ read: true } as never)
  if (ids && ids.length > 0) {
    query = query.in('id', ids) as typeof query
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — delete notifications
// body: { ids?: string[] } — if ids omitted (or empty), deletes ALL of the
// caller's own notifications ("Clear All" on the Updates section, R2-T2 edit
// 4), mirroring PATCH's "ids omitted = apply to all" convention. RLS (0022
// "users can delete own notifications") scopes either case to the caller.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids } = await req.json().catch(() => ({})) as { ids?: string[] }

  let query = supabase.from('notifications').delete()
  if (ids && ids.length > 0) {
    query = query.in('id', ids) as typeof query
  }

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
