import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'
import { notifyLeave } from '@/lib/utils/leave-notify'
import type { LeaveRecord } from '@/lib/utils/leave-overlap'

// Edit / delete one leave entry. Same gate and same user-scoped client as the
// list route — RLS refuses the write for anyone but hr/admin.

const PORTIONS = ['full', 'am', 'pm']
const TYPES    = ['annual', 'medical', 'emergency', 'other']
const ISO_RE   = /^\d{4}-\d{2}-\d{2}$/

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    date_start?: string; date_end?: string
    start_portion?: string; end_portion?: string
    leave_type?: string; note?: string | null
  }

  // Every field is optional on a PATCH; validate whatever turned up.
  if (body.date_start !== undefined && !ISO_RE.test(body.date_start)) {
    return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
  }
  if (body.date_end !== undefined && !ISO_RE.test(body.date_end)) {
    return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
  }
  if (body.start_portion !== undefined && !PORTIONS.includes(body.start_portion)) {
    return NextResponse.json({ error: 'Invalid start portion' }, { status: 400 })
  }
  if (body.end_portion !== undefined && !PORTIONS.includes(body.end_portion)) {
    return NextResponse.json({ error: 'Invalid end portion' }, { status: 400 })
  }
  if (body.leave_type !== undefined && !TYPES.includes(body.leave_type)) {
    return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 })
  }

  // Read the row first: the notification only re-fires when the DATES moved,
  // and the end >= start check needs whichever half the caller did not send.
  const { data: beforeRaw } = await supabase
    .from('user_leaves')
    .select('id, user_id, date_start, date_end, start_portion, end_portion')
    .eq('id', id)
    .maybeSingle()
  if (!beforeRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const before = beforeRaw as unknown as LeaveRecord

  const nextStart = body.date_start ?? before.date_start
  const nextEnd   = body.date_end   ?? before.date_end
  if (nextEnd < nextStart) {
    return NextResponse.json({ error: 'End date is before the start date' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.date_start    !== undefined) updates.date_start    = body.date_start
  if (body.date_end      !== undefined) updates.date_end      = body.date_end
  if (body.start_portion !== undefined) updates.start_portion = body.start_portion
  if (body.end_portion   !== undefined) updates.end_portion   = body.end_portion

  const { data: updated, error } = await supabase
    .from('user_leaves')
    .update(updates as never)
    .eq('id', id)
    .select('id, user_id, date_start, date_end, start_portion, end_portion')
    .maybeSingle()
  // .select() is the guard: an UPDATE filtered out by RLS returns 204 with no
  // rows and NO error, so a bare throwOnError would report success over a
  // write that never happened (the 2026-09-07 lesson).
  if (error || !updated) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }
  const after = updated as unknown as LeaveRecord

  if (body.leave_type !== undefined || body.note !== undefined) {
    const { error: detailsError } = await supabase
      .from('user_leave_details')
      .upsert({
        leave_id:   id,
        leave_type: body.leave_type ?? 'other',
        note:       body.note ?? null,
      } as never, { onConflict: 'leave_id' })
    if (detailsError) console.error('[leave/patch] details upsert failed', detailsError)
  }

  // Only a moved range can newly land on a job. Type/note edits are silent —
  // and the type must never reach a notification anyway (spec §6).
  const datesChanged =
    after.date_start    !== before.date_start ||
    after.date_end      !== before.date_end   ||
    after.start_portion !== before.start_portion ||
    after.end_portion   !== before.end_portion
  if (datesChanged) await notifyLeave(after)

  return NextResponse.json({ leave: after })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Details cascade with the parent row. Deleting is quiet — no notification,
  // matching the quiet-undo precedent set by Revert to Scheduled (Nic).
  const { data: deleted, error } = await supabase
    .from('user_leaves')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error || !deleted) {
    return NextResponse.json({ error: 'Delete failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
