import { NextRequest, NextResponse } from 'next/server'
import { guardHr } from '@/lib/utils/leave-guard'
import { getAwayTrips, TRIP_SELECT, mapTripRows, type TripRow } from '@/lib/supabase/queries/away'
import { validateTrip, cleanText as clean, type TripBody } from '@/lib/utils/away-validate'

// Away trips — list (for the Leave page) and create. Writes run on the
// USER-SCOPED client so RLS is the real gate; guardHr() turns a refusal into a
// clean 403 instead of an empty result.

export async function GET() {
  const { ok } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ trips: await getAwayTrips() })
}

export async function POST(req: NextRequest) {
  const { ok, supabase, userId } = await guardHr()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as TripBody
  const invalid = validateTrip(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const { data: inserted, error } = await supabase
    .from('away_trips')
    .insert({
      title:      body.title!.trim(),
      business:   clean(body.business),
      location:   clean(body.location),
      start_date: body.start_date,
      start_time: body.start_time,
      end_date:   body.end_date,
      end_time:   body.end_time,
      note:       clean(body.note),
      created_by: userId,
    } as never)
    .select('id')
    .single()
  // A row must come back — an RLS-refused INSERT returns none and no error.
  if (error || !inserted) {
    return NextResponse.json({ error: 'Save failed — you may not have permission' }, { status: 403 })
  }
  const tripId = (inserted as { id: string }).id

  const people = [...new Set(body.user_ids!)].map(user_id => ({ trip_id: tripId, user_id }))
  const { data: peopleRows, error: peopleError } = await supabase
    .from('away_trip_people').insert(people as never).select('user_id')
  if (peopleError || !peopleRows || peopleRows.length !== people.length) {
    // A trip with nobody on it is meaningless — undo rather than leave it.
    await supabase.from('away_trips').delete().eq('id', tripId)
    return NextResponse.json({ error: 'Save failed — could not add the people' }, { status: 500 })
  }

  const { data: full } = await supabase.from('away_trips').select(TRIP_SELECT).eq('id', tripId).single()
  const trip = mapTripRows([full as unknown as TripRow])[0]
  return NextResponse.json({ trip })
}
