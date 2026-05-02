import { createClient } from '@/lib/supabase/server'
import type { JobStatus } from '@/lib/supabase/types'

// ── Approvals queue ───────────────────────────────────────────────────────────

export type ApprovalJob = {
  id:           string
  status:       JobStatus
  date:         string
  time_start:   string | null
  time_end:     string | null
  client:       string
  location:     string
  description:  string | null
  created_at:   string
  sales_poc_id: string | null
  job_assignees: Array<{ users: { id: string; name: string } | null }>
  job_financials: { quote_amount: number | null; supplier_cost: number | null } | null
}

export async function getApprovalQueue(): Promise<ApprovalJob[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, status, date, time_start, time_end,
      client, location, description, created_at, sales_poc_id,
      job_assignees ( users ( id, name ) ),
      job_financials ( quote_amount, supplier_cost )
    `)
    .eq('status', 'awaiting_approval')
    .order('date',       { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as ApprovalJob[]
}

export async function getApprovalCount(): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'awaiting_approval')
  if (error) throw error
  return count ?? 0
}

// ── Workload preview ──────────────────────────────────────────────────────────

export type WorkloadDay = {
  date:           string
  jobCount:       number
  installerNames: string[]
}

export async function getWorkloadByDateRange(from: string, to: string): Promise<WorkloadDay[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('date, job_assignees ( users ( name ) )')
    .gte('date', from)
    .lte('date', to)
    .in('status', ['scheduled', 'awaiting_approval', 'pending'])
    .order('date', { ascending: true })
  if (error) throw error

  type RawJob = { date: string; job_assignees: Array<{ users: { name: string } | null }> }
  const raw = (data ?? []) as unknown as RawJob[]

  const dayMap = new Map<string, { count: number; installers: Set<string> }>()
  for (const job of raw) {
    const entry = dayMap.get(job.date) ?? { count: 0, installers: new Set<string>() }
    entry.count++
    for (const a of job.job_assignees) {
      if (a.users?.name) entry.installers.add(a.users.name)
    }
    dayMap.set(job.date, entry)
  }

  const result: WorkloadDay[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to   + 'T00:00:00')
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10)
    const entry   = dayMap.get(dateStr)
    result.push({
      date:           dateStr,
      jobCount:       entry?.count ?? 0,
      installerNames: entry ? Array.from(entry.installers) : [],
    })
    cur.setDate(cur.getDate() + 1)
  }
  return result
}
