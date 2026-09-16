import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSummaryTelegram } from '@/lib/telegram/bot'
import { buildSchedulerSummary, buildInstallerSummary, formatDayDate, splitForTelegram } from '@/lib/telegram/day-summary'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

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
  type Person = { id: string; name: string; role: string; telegram_chat_id: string | null }
  const { data: people } = await db
    .from('users').select('id, name, role, telegram_chat_id')
    .is('deleted_at', null).order('name') as { data: Person[] | null }
  const staff = people ?? []

  // Who appears IN the message: everyone who can create a job.
  const CAN_CREATE = ['sales', 'coordinator', 'scheduler', 'admin']
  const roster     = staff.filter(u => CAN_CREATE.includes(u.role))

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
  for (const u of staff.filter(x => x.role === 'scheduler' || x.role === 'admin')) {
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
  type JobLite = { id: string; project_title: string | null; client: string; date: string }
  const { data: jobRows } = jobIds.length === 0
    ? { data: [] as JobLite[] }
    : await db.from('jobs').select('id, project_title, client, date').in('id', jobIds) as
      { data: JobLite[] | null }
  const jobById = new Map((jobRows ?? []).map(j => [j.id, j]))

  type Entry = { id: string; title: string; dateLabel: string; role: 'driver' | 'support' }
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
    }
    // Dragged on then off again in the same evening is no change at all, and
    // must not send two lines contradicting each other.
    const other = c.payload.action === 'added' ? bucket.removed : bucket.added
    const undo  = other.findIndex(e => e.id === entry.id)
    if (undo >= 0) other.splice(undo, 1)
    else (c.payload.action === 'added' ? bucket.added : bucket.removed).push(entry)
    byPerson.set(c.payload.user_id, bucket)
  }

  let installerSent = 0
  for (const [userId, bucket] of byPerson) {
    if (bucket.added.length === 0 && bucket.removed.length === 0) continue
    const person = staff.find(u => u.id === userId)
    if (!person?.telegram_chat_id) continue
    const text = buildInstallerSummary({
      dateLabel: dateLbl, name: person.name, appUrl: APP_URL,
      added: bucket.added, removed: bucket.removed,
    })
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
