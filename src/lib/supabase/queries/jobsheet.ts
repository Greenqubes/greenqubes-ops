import type { createServiceClient } from '@/lib/supabase/service'
import { getCrewForJobs } from './crew-names'
import { TRIP_SELECT, mapTripRows, type TripRow } from './away'
import { SHEET_KEY_SETTING } from '@/lib/utils/jobsheet-key'
import type { LayoutInput, LayoutJob, LayoutLeave, LayoutHoliday } from '@/lib/utils/jobsheet-layout'

/**
 * The old jobsheet's data (spec 2026-11-11 Part 2; scheduler's layout
 * 2026-11-16), read with the SERVICE key: the private link has no user, so
 * its secret is the whole gate (checked by the route before anything here
 * runs). Reads only what the sheet shows — scheduled jobs, never drafts or
 * prices; leave TYPE but never HR's note.
 */

type Svc = ReturnType<typeof createServiceClient>

export async function getSheetKey(svc: Svc): Promise<string | null> {
  const { data } = await svc.from('app_settings' as never).select('value').eq('key', SHEET_KEY_SETTING).maybeSingle()
  const v = (data as { value: unknown } | null)?.value
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function setSheetKey(svc: Svc, key: string, by: string): Promise<void> {
  const { error } = await svc.from('app_settings' as never)
    .upsert({ key: SHEET_KEY_SETTING, value: key, updated_at: new Date().toISOString(), updated_by: by } as never)
  if (error) throw error
}

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Names by user id — a follow-up read, never embedded onto jobs (standing
 *  rule: embedding users on jobs broke twice). Soft-deleted users left out. */
async function namesById(svc: Svc, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const { data } = await svc.from('users').select('id, name').in('id', unique).is('deleted_at', null) as
    { data: Array<{ id: string; name: string }> | null; error: unknown }
  return new Map((data ?? []).map(u => [u.id, u.name]))
}

/**
 * One week of the sheet's data. Serves both answers: the jobs and leaves are
 * supersets of what the older layout (`buildWeekRows`) reads, and the rest is
 * for the scheduler's layout (`buildPaintedWeek`, Nic 2026-11-16).
 *
 * Leave TYPE is read (MC vs On leave, Nic's call knowing the sheet is shared
 * with the team) — `user_leave_details.note` never is.
 */
export async function getWeekSheet(svc: Svc, monday: string): Promise<Omit<LayoutInput, 'monday' | 'now'>> {
  const sunday = addDays(monday, 6)

  type JobRow = Omit<LayoutJob, 'salesName' | 'crew'> & { sales_poc_id: string | null }
  type LeaveRow = {
    user_id: string; date_start: string; date_end: string
    start_portion: LayoutLeave['start_portion']; end_portion: LayoutLeave['end_portion']
    user_leave_details: { leave_type: string } | Array<{ leave_type: string }> | null
  }
  const [jobRes, leaveRes, tripRes, holidayRes, driverRes] = await Promise.all([
    svc.from('jobs')
      .select('id, date, date_end, time_start, time_end, punctuality, project_title, client, description, location, client_poc_name, client_poc_phone, sales_poc_id, production_ready, do_issued')
      .eq('status', 'scheduled')
      .lte('date', sunday)
      .or(`date_end.gte.${monday},date.gte.${monday}`),
    svc.from('user_leaves')
      .select('user_id, date_start, date_end, start_portion, end_portion, user_leave_details(leave_type)')
      .lte('date_start', sunday)
      .gte('date_end', monday)
      .order('date_start'),
    svc.from('away_trips')
      .select(TRIP_SELECT)
      .lte('start_date', sunday)
      .gte('end_date', monday)
      .order('start_date')
      .order('start_time'),
    svc.from('public_holidays')
      .select('holiday_date, name')
      .gte('holiday_date', monday)
      .lte('holiday_date', sunday)
      .order('holiday_date'),
    svc.from('users')
      .select('name')
      .eq('is_driver', true)
      .is('deleted_at', null)
      .order('name'),
  ])
  for (const r of [jobRes, leaveRes, tripRes, holidayRes, driverRes]) if (r.error) throw r.error
  const rows = (jobRes.data ?? []) as unknown as JobRow[]
  const leaveRows = (leaveRes.data ?? []) as unknown as LeaveRow[]

  const [crew, names] = await Promise.all([
    getCrewForJobs(rows.map(r => r.id), null),
    namesById(svc, [...rows.map(r => r.sales_poc_id ?? ''), ...leaveRows.map(l => l.user_id)]),
  ])

  const jobs: LayoutJob[] = rows.map(({ sales_poc_id, ...j }) => ({
    ...j,
    salesName: sales_poc_id ? (names.get(sales_poc_id) ?? null) : null,
    crew: crew.get(j.id) ?? { drivers: [], support: [], externals: [] },
  }))
  const leaves: LayoutLeave[] = leaveRows
    .filter(l => names.has(l.user_id))
    .map(l => {
      const d = Array.isArray(l.user_leave_details) ? l.user_leave_details[0] : l.user_leave_details
      return {
        name: names.get(l.user_id)!, date_start: l.date_start, date_end: l.date_end,
        start_portion: l.start_portion, end_portion: l.end_portion, leave_type: d?.leave_type ?? null,
      }
    })
  return {
    jobs,
    leaves,
    trips: mapTripRows((tripRes.data ?? []) as unknown as TripRow[]),
    holidays: (holidayRes.data ?? []) as LayoutHoliday[],
    drivers: ((driverRes.data ?? []) as Array<{ name: string }>).map(u => u.name),
  }
}
