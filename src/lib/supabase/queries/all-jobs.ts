import { createServiceClient } from '@/lib/supabase/service'
import { getCrewForJobs } from '@/lib/supabase/queries/crew-names'
import { EMPTY_CREW } from '@/lib/utils/installer-crew'
import { jobCoversDay, sortAllJobs, toAllJobsCard, type AllJobsCard, type AllJobsRow } from '@/lib/utils/all-jobs'

/**
 * Installer All Jobs (Nic, 2026-11-10): every CONFIRMED job covering a day.
 *
 * Installers' privacy rules block other people's jobs, and that stays true
 * everywhere else. This page alone reads with the service key, on the server,
 * after the page has checked the caller is an installer — and it reads only
 * the columns below. No description, money, client phone, files, chat, sales
 * or coordinator ever leaves here; `client` is read only as the fallback
 * title. Pending (sales-private), awaiting and completed jobs are excluded by
 * `status = 'scheduled'`.
 *
 * `day` MUST come from parseDay() — it is placed into a filter string.
 */
export async function getAllJobsForDay(day: string, viewerId: string): Promise<AllJobsCard[]> {
  const db = createServiceClient()
  const { data, error } = await db.from('jobs')
    .select('id, date, date_end, time_start, time_end, project_title, client, location, punctuality')
    .eq('status', 'scheduled')
    .lte('date', day)
    .or(`date_end.gte.${day},date.eq.${day}`)
  if (error) throw error

  const rows = ((data ?? []) as unknown as AllJobsRow[]).filter(r => jobCoversDay(r, day))
  const crews = await getCrewForJobs(rows.map(r => r.id), viewerId)
  return sortAllJobs(rows.map(r => toAllJobsCard(r, crews.get(r.id) ?? EMPTY_CREW)))
}
