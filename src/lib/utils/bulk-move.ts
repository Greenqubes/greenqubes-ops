import type { StageView } from '@/features/stages/stage-view'
import type { Role } from '@/lib/supabase/types'
import type { Translations } from '@/lib/i18n/en'

/**
 * Moving several jobs back one stage at once from the Jobs tab (Nic,
 * 2026-11-11; spec 2026-11-11-gallery-groups-bulk-sheet-design.md Part 1):
 * To arrange → Ongoing and Ongoing → Drafts. Every job still goes through the
 * one-at-a-time rules on the server; this file only decides which buttons a
 * list offers, turns each failure into a reason a person can read, and words
 * the ONE bell card a batch sends schedulers.
 */

export type BulkFailReason = 'designer_on_job' | 'not_yours' | 'changed' | 'no_connection' | 'other'
export type BulkOutcome = { id: string; ok: boolean; reason?: BulkFailReason }

/** The most jobs one bulk request may carry. */
export const BULK_MAX = 200

export const BULK_REASON_KEY: Record<BulkFailReason, keyof Translations> = {
  designer_on_job: 'bulkWhyDesigner',
  not_yours:       'bulkWhyNotYours',
  changed:         'bulkWhyChanged',
  no_connection:   'bulkWhyOffline',
  other:           'bulkWhyOther',
}

// Codes the stage and arrange routes answer with when the job moved or
// changed under a stale screen.
const CHANGED = new Set(['state_changed', 'invalid_move', 'not_ongoing'])

/** status 0 = the request never reached the server. */
export function bulkFailReason(status: number, error: string | undefined): BulkFailReason {
  if (error === 'designers_assigned') return 'designer_on_job'
  if (status === 403 || error === 'not_permitted') return 'not_yours'
  if (status === 404 || (error !== undefined && CHANGED.has(error))) return 'changed'
  if (status === 0) return 'no_connection'
  return 'other'
}

export function splitBulk(outcomes: BulkOutcome[]): { moved: string[]; failed: Array<{ id: string; reason: BulkFailReason }> } {
  const moved: string[] = []
  const failed: Array<{ id: string; reason: BulkFailReason }> = []
  for (const o of outcomes) {
    if (o.ok) moved.push(o.id)
    else failed.push({ id: o.id, reason: o.reason ?? 'other' })
  }
  return { moved, failed }
}

/** Which bulk buttons a list offers. `role` is the EFFECTIVE role (a plain
 *  admin reads 'scheduler'), so admin is passed separately. Pull back is a
 *  sales-side action (canArrange); moving into Drafts is open to sharers and
 *  schedulers (canMoveStage narrows schedulers to their own jobs per job). */
export function bulkActionsFor(view: StageView, role: Role, isAdmin: boolean): { toOngoing: boolean; toDraft: boolean } {
  return {
    toOngoing: view === 'arrange' && (isAdmin || role === 'sales' || role === 'coordinator'),
    toDraft:   view === 'ongoing' && (isAdmin || role === 'sales' || role === 'coordinator' || role === 'scheduler'),
  }
}

/** One bell card per batch. A batch of one reads exactly like the single
 *  pull back in src/lib/arrange/actions.ts. */
export function batchBellText(titles: string[], salesName: string): { title: string; body: string } {
  const tail = `Not ready yet — ${salesName}`
  if (titles.length === 1) return { title: `Back to Ongoing: ${titles[0]}`, body: tail }
  return {
    title: `Back to Ongoing: ${titles.length} jobs`,
    body:  `${titles[0]} and ${titles.length - 1} more · ${tail}`,
  }
}

/** Ticks and reasons only ever count jobs still on the list. After a bulk
 *  move's refresh, a job someone else moved meanwhile has left the list; kept
 *  ticked, it would stay counted out of sight and the bar's Delete would bin
 *  a job the person can no longer see (final review #1, 2026-11-11 — the same
 *  hole the 2026-10-19 review closed for list switches). */
export function keepOnList<R>(
  selected: Set<string>, reasons: Map<string, R>, onList: Iterable<string>,
): { selected: Set<string>; reasons: Map<string, R>; changed: boolean } {
  const here = new Set(onList)
  const keptSel = new Set([...selected].filter(id => here.has(id)))
  const keptWhy = new Map([...reasons].filter(([id]) => here.has(id)))
  return { selected: keptSel, reasons: keptWhy, changed: keptSel.size !== selected.size || keptWhy.size !== reasons.size }
}

/** The bulk route's body: { jobs: [{ id, seen }] }. null when unusable.
 *  Duplicate ids collapse (first wins). A missing `seen` is kept as
 *  undefined — the per-job check then refuses it as a stale screen. */
export function parseBulkBody(raw: unknown): Array<{ id: string; seen: unknown }> | null {
  if (!raw || typeof raw !== 'object') return null
  const jobs = (raw as Record<string, unknown>).jobs
  if (!Array.isArray(jobs) || jobs.length === 0 || jobs.length > BULK_MAX) return null
  const out: Array<{ id: string; seen: unknown }> = []
  const seenIds = new Set<string>()
  for (const j of jobs) {
    if (!j || typeof j !== 'object') return null
    const { id, seen } = j as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0) return null
    if (seenIds.has(id)) continue
    seenIds.add(id)
    out.push({ id, seen })
  }
  return out
}
