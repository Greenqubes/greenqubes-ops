import { BULK_MAX } from '@/lib/utils/bulk-move'
import type { Role } from '@/lib/supabase/types'

/**
 * Job groups on the Jobs tab (Nic, 2026-11-11; spec 2026-11-11 Part 4).
 * Near-identical jobs — one campaign, many stores — fold into one shared,
 * named row. Everyone sees the same folding; only the Jobs tab changes.
 * Nothing here comes from the cancelled Workflow V3 "project containers"
 * (job_projects, 0051) — a group is a name and nothing else.
 */

export type JobGroup = { id: string; name: string }

export type FoldItem<T> =
  | { kind: 'job'; job: T }
  | { kind: 'group'; group: JobGroup; jobs: T[] }

export const GROUP_NAME_MAX = 120

/** Sales, coordinator, scheduler and admin make, rename, ungroup, add and
 *  remove. Designers, production and hr only see groups. `role` is the
 *  EFFECTIVE role (a plain admin reads 'scheduler'); `isAdmin` the real one. */
export function canChangeGroups(role: Role, isAdmin: boolean): boolean {
  return isAdmin || role === 'sales' || role === 'coordinator' || role === 'scheduler'
}

const SEP = '\\s\\-–:,|/'
const TRAILING_SEP = new RegExp(`[${SEP}]+$`)
const LEADING_SEP = new RegExp(`^[${SEP}]+`)
const IS_SEP = new RegExp(`^[${SEP}]`)

/** The name a new group starts with: the start the ticked titles share, cut
 *  back to the last " - " or to a whole word ("Deliver Oakley & RB A4
 *  Tentcard"). Editable in the dialog; '' when nothing is shared. */
export function suggestGroupName(titles: string[]): string {
  const ts = titles.map(t => t.trim()).filter(Boolean)
  if (ts.length === 0) return ''
  let prefix = ts[0]
  for (const t of ts.slice(1)) {
    let i = 0
    while (i < prefix.length && i < t.length && prefix[i] === t[i]) i++
    prefix = prefix.slice(0, i)
  }
  let name = prefix
  if (ts.some(t => t.length > prefix.length)) {
    const dash = name.lastIndexOf(' - ')
    if (dash >= 0) name = name.slice(0, dash)
    else if (ts.some(t => t.length > prefix.length && !/\s/.test(t[prefix.length]))) {
      const space = name.search(/\s\S*$/)
      name = space >= 0 ? name.slice(0, space) : ''
    }
  }
  return name.replace(TRAILING_SEP, '').slice(0, GROUP_NAME_MAX).replace(TRAILING_SEP, '')
}

/** Inside an open group a job shows only the rest of its title ("Eyechamp
 *  NEX"). A title that doesn't start with the name — or that IS the name —
 *  shows whole. */
export function titleInGroup(title: string, groupName: string): string {
  const name = groupName.trim()
  if (!name || !title.toLowerCase().startsWith(name.toLowerCase())) return title
  const after = title.slice(name.length)
  if (after && !IS_SEP.test(after)) return title   // the name ends mid-word
  const rest = after.replace(LEADING_SEP, '')
  return rest || title
}

/** One section of a list → job rows and group rows. A group sits where its
 *  first job would sit and holds that section's jobs in list order; a job
 *  whose group isn't known shows as a plain row. */
export function foldGroups<T extends { id: string; group_id: string | null }>(
  jobs: T[], groups: Map<string, JobGroup>,
): FoldItem<T>[] {
  const out: FoldItem<T>[] = []
  const byGroup = new Map<string, { kind: 'group'; group: JobGroup; jobs: T[] }>()
  for (const j of jobs) {
    const g = j.group_id ? groups.get(j.group_id) : undefined
    if (!g) { out.push({ kind: 'job', job: j }); continue }
    const seen = byGroup.get(g.id)
    if (seen) { seen.jobs.push(j); continue }
    const item = { kind: 'group' as const, group: g, jobs: [j] }
    byGroup.set(g.id, item)
    out.push(item)
  }
  return out
}

/** The company and sales person on a group row — each only when every job
 *  in it shares it. */
export function groupSummary(jobs: Array<{ client: string; salesName: string | null }>): { client: string | null; salesName: string | null } {
  const same = (vals: Array<string | null>) => vals.length > 0 && vals[0] !== null && vals.every(v => v === vals[0]) ? vals[0] : null
  return { client: same(jobs.map(j => j.client || null)), salesName: same(jobs.map(j => j.salesName)) }
}

/** The search box: a job matches on its title, company or address — or on
 *  its group's name, which brings the whole group. */
export function filterWithGroups<T extends { project_title: string | null; client: string; location: string; group_id: string | null }>(
  jobs: T[], groups: Map<string, JobGroup>, query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return jobs
  return jobs.filter(j => {
    const groupName = j.group_id ? groups.get(j.group_id)?.name ?? '' : ''
    return [j.project_title ?? '', j.client, j.location, groupName].join(' ').toLowerCase().includes(q)
  })
}

/** "Or add them to an existing group": groups with at least one job this
 *  person can see on the tab, by name, with that count. */
export function pickerGroups(jobs: Array<{ group_id: string | null }>, groups: Map<string, JobGroup>): Array<JobGroup & { count: number }> {
  const counts = new Map<string, number>()
  for (const j of jobs) if (j.group_id && groups.has(j.group_id)) counts.set(j.group_id, (counts.get(j.group_id) ?? 0) + 1)
  return [...counts].map(([id, count]) => ({ ...groups.get(id)!, count }))
    .sort((x, y) => x.name.localeCompare(y.name))
}

/** A group row's tick box. */
export function tickState(selected: Set<string>, ids: string[]): 'all' | 'some' | 'none' {
  const n = ids.filter(id => selected.has(id)).length
  return n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
}

/** Ticking a group row ticks every job in it on that list; ticking it again
 *  (all ticked) unticks them. Other ticks are left alone. */
export function tickAll(selected: Set<string>, ids: string[]): Set<string> {
  const next = new Set(selected)
  if (tickState(selected, ids) === 'all') for (const id of ids) next.delete(id)
  else for (const id of ids) next.add(id)
  return next
}

/** Opened from the My Jobs panel (?highlight=<id>): the group holding that
 *  job opens, so the row exists to scroll to and blink. */
export function openOnLoad(highlightId: string | null, jobs: Array<{ id: string; group_id: string | null }>): string | null {
  if (!highlightId) return null
  return jobs.find(j => j.id === highlightId)?.group_id ?? null
}

export type GroupBody =
  | { action: 'create'; name: string; jobIds: string[] }
  | { action: 'add'; groupId: string; jobIds: string[] }
  | { action: 'remove'; jobIds: string[] }
  | { action: 'rename'; groupId: string; name: string }
  | { action: 'ungroup'; groupId: string }

/** The /api/job-groups request, or null when it isn't one. */
export function parseGroupBody(raw: unknown): GroupBody | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = (): string | null => {
    if (typeof r.name !== 'string') return null
    const n = r.name.trim()
    return n.length >= 1 && n.length <= GROUP_NAME_MAX ? n : null
  }
  const id = (v: unknown): string | null => typeof v === 'string' && v.length > 0 ? v : null
  const jobIds = (): string[] | null => {
    if (!Array.isArray(r.jobIds) || r.jobIds.length === 0 || r.jobIds.length > BULK_MAX) return null
    if (!r.jobIds.every(x => typeof x === 'string' && x.length > 0)) return null
    return [...new Set(r.jobIds as string[])]
  }
  switch (r.action) {
    case 'create': { const n = name(), ids = jobIds(); return n && ids ? { action: 'create', name: n, jobIds: ids } : null }
    case 'add': { const g = id(r.groupId), ids = jobIds(); return g && ids ? { action: 'add', groupId: g, jobIds: ids } : null }
    case 'remove': { const ids = jobIds(); return ids ? { action: 'remove', jobIds: ids } : null }
    case 'rename': { const g = id(r.groupId), n = name(); return g && n ? { action: 'rename', groupId: g, name: n } : null }
    case 'ungroup': { const g = id(r.groupId); return g ? { action: 'ungroup', groupId: g } : null }
    default: return null
  }
}
