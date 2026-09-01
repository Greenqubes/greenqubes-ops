const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

// 3-day nudge (spec): JO uploaded but unticked for 3+ days → ask; answering
// "No" just stamps a reminder, so the next nudge is 3 days later. Never daily.
export function reminderDue(input: {
  joUploadedAtISO:   string | null
  completedAtISO:    string | null
  lastReminderAtISO: string | null
  nowISO:            string
}): boolean {
  if (!input.joUploadedAtISO || input.completedAtISO) return false
  const now = Date.parse(input.nowISO)
  if (now - Date.parse(input.joUploadedAtISO) < THREE_DAYS_MS) return false
  if (input.lastReminderAtISO && now - Date.parse(input.lastReminderAtISO) < THREE_DAYS_MS) return false
  return true
}
