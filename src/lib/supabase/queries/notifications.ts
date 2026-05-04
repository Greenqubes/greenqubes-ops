import { createServiceClient } from '@/lib/supabase/service'

// Always uses the service client — called from server-side API routes and cron jobs.

export type NotifRecipient = {
  id:               string
  name:             string
  telegram_chat_id: string | null
}

export type JobRecipients = {
  salesPoc:   NotifRecipient | null
  installers: NotifRecipient[]
}

export async function getJobRecipients(jobId: string): Promise<JobRecipients> {
  const supabase = createServiceClient()

  type JobWithRecipients = {
    sales_poc:    NotifRecipient | null
    job_assignees: Array<{ users: NotifRecipient | null }>
  }
  const { data: job } = await supabase
    .from('jobs')
    .select(`
      sales_poc:users!jobs_sales_poc_id_fkey ( id, name, telegram_chat_id ),
      job_assignees ( users ( id, name, telegram_chat_id ) )
    `)
    .eq('id', jobId)
    .maybeSingle() as { data: JobWithRecipients | null; error: unknown }

  if (!job) return { salesPoc: null, installers: [] }

  const salesPoc = job.sales_poc

  const installers = job.job_assignees
    .map(a => a.users)
    .filter((u): u is NotifRecipient => u !== null)

  return { salesPoc, installers }
}

export async function getSchedulers(): Promise<NotifRecipient[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('users')
    .select('id, name, telegram_chat_id')
    .eq('role', 'scheduler')
  return (data ?? []) as NotifRecipient[]
}

// ── Overdue alerts ────────────────────────────────────────────────────────────

export type OverdueJob = {
  id:        string
  client:    string
  date:      string
  time_end:  string | null
  location:  string
  sales_poc: { id: string; telegram_chat_id: string | null } | null
  job_assignees: Array<{
    users: { id: string; telegram_chat_id: string | null } | null
  }>
}

export async function getOverdueJobs(): Promise<OverdueJob[]> {
  const supabase = createServiceClient()

  // SGT is UTC+8; compare against today's date in SGT
  const sgtNow  = new Date(Date.now() + 8 * 3_600_000)
  const todaySGT = sgtNow.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, client, date, time_end, location,
      sales_poc:users!jobs_sales_poc_id_fkey ( id, telegram_chat_id ),
      job_assignees ( users ( id, telegram_chat_id ) )
    `)
    .eq('status', 'scheduled')
    .lte('date', todaySGT)

  if (error) throw error
  return (data ?? []) as unknown as OverdueJob[]
}

// ── Deduplication via events table ───────────────────────────────────────────

// Returns true if an overdue notification was already sent for this job
// within the last `windowMinutes` (default 2 hours).
export async function wasRecentlyNotified(
  jobId:         string,
  windowMinutes: number = 120,
): Promise<boolean> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()

  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'overdue_notification')
    .eq('target_id', jobId)
    .gte('ts', since)

  return (count ?? 0) > 0
}

export async function recordOverdueNotification(jobId: string): Promise<void> {
  const supabase = createServiceClient()
  await supabase.from('events').insert({
    actor_id:     null,
    kind:         'overdue_notification',
    target_id:    jobId,
    target_table: 'jobs',
    payload:      null,
    visibility:   ['role:scheduler'],
  } as never)
}
