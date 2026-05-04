// ─────────────────────────────────────────────────────────────────────────────
// Telegram message templates — all copy is PLACEHOLDER.
// Edit the return string in each function to customise the final wording.
// Format: HTML (Telegram supports <b>, <i>, <code>, <a href="...">).
// ─────────────────────────────────────────────────────────────────────────────

// Triggered when any user posts a message in a job's chat thread.
export function tplJobMessage(p: {
  jobClient:  string
  jobDate:    string
  authorName: string
  preview:    string   // first 100 chars of message content
}): string {
  return `💬 [PLACEHOLDER] New message on <b>${p.jobClient}</b> (${p.jobDate})\n\nFrom: ${p.authorName}\n"${p.preview}"`
}

// Triggered when a scheduler approves a job and moves it to scheduled.
export function tplJobApproved(p: {
  jobClient:     string
  jobDate:       string
  schedulerName: string
}): string {
  return `✅ [PLACEHOLDER] <b>${p.jobClient}</b> on ${p.jobDate} has been approved and scheduled by ${p.schedulerName}.`
}

// Triggered when a scheduler sends a job back to sales (with or without note).
export function tplJobSentBack(p: {
  jobClient: string
  jobDate:   string
  note?:     string
}): string {
  const noteStr = p.note ? `\n\nNote: ${p.note}` : ''
  return `↩️ [PLACEHOLDER] <b>${p.jobClient}</b> on ${p.jobDate} has been sent back for revision.${noteStr}`
}

// Triggered by the overdue cron when a scheduled job is past its end time.
export function tplJobOverdue(p: {
  jobClient: string
  jobDate:   string
  timeEnd:   string
  location:  string
}): string {
  return `⏰ [PLACEHOLDER] Overdue: <b>${p.jobClient}</b>\n📍 ${p.location}\nScheduled: ${p.jobDate} until ${p.timeEnd}`
}

// Triggered when a user posts a voice note in a job's chat thread.
export function tplJobVoiceNote(p: {
  jobClient:  string
  jobDate:    string
  authorName: string
}): string {
  return `🎤 [PLACEHOLDER] Voice note on <b>${p.jobClient}</b> (${p.jobDate})\nFrom: ${p.authorName}`
}

// Triggered when a sales user submits a job for scheduler approval.
export function tplJobSubmittedForApproval(p: {
  jobClient: string
  jobDate:   string
  salesName: string
}): string {
  return `📋 [PLACEHOLDER] Approval needed: <b>${p.jobClient}</b> on ${p.jobDate}\nSubmitted by ${p.salesName}`
}
