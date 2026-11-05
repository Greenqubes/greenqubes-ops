// The fixer's verdict for rows on the Admin Bug and Crashes tabs.
//
// Fail-soft by design: before migration 0069 is applied (or if the read fails
// for any reason) the tabs simply show no verdicts — they must never break.

import { createServiceClient } from '@/lib/supabase/service'

export type VerdictInfo = { no: number; verdict: string | null; reason: string | null; status: string }

type Row = VerdictInfo & { id: string; bug_report_id: string | null }

async function read(column: 'id' | 'bug_report_id', ids: string[]): Promise<Row[]> {
  if (ids.length === 0) return []
  try {
    const db = createServiceClient()
    const { data, error } = await db
      .from('autofix_items' as never)
      .select('id, no, verdict, reason, status, bug_report_id')
      .in(column, ids)
    if (error) return []
    return (data ?? []) as unknown as Row[]
  } catch {
    return []
  }
}

/** Keyed by bug report id. */
export async function verdictsForBugs(bugIds: string[]): Promise<Map<string, VerdictInfo>> {
  const rows = await read('bug_report_id', bugIds)
  return new Map(rows.filter(r => r.bug_report_id).map(r => [r.bug_report_id as string, r]))
}

/** Keyed by autofix item id (crash_logs.autofix_item_id). */
export async function verdictsForItems(itemIds: string[]): Promise<Map<string, VerdictInfo>> {
  const rows = await read('id', itemIds)
  return new Map(rows.map(r => [r.id, r]))
}

/** A short plain-English chip label for a verdict. */
export function verdictLabel(v: VerdictInfo): string {
  if (v.status === 'awaiting_nic')  return `Fix ${v.no} ready to try`
  if (v.status === 'going_live')    return `Fix ${v.no} going live`
  if (v.status === 'live')          return `Fixed (fix ${v.no})`
  if (v.status === 'needs_session') return 'Needs a session'
  if (v.status === 'retry')         return `Being redone (fix ${v.no})`
  if (v.status === 'dropped')       return 'Dropped'
  switch (v.verdict) {
    case 'wish':          return 'Wish'
    case 'junk':          return 'Junk'
    case 'noise':         return 'Noise'
    case 'known':         return 'Known issue'
    case 'already_fixed': return 'Already fixed'
    default:              return 'Sorted'
  }
}
