// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[m - 1]} ${y}`
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function pocLines(name: string | null, phone: string | null): string {
  return `POC: ${name ?? '(NIL)'}\nContact: ${phone ?? '(NIL)'}`
}

function dateLine(date: string, timeStart: string | null, timeEnd: string | null): string {
  return timeStart && timeEnd
    ? `${formatDate(date)}, ${formatTime(timeStart)} – ${formatTime(timeEnd)}`
    : formatDate(date)
}

// ─── Job notifications ────────────────────────────────────────────────────────

export function tplNewJobCreated(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  location:     string
  salesName:    string
  jobUrl:       string
}): string {
  return (
    `📋 <b>New Job — Assign Installer</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `📍 ${p.location}\n` +
    `Created by: ${p.salesName}\n\n` +
    `<a href="${p.jobUrl}">View & assign installer →</a>`
  )
}

export function tplJobAssigned(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  location:     string
  jobUrl:       string
}): string {
  return (
    `📅 <b>Job Assigned</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `📍 ${p.location}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// Sent to a newly-confirmed SUB-installer — a helper, not the main crew.
// Wording per Nic (Phase 4 smoke test): make clear they support the main team.
export function tplSubInstallerAssigned(p: {
  projectTitle:   string | null
  jobClient:      string
  pocName:        string | null
  pocPhone:       string | null
  jobDate:        string
  timeStart:      string | null
  timeEnd:        string | null
  location:       string
  mainInstallers: string[]
  jobUrl:         string
}): string {
  return (
    `🤝 <b>Job Assigned — Supporting Role</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `📍 ${p.location}\n` +
    (p.mainInstallers.length > 0 ? `Main team: ${p.mainInstallers.join(', ')}\n` : '') +
    `\nYou are assigned to <b>help the main team</b> — please check in with them once on site.\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// Sent to the sales POC + coordinators when a coordinator/scheduler formally
// assigns the installer(s) they had been suggested.
export function tplInstallerAssigned(p: {
  projectTitle:   string | null
  jobClient:      string
  jobDate:        string
  timeStart:      string | null
  timeEnd:        string | null
  location:       string
  installerNames: string[]
  jobUrl:         string
}): string {
  const names = p.installerNames.length > 0 ? p.installerNames.join(', ') : '(none)'
  return (
    `✅ <b>Installer Assigned</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `📍 ${p.location}\n` +
    `Assigned to: ${names}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// Sent to schedulers when sales hits "Notify Scheduler" on a clash they can't
// (or won't) resolve. The job is left PENDING for the scheduler to sort out.
export function tplClashNeedsReview(p: {
  projectTitle: string | null
  jobClient:    string
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  location:     string
  clashNames:   string[]
  salesName:    string
  jobUrl:       string
}): string {
  const names = p.clashNames.length > 0 ? p.clashNames.join(', ') : '(unspecified)'
  return (
    `⚠️ <b>Clash — Needs Scheduler Review</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `Date: ${dateLine(p.jobDate, p.timeStart, p.timeEnd)}\n` +
    `📍 ${p.location}\n` +
    `Double-booked: ${names}\n` +
    `Raised by: ${p.salesName}\n` +
    `Still pending — please review &amp; assign.\n\n` +
    `<a href="${p.jobUrl}">Review job →</a>`
  )
}

export function tplJobOverdue(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  timeEnd:      string
  location:     string
  jobUrl:       string
}): string {
  return (
    `⏰ <b>Job Overdue</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${formatDate(p.jobDate)}\n` +
    `Scheduled until: ${p.timeEnd}\n` +
    `📍 ${p.location}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobMessage(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  authorName:   string
  sentAt:       string
  preview:      string
  jobUrl:       string
}): string {
  return (
    `💬 <b>New Message</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${formatDate(p.jobDate)}\n` +
    `From: ${p.authorName}\n` +
    `Sent at: ${p.sentAt}\n` +
    `<i>"${p.preview}"</i>\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobVoiceNote(p: {
  projectTitle: string | null
  jobClient:    string
  pocName:      string | null
  pocPhone:     string | null
  jobDate:      string
  authorName:   string
  sentAt:       string
  jobUrl:       string
}): string {
  return (
    `🎤 <b>Voice Note</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    `${pocLines(p.pocName, p.pocPhone)}\n` +
    `Date: ${formatDate(p.jobDate)}\n` +
    `From: ${p.authorName}\n` +
    `Sent at: ${p.sentAt}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

export function tplJobChatBatch(p: {
  count:        number
  projectTitle: string | null
  jobClient:    string
  jobDate:      string
  timeStart:    string | null
  timeEnd:      string | null
  location:     string
}): string {
  const timeLine = p.timeStart && p.timeEnd
    ? `Time: ${formatTime(p.timeStart)} – ${formatTime(p.timeEnd)}\n`
    : ''
  return (
    `💬 You have <b>${p.count} New Message${p.count !== 1 ? 's' : ''}</b>\n` +
    (p.projectTitle ? `<b>${p.projectTitle}</b>\n` : '') +
    `Client: ${p.jobClient}\n` +
    timeLine +
    `📍 ${p.location}\n` +
    `Date: ${formatDate(p.jobDate)}`
  )
}

// ─── Bug report ───────────────────────────────────────────────────────────────

export function tplBugReport(p: {
  priority:       string
  sgtTime:        string
  platform:       string
  os:             string
  userEmail:      string
  userRole:       string
  route:          string
  message:        string
  screenshotUrl?: string
}): string {
  const emoji = p.priority === 'urgent' ? '🚨' : p.priority === 'high' ? '🔴' : p.priority === 'medium' ? '🟡' : '🟢'
  const screenshotLine = p.screenshotUrl ? `\n<a href="${p.screenshotUrl}">View screenshot →</a>` : ''
  return (
    `${emoji} <b>Bug Report</b> — ${p.priority.toUpperCase()}\n` +
    `——————————————————\n` +
    `Reported by: ${p.userEmail} (${p.userRole})\n` +
    `Time: ${p.sgtTime}\n` +
    `Page: ${p.route}\n` +
    `Platform: ${p.platform} · ${p.os}\n` +
    `——————————————————\n` +
    `<i>"${p.message}"</i>` +
    screenshotLine
  )
}

// ─── Monday digest ────────────────────────────────────────────────────────────

export function tplDigestHeader(p: {
  weekOf: string
  count:  number
}): string {
  return (
    `📊 <b>Monday Digest — week of ${p.weekOf}</b>\n` +
    `——————————————————\n` +
    `${p.count} important conversation${p.count !== 1 ? 's' : ''} from last week.\n` +
    `Review each below and vote to promote to the knowledge base.`
  )
}

export function tplDigestItem(p: {
  index:      number
  topic:      string
  date:       string
  importance: number
  summary:    string
}): string {
  const stars = '★'.repeat(p.importance) + '☆'.repeat(5 - p.importance)
  return (
    `<b>${p.index}. ${p.topic}</b>\n` +
    `${stars}\n` +
    `<i>${p.date}</i>\n` +
    `——————————————————\n` +
    `${p.summary}\n` +
    `——————————————————\n` +
    `Promote this to the knowledge base?`
  )
}

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
  const stars = '★'.repeat(p.importance) + '☆'.repeat(5 - p.importance)
  const header = (
    `<b>${p.index}. ${p.topic}</b>\n` +
    `${stars}\n` +
    `<i>${p.date}</i>\n` +
    `——————————————————\n` +
    `${p.summary}\n` +
    `——————————————————\n`
  )
  const pending = Math.max(0, p.totalVoters - p.yesCount - p.noCount)
  const pollLine = `📊 ${p.yesCount} Yes · ${p.noCount} No · ${pending} Pending`
  if (p.outcome === 'promoted') return header + pollLine + `\nInformation Promoted to Vault!`
  if (p.outcome === 'dismissed') return header + pollLine + `\nInformation Dismissed!`
  return header + pollLine
}

export function tplVoteStatusTimeout(p: {
  topic:       string
  date:        string
  importance:  number
  yesCount:    number
  noCount:     number
  totalVoters: number
  outcome:     'promoted' | 'dismissed'
}): string {
  const stars = '★'.repeat(p.importance) + '☆'.repeat(5 - p.importance)
  const pending = Math.max(0, p.totalVoters - p.yesCount - p.noCount)
  const pollLine = `📊 ${p.yesCount} Yes · ${p.noCount} No · ${pending} Pending`
  const resultLine = p.outcome === 'promoted' ? `Information Promoted to Vault!` : `Information Dismissed!`
  return (
    `<b>${p.topic}</b>\n` +
    `${stars}\n` +
    `<i>${p.date}</i>\n` +
    `——————————————————\n` +
    `Majority Vote Shows (Time Out):\n` +
    pollLine + `\n` +
    resultLine
  )
}
