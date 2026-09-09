import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'
import { getLeave, getHolidays, getCompanyEvents, getActiveUsers } from '@/lib/supabase/queries/leave'
import { notifyLeave } from '@/lib/utils/leave-notify'
import type { LeaveRecord } from '@/lib/utils/leave-overlap'

// Leave records — list everything the Leave tab needs, and create an entry.
// Writes run on the USER-SCOPED client so RLS is the real gate; guardHr() only
// turns a refusal into a clean 403 instead of a confusing empty result.

const PORTIONS = ['full', 'am', 'pm']
const TYPES    = ['annual', 'medical', 'emergency', 'other']
const ISO_RE   = /^\d{4}-\d{2}-\d{2}$/

export async function GET() {
  const { ok } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const [leave, holidays, events, users] = await Promise.all([
    getLeave(), getHolidays(), getCompanyEvents(), getActiveUsers(),
  ])
  return NextResponse.json({ leave, holidays, events, users })
}

export async function POST(req: NextRequest) {
  const { ok, supabase, userId } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    user_id?: string; date_start?: string; date_end?: string
    start_portion?: string; end_portion?: string
    leave_type?: string; note?: string | null
  }
  if (!body.user_id || !ISO_RE.test(body.date_start ?? '') || !ISO_RE.test(body.date_end ?? '') ||
      body.date_end! < body.date_start! ||
      !PORTIONS.includes(body.start_portion ?? 'full') || !PORTIONS.includes(body.end_portion ?? 'full') ||
      !TYPES.includes(body.leave_type ?? 'other')) {
    return NextResponse.json({ error: 'Invalid leave entry' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from('user_leaves')
    .insert({
      user_id:       body.user_id,
      date_start:    body.date_start,
      date_end:      body.date_end,
      start_portion: body.start_portion ?? 'full',
      end_portion:   body.end_portion ?? 'full',
      created_by:    userId,
    } as never)
    .select('id, user_id, date_start, date_end, start_portion, end_portion')
    .single()
  // A row must come back. An INSERT that RLS refuses returns no row and no
  // error — the "saved successfully over nothing" trap from 2026-09-07.
  if (error || !inserted) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }

  const leaveRow = inserted as unknown as LeaveRecord

  // The reason lives in its own table so RLS can hide it from everyone but
  // hr/admin. A leave row is valid without one, so a failure here does not
  // fail the save.
  const { error: detailsError } = await supabase.from('user_leave_details').insert({
    leave_id:   leaveRow.id,
    leave_type: body.leave_type ?? 'other',
    note:       body.note ?? null,
  } as never)
  if (detailsError) console.error('[leave/post] details insert failed', detailsError)

  await notifyLeave(leaveRow)

  return NextResponse.json({ leave: leaveRow })
}
