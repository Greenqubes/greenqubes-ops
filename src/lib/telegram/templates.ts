// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatDate(iso: string): string {
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

// Sent to a newly-added DESIGNER when they're assigned to a job's design work.
// `assignedBy` is the display name (fallback email) of whoever made the
// assignment — any role can assign (R2-T2, Nic smoke-test edit 4).
export function tplDesignAssigned(p: {
  projectTitle: string
  client:       string
  date:         string
  assignedBy:   string
  jobUrl:       string
}): string {
  return (
    `🎨 <b>New Design Job Assigned</b>\n` +
    `<b>Project:</b> ${p.projectTitle}\n` +
    `<b>Client:</b> ${p.client}\n` +
    `<b>Install date:</b> ${formatDate(p.date)}\n` +
    `<b>Assigned by:</b> ${p.assignedBy}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// Sent to each assigned designer when a job's install date change shifts its
// design due date — on EVERY shift, earlier or later (Nic 2026-08-31; was
// earlier-only). This template just renders the move. Client + install date
// added for parity with the upgraded bell card (R2-T2 edit 4).
export function tplDesignDueShift(p: {
  projectTitle: string
  oldDue:       string
  newDue:       string
  client:       string
  installDate:  string
  jobUrl:       string
}): string {
  return (
    `⏰ <b>Design Due Date Moved</b>\n` +
    `<b>Project:</b> ${p.projectTitle}\n` +
    `<b>Client:</b> ${p.client}\n` +
    `<b>Install date:</b> ${formatDate(p.installDate)}\n` +
    `<b>Due date:</b> ${formatDate(p.oldDue)} → ${formatDate(p.newDue)}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// Sent to each assigned designer when a job's install date moves WITHOUT the
// design due date following it — the office kept its typed due date in the
// "Install date moved" prompt, or the job had no due date to shift. Edit 17
// (Nic, 2026-09-01): designers must still hear that the install date moved.
export function tplDesignInstallShift(p: {
  projectTitle:   string
  client:         string
  oldInstallDate: string
  installDate:    string
  dueDate:        string | null
  jobUrl:         string
}): string {
  return (
    `📅 <b>Install Date Moved</b>\n` +
    `<b>Project:</b> ${p.projectTitle}\n` +
    `<b>Client:</b> ${p.client}\n` +
    `<b>Install date:</b> ${formatDate(p.oldInstallDate)} → ${formatDate(p.installDate)}\n` +
    `<b>Due date:</b> ${p.dueDate ? `${formatDate(p.dueDate)} (unchanged)` : 'not set'}\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// Sent to each assigned designer when the office clears a job's design due
// date (edit 18, Nic 2026-09-01). The install line shows a move too when the
// same save carried one.
export function tplDesignDueRemoved(p: {
  projectTitle:   string
  client:         string
  oldDue:         string
  oldInstallDate: string
  installDate:    string
  jobUrl:         string
}): string {
  const installLine = p.oldInstallDate === p.installDate
    ? formatDate(p.installDate)
    : `${formatDate(p.oldInstallDate)} → ${formatDate(p.installDate)}`
  return (
    `🗓 <b>Design Due Date Removed</b>\n` +
    `<b>Project:</b> ${p.projectTitle}\n` +
    `<b>Client:</b> ${p.client}\n` +
    `<b>Install date:</b> ${installLine}\n` +
    `<b>Due date:</b> removed (was ${formatDate(p.oldDue)})\n\n` +
    `<a href="${p.jobUrl}">View in app →</a>`
  )
}

// Sent to each assigned designer when the office types a design due date by
// hand — a first date ("Set") or a different one ("Changed") — and it sticks
// (edit 19, Nic 2026-09-01). The install line shows a same-save move too.
export function tplDesignDueSet(p: {
  projectTitle:   string
  client:         string
  oldDue:         string | null
  newDue:         string
  oldInstallDate: string
  installDate:    string
  jobUrl:         string
}): string {
  const installLine = p.oldInstallDate === p.installDate
    ? formatDate(p.installDate)
    : `${formatDate(p.oldInstallDate)} → ${formatDate(p.installDate)}`
  const dueLine = p.oldDue
    ? `${formatDate(p.oldDue)} → ${formatDate(p.newDue)}`
    : formatDate(p.newDue)
  return (
    `📌 <b>Design Due Date ${p.oldDue ? 'Changed' : 'Set'}</b>\n` +
    `<b>Project:</b> ${p.projectTitle}\n` +
    `<b>Client:</b> ${p.client}\n` +
    `<b>Install date:</b> ${installLine}\n` +
    `<b>Due date:</b> ${dueLine}\n\n` +
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
// assigns the installer(s) they had been suggested. The header reflects what
// happened to the team (Nic, 2026-08-19): fresh assignment / modified team /
// last installer removed.
export function tplInstallerAssigned(p: {
  projectTitle:   string | null
  jobClient:      string
  jobDate:        string
  timeStart:      string | null
  timeEnd:        string | null
  location:       string
  installerNames: string[]
  jobUrl:         string
  kind?:          'assigned' | 'changed' | 'removed'
}): string {
  const names = p.installerNames.length > 0 ? p.installerNames.join(', ') : '(none)'
  const header =
    p.kind === 'removed' ? `❌ <b>Installer Removed</b>\n`
    : p.kind === 'changed' ? `❗ <b>Installer Changed</b>\n`
    : `✅ <b>Installer Assigned</b>\n`
  return (
    header +
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
