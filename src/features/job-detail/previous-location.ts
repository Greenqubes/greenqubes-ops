/**
 * Carries the source job's address from a Duplicate to the copy's form.
 *
 * Duplicate leaves the copy's Location blank (Nic, 2026-09-15 — a bulk order
 * means the inherited address is wrong every time, and an unedited copy looks
 * finished). The old address is not thrown away: it is stashed here for the
 * new job's id and offered under the empty box as a one-tap fill, so the
 * same-site duplicate still costs nobody any typing.
 *
 * sessionStorage, not the URL: the address is long, and this is a per-tab
 * convenience that must never outlive the tab or reach another device. Every
 * accessor is guarded — private windows and blocked site data both throw.
 */

const key = (jobId: string) => `dup-prev-location:${jobId}`

export function rememberPreviousLocation(jobId: string, location: string): void {
  if (!location.trim()) return
  try { sessionStorage.setItem(key(jobId), location) } catch { /* not worth failing a duplicate over */ }
}

export function readPreviousLocation(jobId: string): string | null {
  try { return sessionStorage.getItem(key(jobId)) } catch { return null }
}

export function forgetPreviousLocation(jobId: string): void {
  try { sessionStorage.removeItem(key(jobId)) } catch { /* nothing to clean up */ }
}
