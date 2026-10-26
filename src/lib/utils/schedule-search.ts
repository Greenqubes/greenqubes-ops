/**
 * The schedule page's search, across ALL dates (Nic, 2026-10-26: "if im on
 * todays date and i want to search a job on another date, it returns empty").
 * The old box only filtered the day on screen, so a job had to be found by
 * already knowing its date — and it never searched the title at all.
 *
 * Same rule as the My Jobs panel (matchesWords): every word typed must appear
 * somewhere, any order, any case, part-words count. Fields: title, company,
 * client name, location, and the crew on the job. Descriptions are left out on
 * purpose — they pulled in too many loose matches.
 */
import { matchesWords, searchWords } from './my-jobs-search'

export type ScheduleSearchJob = {
  date: string; date_end: string | null; time_start: string | null
  project_title: string | null; client: string; client_poc_name?: string | null; location: string
  job_assignees: Array<{ users: { name: string } | null }>
  job_external_contacts?: Array<{ is_suggestion: boolean; external_contacts: { name: string } | null }>
}
export type SearchDay<T> = { date: string; past: boolean; jobs: T[] }

export function matchesScheduleSearch(job: ScheduleSearchJob, query: string): boolean {
  return matchesWords([
    job.project_title, job.client, job.client_poc_name, job.location,
    ...job.job_assignees.map(a => a.users?.name),
    // A suggested contractor is not on the job yet.
    ...(job.job_external_contacts ?? []).filter(e => !e.is_suggestion).map(e => e.external_contacts?.name),
  ], query)
}

const byStart = (a: { time_start: string | null }, b: { time_start: string | null }) => {
  if (a.time_start && b.time_start) return a.time_start.localeCompare(b.time_start)
  return a.time_start ? -1 : b.time_start ? 1 : 0
}

/**
 * Every match, grouped under its START date (a multi-day job shows once).
 * 'upcoming' (the schedule): today onwards soonest first, then anything still
 * on the schedule that has finished, most recent first and marked past. A job
 * that started earlier but is still running is not past. 'newest' (the
 * Completed tab): newest first, nothing marked. An empty search gives [] —
 * the page shows its normal view.
 */
export function scheduleSearchResults<T extends ScheduleSearchJob>(
  jobs: T[], query: string, today: string, order: 'upcoming' | 'newest',
): SearchDay<T>[] {
  if (searchWords(query).length === 0) return []
  const days = new Map<string, SearchDay<T>>()
  for (const job of jobs) {
    if (!matchesScheduleSearch(job, query)) continue
    const past = order === 'upcoming' && (job.date_end ?? job.date) < today
    const day = days.get(job.date) ?? { date: job.date, past, jobs: [] }
    day.past = day.past && past
    day.jobs.push(job)
    days.set(job.date, day)
  }
  const list = [...days.values()]
  for (const d of list) d.jobs.sort(byStart)
  return list.sort((a, b) =>
    order === 'newest'      ? b.date.localeCompare(a.date) :
    a.past !== b.past       ? (a.past ? 1 : -1) :
    a.past                  ? b.date.localeCompare(a.date) :
                              a.date.localeCompare(b.date))
}

/** Splits text into plain and highlighted pieces for the searched words —
 *  every occurrence, overlaps merged, original capitals kept. */
export function highlightParts(text: string, query: string): Array<{ text: string; hit: boolean }> {
  const wanted = searchWords(query)
  const lower = text.toLowerCase()
  const marks: Array<[number, number]> = []
  for (const w of wanted) {
    for (let i = lower.indexOf(w); i !== -1; i = lower.indexOf(w, i + 1)) marks.push([i, i + w.length])
  }
  if (marks.length === 0) return [{ text, hit: false }]
  marks.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const [s, e] of marks) {
    const last = merged[merged.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else merged.push([s, e])
  }
  const parts: Array<{ text: string; hit: boolean }> = []
  let at = 0
  for (const [s, e] of merged) {
    if (s > at) parts.push({ text: text.slice(at, s), hit: false })
    parts.push({ text: text.slice(s, e), hit: true })
    at = e
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false })
  return parts
}
