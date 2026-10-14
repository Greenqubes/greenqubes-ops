import { createClient } from '@/lib/supabase/server'
import type { AwayTrip } from '@/lib/utils/away-overlap'
import { orEmpty } from '@/lib/utils/or-empty'

// Away trips are readable by every signed-in role (RLS) — who is away on a
// course and where is ordinary team information. Names come through the
// away_trip_people -> users embed: that table has ONE FK to users, so the
// embed is unambiguous (the PGRST201 rule is about tables with several).

export const TRIP_SELECT =
  'id, title, business, location, start_date, start_time, end_date, end_time, note, ' +
  'away_trip_people(user_id, users(name))'

export type TripRow = {
  id: string; title: string; business: string | null; location: string | null
  start_date: string; start_time: string; end_date: string; end_time: string; note: string | null
  away_trip_people: Array<{ user_id: string; users: { name: string } | null }>
}

export function mapTripRows(rows: TripRow[]): AwayTrip[] {
  return rows.map(({ away_trip_people, ...t }) => ({
    ...t,
    start_time: t.start_time.slice(0, 5),
    end_time:   t.end_time.slice(0, 5),
    people: (away_trip_people ?? [])
      .map(p => ({ id: p.user_id, name: p.users?.name ?? '' }))
      .filter(p => p.name)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

export async function getAwayTrips(): Promise<AwayTrip[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('away_trips')
    .select(TRIP_SELECT)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) throw error
  return mapTripRows((data ?? []) as unknown as TripRow[])
}

// Fail-soft versions for every surface where Away is only a notice or a
// warning (schedule, job form, clash checks, FCFS, assistant): a failed read
// shows no trips rather than breaking the page (review I3). The Leave page and
// HR's own list route keep the strict versions, so HR sees a real error.
export const awayTripsOrEmpty = () => orEmpty(getAwayTrips, '[away] trips')
export const awayTripsInRangeOrEmpty = (from: string, to: string) =>
  orEmpty(() => getAwayTripsInRange(from, to), '[away] trips in range')

/** Trips whose dates touch [from, to] (inclusive both ends). */
export async function getAwayTripsInRange(from: string, to: string): Promise<AwayTrip[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('away_trips')
    .select(TRIP_SELECT)
    .lte('start_date', to)
    .gte('end_date', from)
  if (error) throw error
  return mapTripRows((data ?? []) as unknown as TripRow[])
}
