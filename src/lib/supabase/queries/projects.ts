import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { scoreJob } from '@/lib/utils/project-keywords'

export type JobProject = {
  id: string; name: string; client: string; description: string | null
  time_start: string | null; time_end: string | null
  default_punctuality: 'strict' | 'flexible' | null
  created_by: string | null; r2_folder: string | null
}

export type ProjectJobRow = {
  id: string; status: string; date: string; date_end: string | null
  time_start: string | null; time_end: string | null; time_inherited: boolean
  project_title: string | null; client: string; location: string
  punctuality: 'strict' | 'flexible'
  sales_poc_id: string | null; completed_at: string | null
}

export type ProjectListItem = JobProject & {
  jobCount: number; doneCount: number
  spans: { date: string; date_end: string | null }[]
}

const PROJECT_SELECT = 'id, name, client, description, time_start, time_end, default_punctuality, created_by, r2_folder'

export async function getProjectById(id: string): Promise<JobProject | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('job_projects').select(PROJECT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as JobProject | null
}

export async function getProjectJobs(projectId: string): Promise<ProjectJobRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('id, status, date, date_end, time_start, time_end, time_inherited, project_title, client, location, punctuality, sales_poc_id, completed_at')
    .eq('project_id', projectId)
    .order('date', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as ProjectJobRow[]
}

export async function getProjectsList(): Promise<ProjectListItem[]> {
  const supabase = await createClient()
  const [{ data: projects, error: pErr }, { data: jobs, error: jErr }] = await Promise.all([
    supabase.from('job_projects').select(PROJECT_SELECT).order('created_at', { ascending: false }),
    supabase.from('jobs').select('project_id, status, date, date_end').not('project_id', 'is', null),
  ])
  if (pErr) throw pErr
  if (jErr) throw jErr
  type MiniJob = { project_id: string; status: string; date: string; date_end: string | null }
  const byProject = new Map<string, MiniJob[]>()
  for (const j of (jobs ?? []) as unknown as MiniJob[]) {
    const list = byProject.get(j.project_id) ?? []
    list.push(j); byProject.set(j.project_id, list)
  }
  return ((projects ?? []) as unknown as JobProject[]).map(p => {
    const list = byProject.get(p.id) ?? []
    return {
      ...p,
      jobCount:  list.length,
      doneCount: list.filter(j => j.status === 'completed').length,
      spans:     list.map(j => ({ date: j.date, date_end: j.date_end })),
    }
  })
}

export type NestableJob = {
  id: string; project_title: string | null; client: string; status: string
  date: string; sales_poc_id: string | null; created_by: string | null
}

// Picker search (browser). Pending is personal (spec §6): when the caller is
// sales or coordinator, other people's PENDING jobs are filtered out here
// even though today's blanket RLS would return them — scheduler/admin see all.
export async function searchNestableJobs(opts: {
  keywords: string[]; query: string; callerRole: string; callerId: string
}): Promise<NestableJob[]> {
  const supabase = createBrowserClient()
  let q = supabase
    .from('jobs')
    .select('id, project_title, client, status, date, sales_poc_id, created_by')
    .is('project_id', null)
    .in('status', ['pending', 'scheduled', 'completed'])
    .order('date', { ascending: false })
    .limit(200)
  // PostgREST or-filters treat , ( ) as syntax and % as a wildcard — strip
  // them from user text so a search for "Acme, Inc." can't produce a
  // malformed filter that throws (controller ruling, Task 5 review).
  const text = opts.query.replace(/[,()%]/g, ' ').trim()
  if (text) q = q.or(`project_title.ilike.%${text}%,client.ilike.%${text}%`)
  const { data, error } = await q
  if (error) throw error
  let rows = (data ?? []) as unknown as NestableJob[]
  if (opts.callerRole === 'sales' || opts.callerRole === 'coordinator') {
    rows = rows.filter(j =>
      j.status !== 'pending' || j.sales_poc_id === opts.callerId || j.created_by === opts.callerId)
  }
  return rows
    .map(j => ({ j, s: scoreJob(j, opts.keywords) }))
    .sort((a, b) => b.s - a.s || a.j.date.localeCompare(b.j.date))
    .map(x => x.j)
    .slice(0, 30)
}
