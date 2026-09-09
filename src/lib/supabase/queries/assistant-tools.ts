import { createClient } from '@/lib/supabase/server'
import { timesOverlap } from '@/lib/utils/clash-detection'
import { leaveBlocksJob, type LeaveRecord } from '@/lib/utils/leave-overlap'

// Read-only lookups behind the assistant's tools (Phase 2). Every function
// runs on the user-scoped client so RLS filters what the asker may see —
// an installer's assistant sees only their formally assigned jobs.

export type ToolJob = {
  id:            string
  status:        string
  date:          string
  date_end:      string | null
  time_start:    string | null
  time_end:      string | null
  project_title: string | null
  client:        string
  location:      string
  punctuality:   string
  installers:    string[]
  sales_poc:     string | null
}

type JobRow = {
  id: string; status: string; date: string; date_end: string | null
  time_start: string | null; time_end: string | null
  project_title: string | null; client: string; location: string
  punctuality: string; sales_poc_id: string | null
  job_assignees: Array<{ is_suggestion: boolean; is_sub_installer: boolean; users: { name: string } | null }>
}

const JOB_SELECT = `
  id, status, date, date_end, time_start, time_end,
  project_title, client, location, punctuality, sales_poc_id,
  job_assignees ( is_suggestion, is_sub_installer, users ( name ) )
`

async function toToolJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: JobRow[],
): Promise<ToolJob[]> {
  // Sales POC names via follow-up query — never embed users on jobs (standing rule).
  const pocIds = [...new Set(rows.map(r => r.sales_poc_id).filter(Boolean))] as string[]
  const names  = new Map<string, string>()
  if (pocIds.length > 0) {
    const { data } = await supabase.from('users').select('id, name').in('id', pocIds)
    for (const u of (data ?? []) as Array<{ id: string; name: string }>) names.set(u.id, u.name)
  }
  return rows.map(r => ({
    id: r.id, status: r.status, date: r.date, date_end: r.date_end,
    time_start: r.time_start, time_end: r.time_end,
    project_title: r.project_title, client: r.client, location: r.location,
    punctuality: r.punctuality,
    // Formal, non-sub assignees only — suggestions are invisible on the
    // schedule (same semantics as the Schedule tab's list).
    installers: r.job_assignees.filter(a => !a.is_suggestion && !a.is_sub_installer).map(a => a.users?.name ?? '').filter(Boolean),
    sales_poc:  r.sales_poc_id ? (names.get(r.sales_poc_id) ?? null) : null,
  }))
}

export async function getScheduleRange(
  startDate: string, endDate: string, status?: 'scheduled' | 'pending' | 'completed',
): Promise<{ jobs: ToolJob[]; truncated: boolean }> {
  const supabase = await createClient()
  let q = supabase.from('jobs').select(JOB_SELECT)
    .gte('date', startDate).lte('date', endDate)
    .order('date', { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })
    .limit(101)
  // 'pending' includes the legacy awaiting_approval status (same mapping as the app's Pending tab)
  if (status === 'pending') q = q.in('status', ['pending', 'awaiting_approval'])
  else if (status)          q = q.eq('status', status)
  const { data, error } = await q
  if (error) throw error
  const rows = (data ?? []) as unknown as JobRow[]
  return { jobs: await toToolJobs(supabase, rows.slice(0, 100)), truncated: rows.length > 100 }
}

export async function findJobs(query: string): Promise<ToolJob[]> {
  const supabase = await createClient()
  // Strip characters that break PostgREST .or() filter syntax
  const safe = query.replace(/[,%().]/g, ' ').trim()
  if (!safe) return []
  const pat = `%${safe}%`
  const { data, error } = await supabase.from('jobs').select(JOB_SELECT)
    .or(`project_title.ilike.${pat},client.ilike.${pat},location.ilike.${pat}`)
    .order('date', { ascending: false })
    .limit(10)
  if (error) throw error
  return toToolJobs(supabase, (data ?? []) as unknown as JobRow[])
}

export type ToolJobDetail = ToolJob & {
  description:             string | null
  notes:                   string | null
  production_instructions: string | null
  production_ready:        boolean
  do_issued:               boolean
  client_poc_name:         string | null
  client_poc_phone:        string | null
  team:  Array<{ name: string; suggestion: boolean; supporting: boolean }>
  tasks: Array<{ text: string; done: boolean }>
}

export async function getJobSnapshot(jobId: string): Promise<ToolJobDetail | null> {
  const supabase = await createClient()
  // No job_financials — money figures never reach the assistant (spec).
  const { data, error } = await supabase.from('jobs').select(`
      id, status, date, date_end, time_start, time_end,
      project_title, client, location, punctuality, sales_poc_id,
      description, notes, production_instructions, production_ready, do_issued,
      client_poc_name, client_poc_phone,
      job_assignees ( is_suggestion, is_sub_installer, users ( name ) ),
      job_tasks ( text, is_completed, sort_order )
    `)
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  type DetailRow = JobRow & {
    description: string | null; notes: string | null
    production_instructions: string | null; production_ready: boolean; do_issued: boolean
    client_poc_name: string | null; client_poc_phone: string | null
    job_tasks: Array<{ text: string; is_completed: boolean; sort_order: number }>
  }
  const row    = data as unknown as DetailRow
  const [base] = await toToolJobs(supabase, [row])
  return {
    ...base,
    description:             row.description,
    notes:                   row.notes,
    production_instructions: row.production_instructions,
    production_ready:        row.production_ready,
    do_issued:               row.do_issued,
    client_poc_name:         row.client_poc_name,
    client_poc_phone:        row.client_poc_phone,
    team: row.job_assignees.filter(a => a.users).map(a => ({
      name: a.users!.name, suggestion: a.is_suggestion, supporting: a.is_sub_installer,
    })),
    tasks: [...row.job_tasks].sort((a, b) => a.sort_order - b.sort_order)
      .map(t => ({ text: t.text, done: t.is_completed })),
  }
}

export type InstallerWorkload = {
  name: string
  jobs: Array<{ date: string; time_start: string | null; time_end: string | null; client: string; project_title: string | null }>
}

export async function getTeamWorkload(startDate: string, endDate: string): Promise<InstallerWorkload[]> {
  const supabase = await createClient()
  const [{ data: installers }, { data: jobs, error }] = await Promise.all([
    supabase.from('users').select('id, name').eq('role', 'installer').is('deleted_at', null),
    supabase.from('jobs')
      .select('id, date, time_start, time_end, client, project_title, job_assignees ( user_id, is_suggestion, is_sub_installer )')
      .eq('status', 'scheduled')
      .gte('date', startDate).lte('date', endDate),
  ])
  if (error) throw error
  type WRow = {
    id: string; date: string; time_start: string | null; time_end: string | null
    client: string; project_title: string | null
    job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
  }
  const byInstaller = new Map<string, InstallerWorkload>()
  for (const u of (installers ?? []) as Array<{ id: string; name: string }>) {
    byInstaller.set(u.id, { name: u.name, jobs: [] })
  }
  for (const j of ((jobs ?? []) as unknown as WRow[])) {
    for (const a of j.job_assignees) {
      if (a.is_suggestion || a.is_sub_installer) continue  // formal main bookings only
      byInstaller.get(a.user_id)?.jobs.push({
        date: j.date, time_start: j.time_start, time_end: j.time_end,
        client: j.client, project_title: j.project_title,
      })
    }
  }
  return [...byInstaller.values()].map(w => ({
    ...w, jobs: w.jobs.sort((a, b) => a.date.localeCompare(b.date) || (a.time_start ?? '').localeCompare(b.time_start ?? '')),
  }))
}

export type ClashCheck =
  | { error: string }
  | { candidates: string[] }
  | {
      installer: string
      overlaps: Array<{
        job_id: string; project_title: string | null; client: string
        time_start: string | null; time_end: string | null
        punctuality: string; suggestion_only: boolean
      }>
      /**
       * Recorded leave blocking that date, or null. Dates and half-day
       * portions ONLY — the leave TYPE is never included, and cannot be:
       * user_leave_details is RLS-locked to hr/admin and is not queried here.
       */
      on_leave: {
        date_start: string; date_end: string
        start_portion: string; end_portion: string
      } | null
    }

export async function checkInstallerClashes(
  installerName: string, date: string, timeStart: string | null, timeEnd: string | null,
): Promise<ClashCheck> {
  const supabase = await createClient()
  const safe = installerName.replace(/[,%().]/g, ' ').trim()
  if (!safe) return { error: 'installer_name is empty' }
  const { data: matches } = await supabase.from('users')
    .select('id, name').eq('role', 'installer').is('deleted_at', null)
    .ilike('name', `%${safe}%`)
  const people = (matches ?? []) as Array<{ id: string; name: string }>
  if (people.length === 0) return { error: `No installer matching "${installerName}" found` }
  const exact = people.find(p => p.name.toLowerCase() === safe.toLowerCase())
  if (people.length > 1 && !exact) return { candidates: people.map(p => p.name) }
  const person = exact ?? people[0]

  const { data: jobs, error } = await supabase.from('jobs')
    .select('id, project_title, client, time_start, time_end, punctuality, job_assignees ( user_id, is_suggestion, is_sub_installer )')
    .eq('status', 'scheduled').eq('date', date)
  if (error) throw error
  type CRow = {
    id: string; project_title: string | null; client: string
    time_start: string | null; time_end: string | null; punctuality: string
    job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
  }
  const overlaps = ((jobs ?? []) as unknown as CRow[])
    .map(j => ({ j, a: j.job_assignees.find(a => a.user_id === person.id && !a.is_sub_installer) }))
    .filter((x): x is { j: CRow; a: { user_id: string; is_suggestion: boolean; is_sub_installer: boolean } } => !!x.a)
    // Same overlap semantics as the push-time clash check (whole-day floaters overlap everything)
    .filter(({ j }) => timesOverlap(timeStart, timeEnd, j.time_start, j.time_end))
    .map(({ j, a }) => ({
      job_id: j.id, project_title: j.project_title, client: j.client,
      time_start: j.time_start, time_end: j.time_end,
      punctuality: j.punctuality, suggestion_only: a.is_suggestion,
    }))

  // Leave for that date. Runs on the user-scoped client like everything else
  // here — every role may read WHO is away; the reason lives in a different,
  // RLS-locked table this never touches.
  const { data: leaveRows } = await supabase.from('user_leaves')
    .select('id, user_id, date_start, date_end, start_portion, end_portion')
    .eq('user_id', person.id)
    .lte('date_start', date)
    .gte('date_end', date)
  const leaves = (leaveRows ?? []) as unknown as LeaveRecord[]
  const blocking = leaves.find(l => leaveBlocksJob(l, date, null, timeStart, timeEnd))

  return {
    installer: person.name,
    overlaps,
    on_leave: blocking
      ? {
          date_start:    blocking.date_start,
          date_end:      blocking.date_end,
          start_portion: blocking.start_portion,
          end_portion:   blocking.end_portion,
        }
      : null,
  }
}
