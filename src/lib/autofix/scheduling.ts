// When the cloud fixer may be woken, and what a repeat crash means.
//
// The fixer runs on Nic's Claude plan — the same allowance as his sessions —
// so it wakes only when there is real work, at most a few times a day, and
// one run at a time.

export const MAX_FIXES_PER_RUN       = 3
export const MAX_FIRES_PER_DAY       = 5  // per Singapore day, nightly + retries together
export const RUN_STALE_MINUTES       = 90
export const GO_LIVE_TIMEOUT_MINUTES = 20

export function canFire(x: { pendingWork: number; firesToday: number; runInFlight: boolean }): { fire: boolean; why: string } {
  if (x.pendingWork <= 0)                return { fire: false, why: 'nothing new to look at' }
  if (x.runInFlight)                     return { fire: false, why: 'a run is already going' }
  if (x.firesToday >= MAX_FIRES_PER_DAY) return { fire: false, why: `already ran ${MAX_FIRES_PER_DAY} times today` }
  return { fire: true, why: 'ok' }
}

export function isStale(run: { fired_at: string; finished_at: string | null }, nowIso: string): boolean {
  if (run.finished_at) return false
  return new Date(nowIso).getTime() - new Date(run.fired_at).getTime() > RUN_STALE_MINUTES * 60_000
}

/**
 * A new crash whose signature matches an item the fixer already has.
 * - noise / known / junk: attach and resolve without waking the cloud
 * - a live fix, crashing again ON the fixed build: the fix did not work → reopen
 * - a live fix, crash from an older build (a tab not yet refreshed): resolve
 * - anything still in hand (awaiting Nic, needs a session, dropped…): attach
 */
export function crashFollowUp(
  item: { verdict: string | null; status: string; live_build_id: string | null },
  crashBuildId: string | null,
): 'attach-resolve' | 'attach' | 'reopen' {
  if (item.verdict === 'noise' || item.verdict === 'known' || item.verdict === 'junk') return 'attach-resolve'
  if (item.status === 'live') {
    return crashBuildId && item.live_build_id && crashBuildId === item.live_build_id ? 'reopen' : 'attach-resolve'
  }
  return 'attach'
}
