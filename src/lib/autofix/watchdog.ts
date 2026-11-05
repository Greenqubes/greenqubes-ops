// A fixer run that hasn't reported back after RUN_STALE_MINUTES gets ONE
// heads-up to Nic. It is deliberately NOT finished: the first night (a 29-item
// backlog) or three careful fixes can honestly take longer, and finishing the
// run here would make its report bounce and throw the night's work away
// (final review, 2026-11-04). A run that truly died just never reports.

import type { RunRow } from './store'
import { escapeHtml } from './nightly-message'

export type WatchdogDeps = {
  stale(): Promise<RunRow[]>
  markAlerted(id: string): Promise<void>
  tell(text: string): Promise<unknown>
}

export async function alertStaleRuns(d: WatchdogDeps): Promise<number> {
  const runs = await d.stale()
  for (const r of runs) {
    await d.markAlerted(r.id)
    await d.tell(
      "The fixer's run is still going after 90 minutes — longer than usual. If it finishes, you'll get its message as normal." +
      (r.session_url ? `\nIts log: ${escapeHtml(r.session_url)}` : ''),
    )
  }
  return runs.length
}
