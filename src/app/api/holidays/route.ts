import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'

// Singapore public holidays — a label-only calendar HR maintains yearly
// (about 11 rows a year). No external service; the stack stays locked.
// Reading is open to every logged-in user (RLS) so the schedule can label the
// day; only hr/admin write, which is what this route gates.

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { holiday_date?: string; name?: string }
  const name = body.name?.trim() ?? ''
  if (!ISO_RE.test(body.holiday_date ?? '') || name.length === 0) {
    return NextResponse.json({ error: 'A date and a name are both required' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase
    .from('public_holidays')
    .insert({ holiday_date: body.holiday_date, name } as never)
    .select('id, holiday_date, name')
    .maybeSingle()
  if (error || !inserted) {
    // The (holiday_date, name) unique index makes a duplicate a real error
    // rather than a silent no-op, so say which case this is.
    const duplicate = typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
    return NextResponse.json(
      { error: duplicate ? 'That holiday is already on the list' : 'Save failed — you may not have permission' },
      { status: duplicate ? 409 : 403 },
    )
  }
  return NextResponse.json({ holiday: inserted })
}
