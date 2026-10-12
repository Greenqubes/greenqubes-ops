import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'
import { TRIP_SELECT, mapTripRows, type TripRow } from '@/lib/supabase/queries/away'
import { validateTrip, cleanText as clean, type TripBody } from '@/lib/utils/away-validate'
import { notifyAwayEdited } from '@/lib/utils/away-notify'

// Edit / delete one trip. The form always sends the whole trip, so PATCH
// validates exactly like POST. People are replaced as a set: rows not in the
// new list are deleted, new ones inserted.

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as TripBody
  const invalid = validateTrip(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const { data: beforeRaw } = await supabase.from('away_trips').select(TRIP_SELECT).eq('id', id).maybeSingle()
  if (!beforeRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const before = mapTripRows([beforeRaw as unknown as TripRow])[0]

  const { data: updated, error } = await supabase
    .from('away_trips')
    .update({
      title: body.title!.trim(), business: clean(body.business), location: clean(body.location),
      start_date: body.start_date, start_time: body.start_time,
      end_date: body.end_date, end_time: body.end_time,
      note: clean(body.note), updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)
    .select('id')
    .maybeSingle()
  // .select() is the guard: an RLS-filtered UPDATE is a 204 with no error.
  if (error || !updated) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }

  const wanted   = new Set(body.user_ids!)
  const current  = new Set(before.people.map(p => p.id))
  const toRemove = [...current].filter(u => !wanted.has(u))
  const toAdd    = [...wanted].filter(u => !current.has(u))
  if (toAdd.length > 0) {
    const { error: addErr } = await supabase.from('away_trip_people')
      .insert(toAdd.map(user_id => ({ trip_id: id, user_id })) as never)
    if (addErr) return NextResponse.json({ error: 'Save failed — could not add people' }, { status: 500 })
  }
  if (toRemove.length > 0) {
    const { error: rmErr } = await supabase.from('away_trip_people')
      .delete().eq('trip_id', id).in('user_id', toRemove)
    if (rmErr) return NextResponse.json({ error: 'Save failed — could not remove people' }, { status: 500 })
  }

  const { data: afterRaw } = await supabase.from('away_trips').select(TRIP_SELECT).eq('id', id).single()
  const after = mapTripRows([afterRaw as unknown as TripRow])[0]
  await notifyAwayEdited(before, after)   // awaited — see the POST route
  return NextResponse.json({ trip: after })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { ok, supabase } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // People cascade. Deleting is quiet — no notification (spec §7.3).
  const { data: deleted, error } = await supabase
    .from('away_trips').delete().eq('id', id).select('id').maybeSingle()
  if (error || !deleted) {
    return NextResponse.json({ error: 'Delete failed — you may not have permission' }, { status: 403 })
  }
  return NextResponse.json({ ok: true })
}
