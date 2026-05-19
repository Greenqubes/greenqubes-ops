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

export type JobNotifData = {
  project_title:    string | null
  client:           string
  client_poc_name:  string | null
  client_poc_phone: string | null
  date:             string
  time_start:       string | null
  time_end:         string | null
  location:         string
}

export async function getJobNotifData(jobId: string): Promise<JobNotifData | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('project_title, client, client_poc_name, client_poc_phone, date, time_start, time_end, location')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw error
  return data as JobNotifData | null
}

// ── Overdue alerts ────────────────────────────────────────────────────────────

export type OverdueJob = {
  id:               string
  project_title:    string | null
  client:           string
  client_poc_name:  string | null
  client_poc_phone: string | null
  date:             string
  time_start:       string | null
  time_end:         string | null
  location:         string
  sales_poc:        { id: string; telegram_chat_id: string | null } | null
  job_assignees:    Array<{
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
      id, project_title, client, client_poc_name, client_poc_phone,
      date, time_start, time_end, location,
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

// ── Chat notification throttle ────────────────────────────────────────────────

export type JobChatState = {
  last_seen_at:     string | null
  last_notified_at: string | null
}

export async function getJobChatState(
  jobId:  string,
  userId: string,
): Promise<JobChatState | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('job_chat_state')
    .select('last_seen_at, last_notified_at')
    .eq('job_id', jobId)
    .eq('user_id', userId)
    .maybeSingle()
  return data as JobChatState | null
}

// Count messages in this job sent by someone other than the recipient,
// after the most recent of their last_seen_at or last_notified_at.
export async function countUnseenMessages(
  jobId:       string,
  recipientId: string,
  state:       JobChatState | null,
): Promise<number> {
  const supabase = createServiceClient()
  const since = state?.last_seen_at ?? state?.last_notified_at ?? null

  let query = supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .neq('author_id', recipientId)

  if (since) query = query.gt('ts', since)

  const { count } = await query
  return count ?? 0
}

export async function upsertJobChatNotified(
  jobId:  string,
  userId: string,
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from('job_chat_state')
    .upsert(
      { job_id: jobId, user_id: userId, last_notified_at: new Date().toISOString() } as never,
      { onConflict: 'job_id,user_id' },
    )
}
