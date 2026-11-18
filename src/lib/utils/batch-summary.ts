// What to tell someone after a batch of files — sent to job chat or
// downloaded from the gallery (Nic, 2026-11-18). A failed file never stops
// the rest, so a partial batch names exactly what did not go. Pure; tested in
// batch-summary.test.ts.

export type BatchFailure = { name: string; reason: string }

export type BatchSummary =
  | { kind: 'all' }
  | { kind: 'some'; sent: number; total: number; names: string }
  | { kind: 'none'; reason: string }

export function batchSummary(total: number, failed: BatchFailure[]): BatchSummary {
  if (failed.length === 0) return { kind: 'all' }
  if (failed.length < total) {
    return { kind: 'some', sent: total - failed.length, total, names: failed.map(f => f.name).join(', ') }
  }
  return { kind: 'none', reason: failed.find(f => f.reason)?.reason ?? '' }
}
