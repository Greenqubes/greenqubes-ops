import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'

// Company events — multi-day things everyone should see on the schedule
// (retreat, shutdown, town hall). Read by every role via RLS; written by
// whoever manages leave, which this route gates.
//
// No notification: an event is a label, not a change to anyone's work.
// Leave is the thing that alerts people.

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const { ok, supabase, userId } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { name?: string; date_start?: string; date_end?: string }
  const name = body.name?.trim() ?? ''
  if (name.length === 0 || !ISO_RE.test(body.date_start ?? '') || !ISO_RE.test(body.date_end ?? '')) {
    return NextResponse.json({ error: 'A name and both dates are required' }, { status: 400 })
  }
  if (body.date_end! < body.date_start!) {
    return NextResponse.json({ error: 'End date is before the start date' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from('company_events')
    .insert({
      name,
      date_start: body.date_start,
      date_end:   body.date_end,
      created_by: userId,
    } as never)
    .select('id, name, date_start, date_end')
    .maybeSingle()
  // A write RLS filters out returns no rows and no error — ask for the row
  // back so a refusal is a real failure, not a fake success.
  if (error || !inserted) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ event: inserted })
}
