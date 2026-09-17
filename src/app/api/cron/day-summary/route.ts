import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSummaryTelegram } from '@/lib/telegram/bot'
import {
  buildSchedulerSummary, buildInstallerSummary, formatDayDate, formatTimeRange,
  splitForTelegram, type TomorrowRow,
} from '@/lib/telegram/day-summary'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/**
 * Who can create a job, and therefore who is listed in the scheduler summary.
 */
const CAN_CREATE = ['sales', 'coordinator', 'scheduler', 'admin']

/**
 * People who get the whole-day overview on top of the schedulers and admins.
 *
 * Nic's own account is `sales` (checked against the live table, 2026-09-16),
 * so a role-based list left the owner off the one message that shows whether
 * the day was captured properly. Named by EMAIL rather than by name, because
 * two people can share a first name, and rather than by widening `sales`,
 * which would send the whole-day overview to every sales person.
 */
const ALWAYS_RECEIVE_EMAILS = ['nicholas.wong@greenqubes.com']

/**
 * System accounts that are not people. Excluded from the roster so the
 * message reads as a team list rather than a system log — GreenqubesAI can
 * create jobs (the assistant's create_pending_job tool) and its test jobs
 * were otherwise showing up under its own name every evening.
 *
 * Matched by NAME because this account has no email. Brittle if it is ever
 * renamed; the failure is cosmetic (it reappears in the list), not harmful.
 */
const SYSTEM_ACCOUNT_NAMES = ['GreenqubesAI']

/**
 * The 6pm summaries. Vercel cron "0 10 * * *" — Vercel schedules in UTC, and
 * 10:00 UTC is 18:00 SGT.
 *
 * TWO messages (Nic, 2026-09-15):
 *   • Scheduler summary — every job CREATED today, grouped by who created it,
 *     each showing the driver it landed on. Everyone who can create a job is
 *     listed, busy or not: the sketch shows an unchanging roster.
 *   • Installer summary — per person, what a board drag put on them and what
 *     it took off. Only people with an actual change are messaged; sending
 *     "nothing happened" to seven installers every evening is noise.
 *
 * Changes already sent immediately (jobs dated today) carry notified_now on
 * their event row and are skipped here, so nobody hears the same
 * reassignment twice.
 *
 * Fail-closed auth: an unset CRON_SECRET must 401, never run open
 * (2026-08-13 hardening rule).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // SGT day boundaries. This machine's clock is NOT Singapore time and TZ= is
  // ignored here, so the date is derived through Intl rather than read off
  // the shell (2026-09-10). 'en-CA' gives YYYY-MM-DD.
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const dayStart = new Date(`${todayISO}T00:00:00+08:00`).toISOString()
  const dateLbl  = formatDayDate(todayISO)

  // ── A. Scheduler summary ────────────────────────────────────────────────
  type Person = { id: string; name: string; role: string; email: string | null; telegram_chat_id: string | null }
  const { data: people } = await db
    .from('users').select('id, name, role, email, telegram_chat_id')
    .is('deleted_at', null).order('name') as { data: Person[] | null }
  const staff = people ?? []

  // Who appears IN the message: everyone who can create a job, minus the
  // system accounts that are not people.
  const roster = staff.filter(u =>
    CAN_CREATE.includes(u.role) && !SYSTEM_ACCOUNT_NAMES.includes(u.name))

  type NewJob = {
    id: string; project_title: string | null; client: string; created_by: string | null
    job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
  }
  const { data: newJobs } = await db
    .from('jobs')
    .select('id, project_title, client, created_by, job_assignees(user_id, is_suggestion, is_sub_installer)')
    .gte('created_at', dayStart) as { data: NewJob[] | null }

  const nameById = new Map(staff.map(u => [u.id, u.name]))

  const schedulerText = buildSchedulerSummary({
    dateLabel: dateLbl,
    appUrl:    APP_URL,
    roster: roster.map(person => ({
      name: person.name,
      jobs: (newJobs ?? [])
        .filter(j => j.created_by === person.id)
        .map(j => ({
          id:    j.id,
          title: j.project_title || j.client || 'Untitled job',
          driverNames: j.job_assignees
            .filter(a => !a.is_suggestion && !a.is_sub_installer)
            .map(a => nameById.get(a.user_id) ?? 'Unknown'),
        })),
    })),
  })

  // Recipients: the schedulers and admins — this is the whole-day overview.
  // Split first: Telegram rejects anything over 4096 characters, and a week
  // of real jobs measured 6,374 (2026-09-16). A busy day is exactly when this
  // message matters and exactly when it would have silently failed.
  const schedulerParts = splitForTelegram(schedulerText)
  let schedulerSent = 0
  const overviewRecipients = staff.filter(x =>
    x.role === 'scheduler' ||
    x.role === 'admin' ||
    (x.email !== null && ALWAYS_RECEIVE_EMAILS.includes(x.email)))
  for (const u of overviewRecipients) {
    if (!u.telegram_chat_id) continue
    let allSent = true
    for (const part of schedulerParts) {
      if (!await sendSummaryTelegram(u.telegram_chat_id, part)) allSent = false
    }
    if (allSent) schedulerSent++
  }

  // ── B. Installer summaries ──────────────────────────────────────────────
  type ChangeRow = {
    target_id: string
    payload: { user_id: string; action: 'added' | 'removed'; as_support: boolean; notified_now: boolean } | null
  }
  const { data: changes } = await db
    .from('events')
    .select('target_id, payload')
    .eq('kind', 'crew_change')
    .gte('ts', dayStart) as { data: ChangeRow[] | null }

  const pending = (changes ?? []).filter(c => c.payload && !c.payload.notified_now)

  const jobIds = [...new Set(pending.map(c => c.target_id))]
  type JobLite = { id: string; project_title: string | null; client: string; date: string; location: string }
  const { data: jobRows } = jobIds.length === 0
    ? { data: [] as JobLite[] }
    : await db.from('jobs').select('id, project_title, client, date, location').in('id', jobIds) as
      { data: JobLite[] | null }
  const jobById = new Map((jobRows ?? []).map(j => [j.id, j]))

  // ── Tomorrow's roster, per person (Nic, 2026-09-17) ─────────────────────
  // Without this, an installer whose schedule did not change today got NO
  // message — even with a 9am tomorrow assigned three weeks ago. Jobs dated
  // TODAY are deliberately excluded: those notify the moment they change, so
  // by 6pm they are old news.
  const tomorrowISO = new Date(new Date(`${todayISO}T00:00:00+08:00`).getTime() + 864e5)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const tomorrowLbl = formatDayDate(tomorrowISO)

  type TomorrowJob = {
    id: string; project_title: string | null; client: string; location: string
    time_start: string | null; time_end: string | null
    job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
  }
  const { data: tomorrowJobs } = await db
    .from('jobs')
    .select('id, project_title, client, location, time_start, time_end, job_assignees(user_id, is_suggestion, is_sub_installer)')
    .lte('date', tomorrowISO)
    .or(`date_end.gte.${tomorrowISO},and(date.eq.${tomorrowISO},date_end.is.null)`)
    .eq('status', 'scheduled') as { data: TomorrowJob[] | null }

  const tomorrowByPerson = new Map<string, TomorrowRow[]>()
  for (const j of tomorrowJobs ?? []) {
    for (const a of j.job_assignees) {
      if (a.is_suggestion) continue
      const list = tomorrowByPerson.get(a.user_id) ?? []
      list.push({
        id:        j.id,
        title:     j.project_title || j.client || 'Untitled job',
        timeLabel: formatTimeRange(j.time_start, j.time_end),
        location:  j.location ?? '',
        role:      a.is_sub_installer ? 'support' : 'driver',
      })
      tomorrowByPerson.set(a.user_id, list)
    }
  }

  type Entry = { id: string; title: string; dateLabel: string; role: 'driver' | 'support'; location: string }
  const byPerson = new Map<string, { added: Entry[]; removed: Entry[] }>()

  for (const c of pending) {
    const job = jobById.get(c.target_id)
    if (!job || !c.payload) continue
    const bucket = byPerson.get(c.payload.user_id) ?? { added: [], removed: [] }
    const entry: Entry = {
      id:        job.id,
      title:     job.project_title || job.client || 'Untitled job',
      dateLabel: formatDayDate(job.date),
      role:      c.payload.as_support ? 'support' : 'driver',
      location:  job.location ?? '',
    }
    // Dragged on then off again in the same evening is no change at all, and
    // must not send two lines contradicting each other.
    const other = c.payload.action === 'added' ? bucket.removed : bucket.added
    const undo  = other.findIndex(e => e.id === entry.id)
    if (undo >= 0) other.splice(undo, 1)
    else (c.payload.action === 'added' ? bucket.added : bucket.removed).push(entry)
    byPerson.set(c.payload.user_id, bucket)
  }

  // Everyone with EITHER work tomorrow or a change today. A person with a job
  // tomorrow and nothing changed still needs telling — that is the whole point
  // of adding the roster (Nic, 2026-09-17).
  const recipientIds = new Set<string>([...byPerson.keys(), ...tomorrowByPerson.keys()])

  let installerSent = 0
  for (const userId of recipientIds) {
    const bucket = byPerson.get(userId) ?? { added: [], removed: [] }
    const person = staff.find(u => u.id === userId)
    if (!person?.telegram_chat_id) continue
    const text = buildInstallerSummary({
      dateLabel: dateLbl, name: person.name, appUrl: APP_URL,
      tomorrowLabel: tomorrowLbl,
      tomorrow: tomorrowByPerson.get(userId) ?? [],
      added: bucket.added, removed: bucket.removed,
    })
    // '' means nothing tomorrow AND nothing changed — never send an empty
    // "nothing happened", which is how people learn to ignore a channel.
    if (!text) continue
    let allSent = true
    for (const part of splitForTelegram(text)) {
      if (!await sendSummaryTelegram(person.telegram_chat_id, part)) allSent = false
    }
    if (allSent) installerSent++
  }

  // Breadcrumb for Admin → Health, same as the other crons.
  await db.from('events').insert({
    actor_id: null, kind: 'day_summary_cron', target_id: null, target_table: null,
    payload: { schedulerSent, installerSent, changes: pending.length },
    visibility: ['role:scheduler'],
  } as never)

  return NextResponse.json({
    ok: true,
    schedulerSent,
    installerSent,
    skipped: (changes ?? []).length - pending.length,
  })
}
