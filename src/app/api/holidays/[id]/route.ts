import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { holiday_date?: string; name?: string }
  const updates: Record<string, unknown> = {}
  if (body.holiday_date !== undefined) {
    if (!ISO_RE.test(body.holiday_date)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }
    updates.holiday_date = body.holiday_date
  }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (name.length === 0) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
    updates.name = name
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('public_holidays')
    .update(updates as never)
    .eq('id', id)
    .select('id, holiday_date, name')
    .maybeSingle()
  if (error || !updated) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ holiday: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: deleted, error } = await supabase
    .from('public_holidays')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error || !deleted) {
    return NextResponse.json({ error: 'Delete failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
