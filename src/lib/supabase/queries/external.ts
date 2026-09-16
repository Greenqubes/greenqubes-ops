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
  // Sales SUGGESTIONS (is_suggestion = true) are invisible here — the contact
  // must not see a job until a scheduler/coordinator confirms the link.
  const { data } = await supabase
    .from('job_external_contacts')
    .select(`
      job_id, assigned_at,
      jobs ( id, project_title, client, location, date, date_end,
             time_start, time_end, punctuality, status )
    `)
    .eq('contact_id', contactId)
    .eq('is_suggestion', false)
    .order('assigned_at', { ascending: false })

  type Row = {
    job_id: string; assigned_at: string
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

/**
 * Is this contact formally on this job? Gates the detail page and the task
 * list.
 *
 * Was `getContactJobLink`, returning the link's accept/decline status, and
 * both callers demanded `'accepted'`. Accept/decline was removed on
 * 2026-09-16 (Nic): "we will inform beforehand through message and call to
 * set agreement for the job, in which they have no rights to reject once
 * agreed unless informed otherwise again." Agreement is reached before anyone
 * is put on a job, so being on it IS the agreement and there is nothing to
 * accept.
 *
 * This had to change in the SAME commit as the buttons. Leaving the old
 * `!== 'accepted'` check while removing the only way to REACH 'accepted'
 * would have locked every external installer out of every job with a 403,
 * permanently and with no way back in.
 *
 * `is_suggestion` still gates: a tentative sales pick stays invisible here
 * until a scheduler or coordinator confirms it (migration 0040).
 */
export async function isContactOnJob(
  contactId: string,
  jobId: string,
): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('job_external_contacts')
    .select('job_id')
    .eq('contact_id', contactId)
    .eq('job_id', jobId)
    .eq('is_suggestion', false)
    .maybeSingle()
  return !!data
}
