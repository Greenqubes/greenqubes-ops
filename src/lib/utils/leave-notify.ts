import type { LeaveRecord } from './leave-overlap'

// Placeholder — the real implementation lands in the next commit (bell to
// schedulers on every entry, bell + Telegram escalation when the leave hits a
// job the person is already assigned to). Kept as a separate module from the
// start so the routes never have to change again.
export async function notifyLeave(_leave: LeaveRecord): Promise<void> {
  void _leave
}
