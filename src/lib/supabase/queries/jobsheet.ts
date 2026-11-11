import type { createServiceClient } from '@/lib/supabase/service'
import { getCrewForJobs } from './crew-names'
import { SHEET_KEY_SETTING } from '@/lib/utils/jobsheet-key'
import type { SheetJob, SheetLeave } from '@/lib/utils/jobsheet-rows'

/**
 * The old jobsheet's data (spec 2026-11-11 Part 2), read with the SERVICE key:
 * the private link has no user, so its secret is the whole gate (checked by
 * the route before anything here runs). Reads only what the sheet shows —
 * scheduled jobs, never drafts, prices or leave reasons.
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

export async function getWeekSheet(svc: Svc, monday: string): Promise<{ jobs: SheetJob[]; leaves: SheetLeave[] }> {
  const sunday = addDays(monday, 6)

  type JobRow = Omit<SheetJob, 'salesName' | 'crew'> & { sales_poc_id: string | null }
  const { data: jobRows, error } = await svc.from('jobs')
    .select('id, date, date_end, time_start, time_end, punctuality, project_title, client, description, location, client_poc_name, client_poc_phone, sales_poc_id')
    .eq('status', 'scheduled')
    .lte('date', sunday)
    .or(`date_end.gte.${monday},date.gte.${monday}`) as { data: JobRow[] | null; error: unknown }
  if (error) throw error
  const rows = jobRows ?? []

  type LeaveRow = { user_id: string; date_start: string; date_end: string }
  const { data: leaveRows, error: leaveErr } = await svc.from('user_leaves')
    .select('user_id, date_start, date_end')
    .lte('date_start', sunday)
    .gte('date_end', monday)
    .order('date_start') as { data: LeaveRow[] | null; error: unknown }
  if (leaveErr) throw leaveErr

  const [crew, names] = await Promise.all([
    getCrewForJobs(rows.map(r => r.id), null),
    namesById(svc, [...rows.map(r => r.sales_poc_id ?? ''), ...(leaveRows ?? []).map(l => l.user_id)]),
  ])

  const jobs: SheetJob[] = rows.map(({ sales_poc_id, ...j }) => ({
    ...j,
    salesName: sales_poc_id ? (names.get(sales_poc_id) ?? null) : null,
    crew: crew.get(j.id) ?? { drivers: [], support: [], externals: [] },
  }))
  const leaves: SheetLeave[] = (leaveRows ?? [])
    .filter(l => names.has(l.user_id))
    .map(l => ({ name: names.get(l.user_id)!, date_start: l.date_start, date_end: l.date_end }))
  return { jobs, leaves }
}
