import { createClient } from '@/lib/supabase/server'

// NestableJob/searchNestableJobs live in projects-search.ts (browser-only —
// no `next/headers` import) so Client Components can pull in the search
// function without dragging this file's server client into their bundle.
// Re-exported here (type-only) so existing `from '.../queries/projects'`
// type imports keep working unchanged.
export type { NestableJob } from './projects-search'

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

// NestableJob + searchNestableJobs moved to ./projects-search (browser-only).
