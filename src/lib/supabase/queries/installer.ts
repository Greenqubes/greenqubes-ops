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
  job_assignees:    Array<{ users: { id: string; name: string } | null }>
  sales_poc:        { name: string; phone: string | null } | null
}

export async function getInstallerJobs(): Promise<InstallerJob[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, status, date, date_end, time_start, time_end,
      project_title, client, location, description, client_poc_name, client_poc_phone,
      sales_poc_id, punctuality, production_ready, do_issued,
      job_assignees ( users ( id, name ) ),
      sales_poc:users!jobs_sales_poc_id_fkey ( name, phone )
    `)
    .in('status', ['scheduled', 'completed'])
    .order('date', { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as unknown as InstallerJob[]
}
