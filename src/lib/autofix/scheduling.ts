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

export type FireFailure = { ok: false; reason: string; broken: boolean }

/**
 * Not firing because there's nothing new, or the daily cap, is normal and
 * silent. Failing to START (token revoked, task paused, cloud unreachable) is
 * not: without this message Nic would just see quiet nights forever.
 */
export function fireFailureNotice(f: FireFailure): string | null {
  if (!f.broken) return null
  return `The overnight fixer couldn't start: ${f.reason}. Nothing was sorted. A session with Claude can check its setup.`
}

export function isStale(run: { fired_at: string; finished_at: string | null }, nowIso: string): boolean {
  if (run.finished_at) return false
  return new Date(nowIso).getTime() - new Date(run.fired_at).getTime() > RUN_STALE_MINUTES * 60_000
}

/**
 * Open tabs refresh themselves within about 3 minutes of a deploy (the
 * auto-refresh watcher), so a crash more than this long after a fix went live
 * came from a copy of the app that already had the fix.
 */
export const REOPEN_GRACE_MINUTES = 10

/**
 * A new crash whose signature matches an item the fixer already has.
 * - noise / known / junk: attach and resolve without waking the cloud
 * - closed as already fixed, yet crashing again: it wasn't fixed → reopen
 * - a live fix, crashing on the fixed build, or more than the grace period
 *   after it went live (on ANY build — build ids are hashes, a different one
 *   may well be newer): the fix didn't hold → reopen
 * - a live fix, crash before or just after it went live: an old tab → resolve
 * - anything still in hand (awaiting Nic, needs a session, dropped…): attach
 */
export function crashFollowUp(
  item:  { verdict: string | null; status: string; live_build_id: string | null; live_at: string | null },
  crash: { build_id: string | null; occurred_at: string },
): 'attach-resolve' | 'attach' | 'reopen' {
  if (item.verdict === 'noise' || item.verdict === 'known' || item.verdict === 'junk') return 'attach-resolve'
  if (item.verdict === 'already_fixed') return 'reopen'
  if (item.status === 'live') {
    if (crash.build_id && item.live_build_id && crash.build_id === item.live_build_id) return 'reopen'
    if (!item.live_at) return 'attach-resolve'
    const after = new Date(crash.occurred_at).getTime() - new Date(item.live_at).getTime()
    return after > REOPEN_GRACE_MINUTES * 60_000 ? 'reopen' : 'attach-resolve'
  }
  return 'attach'
}
