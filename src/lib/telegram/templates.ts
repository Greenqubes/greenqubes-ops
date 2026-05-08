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

// Sent to the dedicated bug bot when a user submits a bug report.
export function tplBugReport(p: {
  priority:    string
  sgtTime:     string
  platform:    string
  os:          string
  screen:      string
  ip:          string
  userEmail:   string
  userRole:    string
  route:       string
  message:     string
  screenshotUrl?: string
}): string {
  const priorityEmoji = p.priority === 'urgent' ? '🚨' : p.priority === 'high' ? '🔴' : p.priority === 'medium' ? '🟡' : '🟢'
  const screenshotLine = p.screenshotUrl
    ? `\nScreenshot: <a href="${p.screenshotUrl}">View ↗</a>`
    : ''
  return (
    `${priorityEmoji} <b>Bug Report — ${p.priority.toUpperCase()}</b>\n` +
    `Time: ${p.sgtTime}\n` +
    `Platform: ${p.platform}\n` +
    `OS: ${p.os}\n` +
    `Screen: ${p.screen}\n` +
    `IP: ${p.ip}\n` +
    `User: ${p.userEmail} (${p.userRole})\n` +
    `Page: ${p.route}` +
    screenshotLine +
    `\n---\n${p.message}`
  )
}

// Monday digest — header sent once before the individual conversation items.
export function tplDigestHeader(p: {
  weekOf: string
  count:  number
}): string {
  return `📊 <b>Monday Digest — week of ${p.weekOf}</b>\n\n${p.count} important conversation${p.count !== 1 ? 's' : ''} from last week. Tap a link below to promote to Obsidian.`
}

// Monday digest — one message per high-importance conversation (with voting buttons).
export function tplDigestItem(p: {
  index:      number
  topic:      string
  date:       string
  importance: number
  summary:    string
}): string {
  const stars = '★'.repeat(p.importance) + '☆'.repeat(5 - p.importance)
  return `${p.index}. <b>${p.topic}</b> ${stars}\n<i>${p.date}</i>\n\n${p.summary}`
}

// Shown below a digest item after votes are cast (replaces original text).
export function tplVoteStatus(p: {
  index:       number
  topic:       string
  date:        string
  importance:  number
  summary:     string
  yesCount:    number
  noCount:     number
  totalVoters: number
  outcome:     'pending' | 'promoted' | 'dismissed'
}): string {
  const stars   = '★'.repeat(p.importance) + '☆'.repeat(5 - p.importance)
  const header  = `${p.index}. <b>${p.topic}</b> ${stars}\n<i>${p.date}</i>\n\n${p.summary}\n\n`
  const awaiting = p.totalVoters - p.yesCount - p.noCount

  if (p.outcome === 'promoted') {
    return `${header}✅ Promoted by majority — Obsidian note sent to all voters.`
  }
  if (p.outcome === 'dismissed') {
    return `${header}❌ Dismissed by majority — skipped.`
  }
  return `${header}📊 ${p.yesCount} Yes · ${p.noCount} No · ${awaiting} awaiting (${p.totalVoters} voters)`
}
