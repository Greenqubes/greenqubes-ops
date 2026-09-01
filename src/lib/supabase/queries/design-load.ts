import { createClient } from '@/lib/supabase/server'
import { getDesignerUsers } from './designers'
import type { JobStatus } from '@/lib/supabase/types'

// ── Types ────────────────────────────────────────────────────────────────────

export type DesignLoadJob = {
  jobId:        string
  projectTitle: string
  client:       string
  location:     string
  installDate:  string | null
  createdAt:    string
  assignedAt:   string
  pocName:      string
  complexity:   number | null
  confidence:   'ok' | 'low' | null
  reason:       string | null
  dueDate:      string | null
}

export type DesignLoadData = {
  designers: Array<{ id: string; name: string; jobs: DesignLoadJob[] }>
}

export type MyDesignJob = DesignLoadJob & {
  designCompletedAt: string | null
  status:            string
}

// ── Row shapes off `job_designers` (embedding `jobs` — single FK, safe) ───────

type JobEmbed = {
  id:                  string
  project_title:       string | null
  client:              string
  location:            string
  date:                string | null
  created_at:          string
  sales_poc_id:        string | null
  status:              JobStatus
  design_complexity:   number | null
  design_confidence:   'ok' | 'low' | null
  design_score_reason: string | null
  design_due_date:     string | null
  design_completed_at: string | null
}

type JobDesignerRow = {
  user_id:     string
  assigned_at: string
  jobs:        JobEmbed | null
}

const DESIGN_LOAD_SELECT = `
  user_id, assigned_at,
  jobs (
    id, project_title, client, location, date, created_at, sales_poc_id,
    status, design_complexity, design_confidence, design_score_reason,
    design_due_date, design_completed_at
  )
`

// POC names come from a follow-up `users in (ids)` query — NEVER embed
// `users` onto `jobs` in the same select (standing rule; breaks with
// PGRST201 — see fcfs.ts / jobs.ts for the same pattern).
async function attachPocNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: JobDesignerRow[],
): Promise<Map<string, string>> {
  const ids = [...new Set(
    rows.map(r => r.jobs?.sales_poc_id).filter((id): id is string => !!id),
  )]
  const nameById = new Map<string, string>()
  if (ids.length === 0) return nameById
  const { data } = await (supabase
    .from('users')
    .select('id, name')
    .in('id', ids) as unknown as Promise<{ data: Array<{ id: string; name: string }> | null }>)
  for (const u of data ?? []) nameById.set(u.id, u.name)
  return nameById
}

function toDesignLoadJob(row: JobDesignerRow, pocNames: Map<string, string>): DesignLoadJob {
  const job = row.jobs!
  return {
    jobId:        job.id,
    projectTitle: job.project_title ?? '',
    client:       job.client,
    location:     job.location,
    installDate:  job.date ?? null,
    createdAt:    job.created_at,
    assignedAt:   row.assigned_at,
    pocName:      job.sales_poc_id ? (pocNames.get(job.sales_poc_id) ?? '') : '',
    complexity:   job.design_complexity,
    confidence:   job.design_confidence,
    reason:       job.design_score_reason,
    dueDate:      job.design_due_date,
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

// The board: every designer (even ones with zero jobs — empty bars still
// render), populated with their OPEN design jobs only. Open = has a
// job_designers row + design_completed_at is null + status != 'completed'.
export async function getDesignLoad(): Promise<DesignLoadData> {
  const supabase = await createClient()
  const designers = await getDesignerUsers()

  const { data, error } = await supabase
    .from('job_designers')
    .select(DESIGN_LOAD_SELECT)
    .order('assigned_at', { ascending: false })
  if (error) throw error

  const rows = ((data ?? []) as unknown as JobDesignerRow[]).filter(
    r => r.jobs && r.jobs.design_completed_at === null && r.jobs.status !== 'completed',
  )

  const pocNames = await attachPocNames(supabase, rows)

  const byDesigner = new Map<string, DesignLoadJob[]>()
  for (const row of rows) {
    const list = byDesigner.get(row.user_id) ?? []
    list.push(toDesignLoadJob(row, pocNames))
    byDesigner.set(row.user_id, list)
  }
  // Query is already ordered assigned_at DESC, so each designer's bucket
  // comes out newest-first — re-sort defensively so grouping order never
  // depends on how Postgres happens to stream matching rows.
  for (const list of byDesigner.values()) {
    list.sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
  }

  return {
    designers: designers.map(d => ({
      id:   d.id,
      name: d.name,
      jobs: byDesigner.get(d.id) ?? [],
    })),
  }
}

// ALL of one designer's design jobs, including completed ones (the board
// query above excludes those) — feeds the My Jobs view, which buckets
// client-side into To-do / Ready to install / Past.
export async function getMyDesignJobs(designerUserId: string): Promise<MyDesignJob[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('job_designers')
    .select(DESIGN_LOAD_SELECT)
    .eq('user_id', designerUserId)
    .order('assigned_at', { ascending: false })
  if (error) throw error

  const rows = ((data ?? []) as unknown as JobDesignerRow[]).filter(r => r.jobs)
  const pocNames = await attachPocNames(supabase, rows)

  return rows
    .map(row => ({
      ...toDesignLoadJob(row, pocNames),
      designCompletedAt: row.jobs!.design_completed_at,
      status:            row.jobs!.status,
    }))
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
}
