// Sending several files to job chat at once (Nic, 2026-11-18). Pure, so it
// is tested standalone (chat-attachments.test.ts). The after-a-batch message
// is shared with the gallery: batch-summary.ts.

/** Upper bound on the count one batch may claim, so a forged request cannot
 *  make a Telegram say "9999 new messages". */
export const MAX_NOTIFY_COUNT = 50

/** How many files a chat-attachment announcement stands for. The browser
 *  sends it, so it is untrusted: anything that is not a positive number —
 *  including no count at all, from a tab still running the one-file code —
 *  counts as one. */
export function attachmentNotifyCount(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 1
  const n = Math.floor(raw)
  if (n < 1) return 1
  return Math.min(n, MAX_NOTIFY_COUNT)
}
