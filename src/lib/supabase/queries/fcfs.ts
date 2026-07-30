import { createClient } from '@/lib/supabase/server'
import type { Punctuality } from '@/lib/supabase/types'

// ── FCFS board ──────────────────────────────────────────────────────────────

export type FCFSAssignee = {
  user_id:           string
  name:              string
  is_suggestion:     boolean
  is_sub_installer:  boolean
  suggested_by_name: string | null
}

export type FCFSJob = {
  id:            string
  project_title: string | null
  client:        string
  location:      string
  date:          string
  time_start:    string | null
  time_end:      string | null
  punctuality:   Punctuality
  created_at:    string
  /** 1-based within the day, by when the job LANDED ON THE SCHEDULE
      (scheduled_at, stamped by migration 0038's trigger) — sales can't see
      each other's pending jobs, so creation order would be opaque to them. */
  fcfs_rank:     number
  assignees:     FCFSAssignee[]
}

type FCFSRow = {
  id:            string
  project_title: string | null
  client:        string
  location:      string
  date:          string
  time_start:    string | null
  time_end:      string | null
  punctuality:   Punctuality
  created_at:    string
  job_assignees: Array<{
    user_id:          string
    is_suggestion:    boolean
    is_sub_installer: boolean
    suggested_by:     string | null
    users:            { id: string; name: string } | null
  }>
}

// Unlike the schedule queries this keeps suggestions — the board shows them
// as amber unconfirmed bars. suggested_by has no FK (dropped in migration
// 0035 to fix PGRST201), so suggester names come from a follow-up query.
export async function getFCFSDay(date: string): Promise<FCFSJob[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, project_title, client, location, date, time_start, time_end,
      punctuality, created_at,
      job_assignees ( user_id, is_suggestion, is_sub_installer, suggested_by,
        users ( id, name ) )
    `)
    .eq('status', 'scheduled')
    .eq('date', date)
    // created_at is the tie-break / fallback until 0038 is applied.
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error

  const rows = (data ?? []) as unknown as FCFSRow[]

  const suggesterIds = [...new Set(
    rows.flatMap(r => r.job_assignees)
        .map(a => a.suggested_by)
        .filter((id): id is string => !!id)
  )]

  const suggesterNames = new Map<string, string>()
  if (suggesterIds.length > 0) {
    const { data: suggesters } = await supabase
      .from('users')
      .select('id, name')
      .in('id', suggesterIds)
    for (const u of (suggesters ?? []) as Array<{ id: string; name: string }>) {
      suggesterNames.set(u.id, u.name)
    }
  }

  return rows.map((row, idx) => ({
    id:            row.id,
    project_title: row.project_title,
    client:        row.client,
    location:      row.location,
    date:          row.date,
    time_start:    row.time_start,
    time_end:      row.time_end,
    punctuality:   row.punctuality,
    created_at:    row.created_at,
    fcfs_rank:     idx + 1,
    assignees:     row.job_assignees
      .filter(a => a.users)
      .map(a => ({
        user_id:           a.user_id,
        name:              a.users!.name,
        is_suggestion:     a.is_suggestion,
        is_sub_installer:  a.is_sub_installer,
        suggested_by_name: a.suggested_by ? suggesterNames.get(a.suggested_by) ?? null : null,
      })),
  }))
}
