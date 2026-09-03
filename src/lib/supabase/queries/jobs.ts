import { createClient } from '@/lib/supabase/server'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import type { JobStatus, FileKind, Punctuality } from '@/lib/supabase/types'
import { linkStatus, type LinkStatus } from '@/lib/utils/user-meta'

// â”€â”€ Schedule list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  job_assignees:    Array<{ is_suggestion?: boolean; users: { id: string; name: string } | null }>
  // Team lines on the list cards (Nic, 2026-08-19). Optional because the
  // installer views feed InstallerJob rows (no team fields) into JobRow —
  // the card only renders the lines when these are present.
  sales_poc_id?:     string | null
  sales_name?:       string | null
  job_coordinators?: Array<{ users: { name: string } | null }>
}

const SCHEDULE_SELECT = `
  id, status, date, date_end, time_start, time_end,
  project_title, client, location, description, punctuality,
  production_ready, do_issued, sales_poc_id,
  job_assignees ( is_suggestion, users ( id, name ) ),
  job_coordinators ( users ( name ) )
`

// Suggestions (is_suggestion=true) are tentative sales picks — they must not
// render as confirmed assignees on the schedule/calendar. Strip them here so
// every consumer of ScheduleJob only ever sees formal assignments.
function stripSuggestions<T extends { job_assignees: Array<{ is_suggestion?: boolean }> }>(rows: T[]): T[] {
  return rows.map(r => ({
    ...r,
    job_assignees: r.job_assignees.filter(a => !a.is_suggestion),
  }))
}

// Sales POC names come from a follow-up query — never embed users directly
// onto jobs in a PostgREST select (standing rule; it has broken twice).
async function attachSalesNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ScheduleJob[],
): Promise<ScheduleJob[]> {
  const ids = [...new Set(rows.map(r => r.sales_poc_id).filter(Boolean))] as string[]
  if (ids.length === 0) return rows.map(r => ({ ...r, sales_name: null }))
  type NameRow = { id: string; name: string }
  const { data } = await (supabase
    .from('users')
    .select('id, name')
    .in('id', ids) as unknown as Promise<{ data: NameRow[] | null }>)
  const nameById = new Map((data ?? []).map(u => [u.id, u.name]))
  return rows.map(r => ({
    ...r,
    sales_name: r.sales_poc_id ? (nameById.get(r.sales_poc_id) ?? null) : null,
  }))
}

export async function getScheduleJobs(): Promise<ScheduleJob[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select(SCHEDULE_SELECT)
    .order('date',       { ascending: true })
    .order('time_start', { ascending: true, nullsFirst: false })
  if (error) throw error
  return attachSalesNames(supabase, stripSuggestions((data ?? []) as unknown as ScheduleJob[]))
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
  return attachSalesNames(supabase, stripSuggestions((data ?? []) as unknown as ScheduleJob[]))
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
  return attachSalesNames(supabase, stripSuggestions((data ?? []) as unknown as ScheduleJob[]))
}

// â”€â”€ Job detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type InstallerUser = {
  id:             string
  name:           string
  phone:          string | null
  role:           string
  subrole:        string | null
  is_driver:      boolean
  qualifications: string[]
  link_status:    LinkStatus
}

export type JobFile = {
  id:          string
  job_id:      string
  // Set when the file lives in an attachment bucket — bucket files share
  // kind 'attachment' with chat uploads, so chat must filter these out.
  bucket_id:   string | null
  kind:        FileKind
  r2_key:      string
  // Original upload filename; NULL on rows from before migration 0041.
  name:        string | null
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
  design_brief:            string | null
  design_due_date:         string | null
  design_due_manual:       boolean
  // Design-completed flow (Task 8) — the shell needs only the timestamp to
  // gate the completion pill / scheduler tick / reopen button; the rating
  // fields belong to Task 11's Flagged strip, not here.
  design_completed_at:     string | null
  created_at:              string
  updated_at:              string
  // Addendum §3 (Nic, 2026-08-27) — plain uuid, no FK (the 0035 lesson),
  // stamped by a BEFORE INSERT trigger; null on every pre-existing job.
  created_by:               string | null
  job_assignees: Array<{
    user_id:          string
    is_suggestion:    boolean
    suggested_by:     string | null
    is_sub_installer: boolean
    users:            InstallerUser | null
  }>
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
      completed_at, completion_override,
      design_brief, design_due_date, design_due_manual, design_completed_at,
      created_at, updated_at, created_by,
      job_assignees ( user_id, is_suggestion, suggested_by, is_sub_installer, users ( id, name, phone ) ),
      job_financials ( quote_amount, supplier_cost, margin_notes ),
      files ( id, bucket_id, kind, r2_key, name, uploader_id, ts, users!files_uploader_id_fkey ( name ) )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as unknown as JobDetail | null
}

// Creator's display name for the "Created by" line (Addendum §3) — a
// follow-up query, same rule as attachSalesNames: never embed users onto
// jobs in a PostgREST select (standing rule; it has broken twice, PGRST201).
// Returns null for pre-existing jobs (created_by is null) and for the rare
// case the creator's user row is gone (e.g. hard-deleted).
export async function getCreatorName(createdBy: string | null): Promise<string | null> {
  if (!createdBy) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('users')
    .select('name')
    .eq('id', createdBy)
    .maybeSingle() as { data: { name: string } | null; error: unknown }
  return data?.name ?? null
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

type RawCardUser = {
  id: string; name: string; phone: string | null; role: string
  subrole: string | null; is_driver: boolean; qualifications: string[]
  email: string | null; auth_id: string | null
}

// email/auth_id are consumed server-side to derive link_status — never returned.
function toCardUser({ email, auth_id, ...u }: RawCardUser): InstallerUser {
  return { ...u, link_status: linkStatus({ email, auth_id }) }
}

export async function getInstallerUsers(): Promise<InstallerUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone, role, subrole, is_driver, qualifications, email, auth_id')
    .eq('role', 'installer')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return ((data ?? []) as unknown as RawCardUser[]).map(toCardUser)
}

// Pool for the Support crew bucket (Nic 2026-09-04): everyone who is NOT an
// installer — production, sales, etc. — dispatched onto install teams for
// night jobs / manpower shortage. Same card shape as installers.
export async function getSupportUsers(): Promise<InstallerUser[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('users')
    .select('id, name, phone, role, subrole, is_driver, qualifications, email, auth_id')
    .neq('role', 'installer')
    .neq('name', 'GreenqubesAI')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return ((data ?? []) as unknown as RawCardUser[]).map(toCardUser)
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

// â”€â”€ Messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Attachment Buckets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type BucketFile = {
  id:          string
  job_id:      string | null
  bucket_id:   string | null
  kind:        FileKind
  r2_key:      string
  // Original upload filename; NULL on url_link rows and pre-0041 uploads.
  name:        string | null
  url_text:    string | null
  uploader_id: string | null
  ts:          string
}

export type AttachmentBucket = {
  id:         string
  job_id:     string
  name:       string
  position:   number
  created_at: string
  files:      BucketFile[]
}

export async function getJobBuckets(jobId: string): Promise<AttachmentBucket[]> {
  const supabase = createBrowserClient()
  const { data, error } = await supabase
    .from('attachment_buckets')
    .select('id, job_id, name, position, created_at, files(id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts)')
    .eq('job_id', jobId)
    .order('position')
  if (error) throw error
  return (data ?? []) as unknown as AttachmentBucket[]
}

export async function createDefaultBuckets(jobId: string): Promise<void> {
  const supabase = createBrowserClient()
  const buckets = [
    { job_id: jobId, name: 'PERMIT-TO-WORK', position: 0 },
    { job_id: jobId, name: 'BCA',            position: 1 },
    { job_id: jobId, name: 'DESIGNER JO',    position: 2 },
    { job_id: jobId, name: 'OTHERS',         position: 3 },
  ]
  const { error } = await supabase.from('attachment_buckets').insert(buckets as never)
  if (error) throw error
}

