import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/gallery/hide — WhatsApp's "Delete for me" (the job Gallery, Nic
 * 2026-11-11). Hides files or voice notes from the CALLER's own gallery and
 * chat; nobody else is affected. Written on the caller's own session, so RLS
 * (migration 0070) allows only their own rows — the user id comes from their
 * profile, never from the request. Hiding something twice is not an error.
 *
 * Body: { items: Array<{ fileId: string } | { messageId: string }> }, ≤ 200.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('id')
    .eq('auth_id', user.id).maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { items?: unknown } | null
  const items = Array.isArray(body?.items) ? body!.items : null
  if (!items || items.length === 0 || items.length > 200) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  const fileIds: string[] = [], messageIds: string[] = []
  for (const it of items) {
    const o = it && typeof it === 'object' ? it as Record<string, unknown> : {}
    if (typeof o.fileId === 'string' && o.fileId) fileIds.push(o.fileId)
    else if (typeof o.messageId === 'string' && o.messageId) messageIds.push(o.messageId)
    else return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const rows = [
    ...[...new Set(fileIds)].map(file_id => ({ user_id: profile.id, file_id })),
    ...[...new Set(messageIds)].map(message_id => ({ user_id: profile.id, message_id })),
  ]
  // Two inserts, one per unique constraint, so ignoreDuplicates knows which to use.
  for (const [conflict, batch] of [
    ['user_id,file_id', rows.filter(r => 'file_id' in r)],
    ['user_id,message_id', rows.filter(r => 'message_id' in r)],
  ] as const) {
    if (batch.length === 0) continue
    const { error } = await supabase.from('job_item_hides' as never)
      .upsert(batch as never, { onConflict: conflict, ignoreDuplicates: true })
    if (error) {
      console.error('[gallery hide] insert failed', error)
      return NextResponse.json({ error: 'Could not hide' }, { status: 500 })
    }
  }
  return NextResponse.json({ ok: true, hidden: rows.length })
}
