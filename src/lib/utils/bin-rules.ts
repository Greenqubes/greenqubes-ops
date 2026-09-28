/**
 * Rules for the job bin (spec 2026-09-28-job-bin-design.md). Pure, so it can
 * be run standalone by its test.
 *
 * Nic, 2026-09-28: drafts stay private in the bin exactly as they are live;
 * deleted scheduled jobs are visible to every bin role, but only a scheduler,
 * an admin or whoever deleted it can bring one back. Delete forever is admin
 * only. The bin empties itself on a schedule the admin picks.
 */
import { isPendingStatus, type Viewer } from '@/lib/auth/pending-privacy'

export const BIN_ROLES = ['sales', 'coordinator', 'scheduler', 'admin'] as const
export function hasBin(role: string): boolean {
  return (BIN_ROLES as readonly string[]).includes(role)
}

export type RetentionKey = '1m' | '3m' | '6m' | '1y' | '2y'
export const RETENTION_OPTIONS: readonly { key: RetentionKey; months: number; label: string }[] = [
  { key: '1m', months: 1,  label: '1 month'  },
  { key: '3m', months: 3,  label: '3 months' },
  { key: '6m', months: 6,  label: '6 months' },
  { key: '1y', months: 12, label: '1 year'   },
  { key: '2y', months: 24, label: '2 years'  },
]
export const DEFAULT_RETENTION: RetentionKey = '3m'

export function parseRetention(v: unknown): RetentionKey {
  return RETENTION_OPTIONS.some(o => o.key === v) ? (v as RetentionKey) : DEFAULT_RETENTION
}

function monthsOf(key: RetentionKey): number {
  return RETENTION_OPTIONS.find(o => o.key === key)!.months
}

const SGT_MS = 8 * 3_600_000

export function sgtDate(iso: string): string {
  return new Date(new Date(iso).getTime() + SGT_MS).toISOString().slice(0, 10)
}

/** The last day the job can still be restored, in Singapore time. Month
 *  arithmetic clamps to the month's end: 31 Jan + 1 month is 28 Feb. */
export function emptiesOn(deletedAtISO: string, key: RetentionKey): string {
  const [y, m, d] = sgtDate(deletedAtISO).split('-').map(Number)
  const total = (m - 1) + monthsOf(key)
  const ty = y + Math.floor(total / 12), tm = total % 12
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate()
  const td = Math.min(d, lastDay)
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(td).padStart(2, '0')}`
}

export function isExpired(deletedAtISO: string, key: RetentionKey, nowISO: string): boolean {
  return sgtDate(nowISO) > emptiesOn(deletedAtISO, key)
}

/** When the bin-empty cron next runs: daily 20:00 UTC = 04:00 SGT (vercel.json).
 *  The Settings warning counts against THIS, not now — a job on its last
 *  restorable day is not expired at 3pm but is at tonight's run. Keep in step
 *  with the cron's schedule. */
export const BIN_RUN_UTC_HOUR = 20
export function nextBinRunISO(nowISO: string): string {
  const now = new Date(nowISO)
  const run = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), BIN_RUN_UTC_HOUR))
  if (run.getTime() <= now.getTime()) run.setUTCDate(run.getUTCDate() + 1)
  return run.toISOString()
}

export function countExpiringUnder(deletedAts: string[], key: RetentionKey, nowISO: string): number {
  return deletedAts.filter(d => isExpired(d, key, nowISO)).length
}

export type BinAccess = { statusAtDelete: string; deletedBy: string | null; sharerIds: string[] }

export function canSeeBinEntry(v: Viewer, e: BinAccess): boolean {
  if (!hasBin(v.role)) return false
  if (v.role === 'admin') return true
  if (isPendingStatus(e.statusAtDelete)) return e.deletedBy === v.id || e.sharerIds.includes(v.id)
  return true
}

export function canRestoreBinEntry(v: Viewer, e: BinAccess): boolean {
  if (!canSeeBinEntry(v, e)) return false
  if (v.role === 'admin') return true
  if (isPendingStatus(e.statusAtDelete)) return true   // seeing a draft = sharing it or having deleted it
  return v.role === 'scheduler' || e.deletedBy === v.id
}

export function canDeleteForever(v: Viewer): boolean {
  return v.role === 'admin'
}
