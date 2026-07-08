import { createClient } from '@/lib/supabase/server'
import type { JobStatus, Punctuality } from '@/lib/supabase/types'

export type InstallerJob = {
  id:               string
  status:           JobStatus
  date:             string
  date_end:         string | null
  time_start:       string | null
  time_end:         string | null
  project_title:    string | null
  client:           string
  location:         string
  description:      string | null
  client_poc_name:  string | null
  client_poc_phone: string | null
  sales_poc_id:     string | null
  punctuality:      Punctuality
  production_ready: boolean
  do_issued:        boolean
  job_assignees:    Array<{ is_suggestion?: boolean; users: { id: string; name: string } | null }>
  sales_poc:        { name: string; phone: string | null } | null
}

export async function getInstallerJobs(): Promise<InstallerJob[]> {
  const supabase = await createClient()

  // NOTE: no direct jobs→users embed here. `jobs` has multiple FKs to `users`
  // (sales_poc_id, approved_by), and embedding one of them alongside the nested
  // job_assignees→users embed has proven fragile (see the PGRST201 history /
  // migration 0035). The sales POC is fetched in a second query instead.
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, status, date, date_end, time_start, time_end,
      project_title, client, location, description, client_poc_name, client_poc_phone,
      sales_poc_id, punctuality, production_ready, do_issued,
      job_assignees ( is_suggestion, users ( id, name ) )
    `)
    .in('status', ['scheduled', 'completed'])
    .order('date', { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })

  if (error) throw error

  const rows = (data ?? []) as unknown as Array<InstallerJob & { sales_poc_id: string | null }>

  // Resolve sales POC name/phone in one follow-up query, then map by id.
  const pocIds = [...new Set(rows.map(r => r.sales_poc_id).filter((x): x is string => !!x))]
  let pocMap: Record<string, { name: string; phone: string | null }> = {}
  if (pocIds.length > 0) {
    const { data: pocs } = await supabase
      .from('users')
      .select('id, name, phone')
      .in('id', pocIds) as { data: Array<{ id: string; name: string; phone: string | null }> | null }
    pocMap = Object.fromEntries((pocs ?? []).map(u => [u.id, { name: u.name, phone: u.phone }]))
  }

  // Drop tentative suggestions so co-assignee lists show confirmed installers only.
  return rows.map(j => ({
    ...j,
    sales_poc:     j.sales_poc_id ? pocMap[j.sales_poc_id] ?? null : null,
    job_assignees: j.job_assignees.filter(a => !a.is_suggestion),
  }))
}
