import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerCanSeeJob } from '@/lib/supabase/queries/job-visibility'

/**
 * POST /api/gallery/hide — WhatsApp's "Delete for me" (the job Gallery, Nic
 * 2026-11-11). Hides files or voice notes from the CALLER's own gallery and
 * chat; nobody else is affected. Written on the caller's own session, so RLS
 * (migration 0070) allows only their own rows — the user id comes from their
 * profile, never from the request. Hiding something twice is not an error.
 *
 * Body: { jobId: string, items: Array<{ fileId: string } | { messageId: string }> }, ≤ 200.
 * Hides are per job (final review I7): only items that really belong to that
 * job — read on the caller's own session — are hidden.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('users').select('id')
    .eq('auth_id', user.id).maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { jobId?: unknown; items?: unknown } | null
  const jobId = typeof body?.jobId === 'string' ? body.jobId : null
  const items = Array.isArray(body?.items) ? body!.items : null
  if (!jobId || !items || items.length === 0 || items.length > 200) return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  if (!(await callerCanSeeJob(supabase, jobId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const fileIds: string[] = [], messageIds: string[] = []
  for (const it of items) {
    const o = it && typeof it === 'object' ? it as Record<string, unknown> : {}
    if (typeof o.fileId === 'string' && o.fileId) fileIds.push(o.fileId)
    else if (typeof o.messageId === 'string' && o.messageId) messageIds.push(o.messageId)
    else return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // Keep only items of THIS job that the caller can read.
  const [{ data: okFiles }, { data: okMsgs }] = await Promise.all([
    fileIds.length
      ? supabase.from('files').select('id').eq('job_id', jobId).in('id', [...new Set(fileIds)]) as unknown as Promise<{ data: Array<{ id: string }> | null }>
      : Promise.resolve({ data: [] as Array<{ id: string }> }),
    messageIds.length
      ? supabase.from('messages').select('id').eq('job_id', jobId).in('id', [...new Set(messageIds)]) as unknown as Promise<{ data: Array<{ id: string }> | null }>
      : Promise.resolve({ data: [] as Array<{ id: string }> }),
  ])
  const rows = [
    ...(okFiles ?? []).map(r => ({ user_id: profile.id, job_id: jobId, file_id: r.id })),
    ...(okMsgs ?? []).map(r => ({ user_id: profile.id, job_id: jobId, message_id: r.id })),
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
