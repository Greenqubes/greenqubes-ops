import { createServiceClient } from '@/lib/supabase/service'
import { crewOf, EMPTY_CREW, type Crew, type CrewSource } from '@/lib/utils/installer-crew'

/**
 * Crew names for the installer's screens (Team box, All Jobs) — Nic,
 * 2026-11-10.
 *
 * Installers may read only their OWN crew row (migration 0037) and no outside
 * contractor at all (0039/0040; `external_contacts` holds each contractor's
 * private link token). Those rules stay as they are. This reads the rows with
 * the service key instead, for job ids the CALLER has already decided the
 * installer may see, and hands back names only — never phone numbers, tokens
 * or suggestion rows.
 *
 * Server-only: the service key bypasses every privacy rule.
 */
export async function getCrewForJobs(jobIds: string[], viewerId: string | null): Promise<Map<string, Crew>> {
  const out = new Map<string, Crew>()
  const ids = [...new Set(jobIds)]
  if (ids.length === 0) return out

  const db = createServiceClient()
  const [assignees, externals] = await Promise.all([
    db.from('job_assignees')
      .select('job_id, is_suggestion, is_sub_installer, users ( id, name )')
      .in('job_id', ids)
      .eq('is_suggestion', false),
    db.from('job_external_contacts')
      .select('job_id, is_suggestion, external_contacts ( name )')
      .in('job_id', ids)
      .eq('is_suggestion', false),
  ])
  if (assignees.error) throw assignees.error
  if (externals.error) throw externals.error

  type A = CrewSource['job_assignees'][number] & { job_id: string }
  type E = CrewSource['job_external_contacts'][number] & { job_id: string }
  const byJob = new Map<string, CrewSource>(ids.map(id => [id, { job_assignees: [], job_external_contacts: [] }]))
  for (const a of (assignees.data ?? []) as unknown as A[]) byJob.get(a.job_id)?.job_assignees.push(a)
  for (const e of (externals.data ?? []) as unknown as E[]) byJob.get(e.job_id)?.job_external_contacts.push(e)

  for (const id of ids) {
    const src = byJob.get(id)!
    out.set(id, src.job_assignees.length || src.job_external_contacts.length ? crewOf(src, viewerId) : EMPTY_CREW)
  }
  return out
}
