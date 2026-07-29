import { createServiceClient } from '@/lib/supabase/service'

// Queries for the public external-installer pages (/ext/[token]).
// External people have NO Supabase session — every read goes through the
// service-role client AFTER the token has been validated. The token is the
// whole identity: 32 hex chars, generated once, never expires. A soft-deleted
// contact (deleted_at set) must behave exactly like a dead link.

export type ExternalContact = {
  id:         string
  name:       string
  deleted_at: string | null
}

export type TokenCheck =
  | { state: 'not_found' }
  | { state: 'deleted' }
  | { state: 'valid'; contact: ExternalContact }

export async function getContactByToken(token: string): Promise<TokenCheck> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('external_contacts')
    .select('id, name, deleted_at')
    .eq('token', token)
    .maybeSingle()
  if (!data) return { state: 'not_found' }
  if (data.deleted_at) return { state: 'deleted' }
  return { state: 'valid', contact: data }
}

export type ExtJobSummary = {
  job_id:      string
  status:      'pending' | 'accepted' | 'declined'
  assigned_at: string
  job: {
    id:            string
    project_title: string | null
    client:        string
    location:      string
    date:          string
    date_end:      string | null
    time_start:    string | null
    time_end:      string | null
    punctuality:   string
    job_status:    string
  }
}

export async function getContactJobs(contactId: string): Promise<ExtJobSummary[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('job_external_contacts')
    .select(`
      job_id, status, assigned_at,
      jobs ( id, project_title, client, location, date, date_end,
             time_start, time_end, punctuality, status )
    `)
    .eq('contact_id', contactId)
    .order('assigned_at', { ascending: false })

  type Row = {
    job_id: string; status: 'pending' | 'accepted' | 'declined'; assigned_at: string
    jobs: {
      id: string; project_title: string | null; client: string; location: string
      date: string; date_end: string | null; time_start: string | null
      time_end: string | null; punctuality: string; status: string
    } | null
  }

  return ((data ?? []) as unknown as Row[])
    .filter(r => r.jobs)
    .map(r => ({
      job_id:      r.job_id,
      status:      r.status,
      assigned_at: r.assigned_at,
      job: {
        id:            r.jobs!.id,
        project_title: r.jobs!.project_title,
        client:        r.jobs!.client,
        location:      r.jobs!.location,
        date:          r.jobs!.date,
        date_end:      r.jobs!.date_end,
        time_start:    r.jobs!.time_start,
        time_end:      r.jobs!.time_end,
        punctuality:   r.jobs!.punctuality,
        job_status:    r.jobs!.status,
      },
    }))
}

// The link between one contact and one job — used to gate the detail page
// (attachments / tasks unlock only after acceptance).
export async function getContactJobLink(
  contactId: string,
  jobId: string,
): Promise<'pending' | 'accepted' | 'declined' | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('job_external_contacts')
    .select('status')
    .eq('contact_id', contactId)
    .eq('job_id', jobId)
    .maybeSingle()
  return data?.status ?? null
}
