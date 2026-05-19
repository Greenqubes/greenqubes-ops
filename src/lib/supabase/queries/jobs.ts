import { createClient } from '@/lib/supabase/server'
import type { JobStatus, FileKind, Punctuality } from '@/lib/supabase/types'

// ── Schedule list ────────────────────────────────────────────────────────────

export type ScheduleJob = {
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
  punctuality:      Punctuality
  production_ready: boolean
  do_issued:        boolean
  job_assignees:    Array<{ users: { id: string; name: string } | null }>
}

const SCHEDULE_SELECT = `
  id, status, date, date_end, time_start, time_end,
  project_title, client, location, description, punctuality,
  production_ready, do_issued,
  job_assignees ( users ( id, name ) )
`

export async function getScheduleJobs(): Promise<ScheduleJob[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select(SCHEDULE_SELECT)
    .order('date',       { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as ScheduleJob[]
}

export async function getCompletedJobs(): Promise<ScheduleJob[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select(SCHEDULE_SELECT)
    .eq('status', 'completed')
    .order('date',       { ascending: false })
    .order('time_start', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as ScheduleJob[]
}

export async function getPendingJobs(): Promise<ScheduleJob[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select(SCHEDULE_SELECT)
    .in('status', ['pending', 'awaiting_approval'])
    .order('date',       { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as unknown as ScheduleJob[]
}

// ── Job detail ───────────────────────────────────────────────────────────────

export type InstallerUser = {
  id:    string
  name:  string
  phone: string | null
}

export type JobFile = {
  id:          string
  job_id:      string
  kind:        FileKind
  r2_key:      string
  uploader_id: string | null
  ts:          string
  users:       { name: string } | null
}

export type JobMessage = {
  id:        string
  job_id:    string
  author_id: string | null
  kind:      'text' | 'voice'
  content:   string | null
  voice_url: string | null
  ts:        string
  users:     { name: string } | null
}

export type JobDetail = {
  id:                      string
  status:                  JobStatus
  date:                    string
  date_end:                string | null
  time_start:              string | null
  time_end:                string | null
  project_title:           string | null
  client:                  string
  location:                string
  description:             string | null
  client_poc_name:         string | null
  client_poc_phone:        string | null
  sales_poc_id:            string | null
  production_ready:        boolean
  do_issued:               boolean
  punctuality:             Punctuality
  production_instructions: string | null
  notes:                   string | null
  approved_by:             string | null
  approved_at:             string | null
  completed_at:            string | null
  completion_override:     boolean
  created_at:              string
  updated_at:              string
  job_assignees: Array<{ users: InstallerUser | null }>
  job_financials: {
    quote_amount:  number | null
    supplier_cost: number | null
    margin_notes:  string | null
  } | null
  files: JobFile[]
}

export type CoreFieldsPatch = {
  date?:                    string
  date_end?:                string | null
  time_start?:              string | null
  time_end?:                string | null
  project_title?:           string | null
  client?:                  string
  location?:                string
  description?:             string | null
  client_poc_name?:         string | null
  client_poc_phone?:        string | null
  production_ready?:        boolean
  do_issued?:               boolean
  punctuality?:             Punctuality
  production_instructions?: string | null
  notes?:                   string | null
}

export type FinancialsPatch = {
  quote_amount?:  number | null
  supplier_cost?: number | null
  margin_notes?:  string | null
}

export async function getJobById(id: string): Promise<JobDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, status, date, date_end, time_start, time_end,
      project_title, client, location, description, client_poc_name, client_poc_phone,
      sales_poc_id, production_ready, do_issued, punctuality,
      production_instructions, notes, approved_by, approved_at,
      completed_at, completion_override, created_at, updated_at,
      job_assignees ( users ( id, name, phone ) ),
      job_financials ( quote_amount, supplier_cost, margin_notes ),
      files ( id, kind, r2_key, uploader_id, ts, users!files_uploader_id_fkey ( name ) )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as JobDetail | null
}

export async function updateJobFields(id: string, patch: CoreFieldsPatch): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('jobs').update(patch as never).eq('id', id)
  if (error) throw error
}

export async function updateJobFinancials(jobId: string, patch: FinancialsPatch): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('job_financials')
    .upsert({ job_id: jobId, ...patch } as never, { onConflict: 'job_id' })
  if (error) throw error
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
): Promise<void> {
  const supabase = await createClient()
  const patch: Record<string, unknown> = { status }
  if (status === 'completed') patch.completed_at = new Date().toISOString()
  const { error } = await supabase.from('jobs').update(patch as never).eq('id', id)
  if (error) throw error
}

export async function getInstallerUsers(): Promise<InstallerUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone')
    .eq('role', 'installer')
    .order('name')
  if (error) throw error
  return (data ?? []) as InstallerUser[]
}

export async function addJobAssignee(jobId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('job_assignees')
    .insert({ job_id: jobId, user_id: userId } as never)
  if (error) throw error
}

export async function removeJobAssignee(jobId: string, userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('job_assignees')
    .delete()
    .eq('job_id', jobId)
    .eq('user_id', userId)
  if (error) throw error
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getJobMessages(jobId: string): Promise<JobMessage[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .select('id, author_id, kind, content, voice_url, ts, users!messages_author_id_fkey ( name )')
    .eq('job_id', jobId)
    .order('ts', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as JobMessage[]
}

export async function insertMessage(
  jobId:    string,
  authorId: string,
  content:  string,
): Promise<JobMessage> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      job_id:    jobId,
      author_id: authorId,
      kind:      'text',
      content,
      visibility: ['public-internal'],
    } as never)
    .select('id, author_id, kind, content, voice_url, ts, users!messages_author_id_fkey ( name )')
    .single()
  if (error) throw error
  return data as unknown as JobMessage
}

export async function insertVoiceMessage(
  jobId:    string,
  authorId: string,
  voiceUrl: string,
): Promise<JobMessage> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('messages')
    .insert({
      job_id:    jobId,
      author_id: authorId,
      kind:      'voice',
      voice_url: voiceUrl,
      visibility: ['public-internal'],
    } as never)
    .select('id, author_id, kind, content, voice_url, ts, users!messages_author_id_fkey ( name )')
    .single()
  if (error) throw error
  return data as unknown as JobMessage
}

// ── Files ─────────────────────────────────────────────────────────────────────

export async function insertFile(
  jobId:      string,
  kind:       FileKind,
  r2Key:      string,
  uploaderId: string,
): Promise<JobFile> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('files')
    .insert({
      job_id:      jobId,
      kind,
      r2_key:      r2Key,
      uploader_id: uploaderId,
      visibility:  ['public-internal'],
    } as never)
    .select('id, kind, r2_key, uploader_id, ts, users!files_uploader_id_fkey ( name )')
    .single()
  if (error) throw error
  return data as unknown as JobFile
}
