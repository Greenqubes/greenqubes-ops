/**
 * What to do when the server is running a newer build than this tab.
 *
 * Pure decision, no React and no browser: the watcher gathers the facts, this
 * decides. Nic, 2026-09-10 — "it's stupid I have to yell at the whole company
 * to refresh every time", so the app refreshes itself unless someone would
 * lose work.
 */

export type VersionAction =
  /** Same build, or we cannot tell — do nothing. */
  | 'none'
  /** Refresh now. Silent when the tab is in the background. */
  | 'reload'
  /** Unsaved work — show the bar and let the person choose the moment. */
  | 'banner'
  /** New build, but they are mid-tap. Ask again in a few seconds. */
  | 'wait'

/** A person is "still" after this long without a tap or keystroke. */
export const IDLE_SECONDS = 10

// A build with no stamp (local dev, or a build where the stamp went missing)
// must never reload: it would never match the server and every tab would
// refresh forever.
const NO_STAMP = ['', 'dev', 'unknown']

export function versionAction(input: {
  /** The build this tab is running — baked in at build time. */
  current:        string
  /** What the server reports right now; null when the check failed. */
  latest:         string | null
  hasUnsavedWork: boolean
  /** Is the tab the one being looked at? */
  visible:        boolean
  idleSeconds:    number
}): VersionAction {
  const { current, latest, hasUnsavedWork, visible, idleSeconds } = input

  if (NO_STAMP.includes(current)) return 'none'
  if (!latest || NO_STAMP.includes(latest)) return 'none'
  if (latest === current) return 'none'

  // Half-typed job, upload in flight — never take it away from them.
  if (hasUnsavedWork) return 'banner'

  // A background tab can be refreshed with nobody the wiser.
  if (!visible) return 'reload'

  return idleSeconds >= IDLE_SECONDS ? 'reload' : 'wait'
}
