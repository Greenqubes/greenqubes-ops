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

  const body = await req.json() as { name?: string; date_start?: string; date_end?: string }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (name.length === 0) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
    updates.name = name
  }
  if (body.date_start !== undefined) {
    if (!ISO_RE.test(body.date_start)) return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
    updates.date_start = body.date_start
  }
  if (body.date_end !== undefined) {
    if (!ISO_RE.test(body.date_end)) return NextResponse.json({ error: 'Invalid end date' }, { status: 400 })
    updates.date_end = body.date_end
  }

  // Range check against whichever half the caller did NOT send, so a PATCH of
  // one date cannot quietly invert the range (the DB would refuse it anyway).
  const { data: beforeRaw } = await supabase
    .from('company_events')
    .select('id, date_start, date_end')
    .eq('id', id)
    .maybeSingle()
  if (!beforeRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const before = beforeRaw as unknown as { date_start: string; date_end: string }
  const nextStart = (updates.date_start as string) ?? before.date_start
  const nextEnd   = (updates.date_end   as string) ?? before.date_end
  if (nextEnd < nextStart) {
    return NextResponse.json({ error: 'End date is before the start date' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('company_events')
    .update(updates as never)
    .eq('id', id)
    .select('id, name, date_start, date_end')
    .maybeSingle()
  if (error || !updated) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ event: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: deleted, error } = await supabase
    .from('company_events')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()
  if (error || !deleted) {
    return NextResponse.json({ error: 'Delete failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
