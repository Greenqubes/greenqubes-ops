/**
 * The My Jobs panel's search box and folded sections (Nic's screenshot,
 * 2026-10-26: "once the list gets long its very hard to find").
 *
 * "Closest wording": every word typed must appear somewhere in the job's
 * title, company, client name or location — any order, any case, part-words
 * count ("rise foss" finds "IMM Fossil Wooden Riser Delivery"). Spelling
 * mistakes are deliberately NOT forgiven: a loose match pulls in wrong jobs.
 */
import type { MyJobsGroups } from './my-jobs'

export type SearchableJob = { project_title: string | null; client: string; client_poc_name?: string | null; location: string }
export type MyJobsGroup = keyof MyJobsGroups<unknown>
const GROUPS: readonly MyJobsGroup[] = ['draft', 'ongoing', 'scheduled']

const words = (query: string) => query.toLowerCase().split(/\s+/).filter(Boolean)

export function matchesJobSearch(job: SearchableJob, query: string): boolean {
  const wanted = words(query)
  if (wanted.length === 0) return true
  const haystack = [job.project_title, job.client, job.client_poc_name, job.location]
    .filter(Boolean).join(' ').toLowerCase()
  return wanted.every(w => haystack.includes(w))
}

/** An empty search hands back the same lists, untouched. */
export function searchMyJobs<T extends SearchableJob>(groups: MyJobsGroups<T>, query: string): MyJobsGroups<T> {
  if (words(query).length === 0) return groups
  const keep = (list: T[]) => list.filter(j => matchesJobSearch(j, query))
  return { draft: keep(groups.draft), ongoing: keep(groups.ongoing), scheduled: keep(groups.scheduled) }
}

/** Which sections this device folded shut. Read from localStorage, so it is
 *  untrusted: anything unreadable means "nothing folded". */
export function parseFolded(raw: string | null): MyJobsGroup[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((g): g is MyJobsGroup => GROUPS.includes(g as MyJobsGroup))
  } catch { return [] }
}

/** While searching, a folded section opens — a match must never sit hidden
 *  inside a closed one. Clearing the search restores the folds. */
export function sectionOpen(folded: boolean, searching: boolean): boolean {
  return searching || !folded
}
