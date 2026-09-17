import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSummaryTelegram } from '@/lib/telegram/bot'
import {
  buildUnassignedSummary, buildInstallerSummary, formatDayDate, formatTimeRange,
  splitForTelegram, type TomorrowRow, type UnassignedJob,
} from '@/lib/telegram/day-summary'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/**
 * People who get the scheduler's check on top of the schedulers and admins.
 *
 * Nic's own account is `sales` (checked against the live table, 2026-09-16),
 * so a role-based list left the owner off. Named by EMAIL rather than by
 * name, because two people can share a first name, and rather than by
 * widening `sales`, which would send it to every sales person.
 */
const ALWAYS_RECEIVE_EMAILS = ['nicholas.wong@greenqubes.com']

/**
 * The two daily messages, on ONE route with a `part` switch so they share the
 * staff lookup and the send helper. Vercel calls it twice (see vercel.json):
 *
 *   • `?part=unassigned` at **4pm SGT** ("0 8 * * *") — the scheduler's check:
 *     every job still without a driver. 4pm, not 6pm, because it is only
 *     useful while he is still at his desk to act on it.
 *   • `?part=installers` at **6pm SGT** ("0 10 * * *") — each installer's
 *     tomorrow + what changed for them today. After the scheduler has
 *     finished arranging, so it reflects his 4pm fixes.
 *
 * No `part` runs both, which is what a manual run wants.
 *
 * The scheduler's message replaced a full who-added-what roster on
 * 2026-09-17. His words: "at 4pm SGT it will cut off and read whatever job
 * that has not been arranged with installer/driver… regardless if the job is
 * 5 days from now, 20 days from now or 1 month away… then if still left
 * unassigned, fire tmr again until driver or installer is inserted." So there
 * is deliberately NO look-ahead window, and it repeats until the gap is
 * filled.
 *
 * Changes already sent immediately (jobs dated today) carry notified_now on
 * their event row and are skipped, so nobody hears the same reassignment
 * twice.
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

  const part      = new URL(req.url).searchParams.get('part')
  const doGaps    = part === null || part === 'unassigned'
  const doCrew    = part === null || part === 'installers'

  const db = createServiceClient()

  // SGT day boundaries. This machine's clock is NOT Singapore time and TZ= is
  // ignored here, so the date is derived through Intl rather than read off
  // the shell (2026-09-10). 'en-CA' gives YYYY-MM-DD.
  const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const dayStart = new Date(`${todayISO}T00:00:00+08:00`).toISOString()
  const dateLbl  = formatDayDate(todayISO)

  type Person = { id: string; name: string; role: string; email: string | null; telegram_chat_id: string | null }
  const { data: people } = await db
    .from('users').select('id, name, role, email, telegram_chat_id')
    .is('deleted_at', null).order('name') as { data: Person[] | null }
  const staff    = people ?? []
  const nameById = new Map(staff.map(u => [u.id, u.name]))

  let schedulerSent = 0
  let installerSent = 0
  let gapCount      = 0
  let pendingCount  = 0

  // ── A. The scheduler's check: jobs with nobody assigned ──────────────────
  if (doGaps) {
    type GapJob = {
      id: string; project_title: string | null; client: string; location: string
      date: string; created_by: string | null; sales_poc_id: string | null
      job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
    }
    const { data: upcoming } = await db
      .from('jobs')
      .select('id, project_title, client, location, date, created_by, sales_poc_id, job_assignees(user_id, is_suggestion, is_sub_installer)')
      .gte('date', todayISO)
      .eq('status', 'scheduled')
      .order('date') as { data: GapJob[] | null }

    const dayMs  = 864e5
    const today0 = new Date(`${todayISO}T00:00:00+08:00`).getTime()

    // "Arranged" means a DRIVER — a formal, non-support assignee. Support crew
    // on their own is not a job that is covered, and a suggestion is a
    // tentative sales pick nobody has confirmed.
    const gapJobs = (upcoming ?? [])
      .filter(j => j.job_assignees.filter(a => !a.is_suggestion && !a.is_sub_installer).length === 0)
    gapCount = gapJobs.length

    // Grouped by the job's SALES person (Nic, 2026-09-17) — the scheduler
    // chases per person. That is the Person-in-Charge (`sales_poc_id`), not
    // whoever typed the job in: the POC owns it and is who he would ask.
    // Falls back to the creator when no POC is set, so a job can never end up
    // in an unnamed group.
    const groupsByName = new Map<string, UnassignedJob[]>()
    for (const j of gapJobs) {
      const owner = j.sales_poc_id
        ? (nameById.get(j.sales_poc_id) ?? 'Unknown')
        : j.created_by ? (nameById.get(j.created_by) ?? 'Unknown') : 'No sales person'
      const list = groupsByName.get(owner) ?? []
      list.push({
        id:        j.id,
        title:     j.project_title || j.client || 'Untitled job',
        dateLabel: formatDayDate(j.date),
        location:  j.location ?? '',
        createdBy: j.created_by ? (nameById.get(j.created_by) ?? 'Unknown') : 'Unknown',
        daysAway:  Math.round((new Date(`${j.date}T00:00:00+08:00`).getTime() - today0) / dayMs),
      })
      groupsByName.set(owner, list)
    }

    // Groups alphabetical so the message reads the same way every evening;
    // jobs inside each group soonest first, which is the order he works.
    const groups = [...groupsByName.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([salesName, jobs]) => ({
        salesName,
        jobs: [...jobs].sort((x, y) => x.daysAway - y.daysAway),
      }))

    const text  = buildUnassignedSummary({ dateLabel: dateLbl, appUrl: APP_URL, groups })
    const parts = splitForTelegram(text)

    for (const u of staff.filter(x =>
      x.role === 'scheduler' ||
      x.role === 'admin' ||
      (x.email !== null && ALWAYS_RECEIVE_EMAILS.includes(x.email)))) {
      if (!u.telegram_chat_id) continue
      let allSent = true
      for (const p of parts) {
        if (!await sendSummaryTelegram(u.telegram_chat_id, p)) allSent = false
      }
      if (allSent) schedulerSent++
    }
  }

  // ── B. Each installer: tomorrow, then what changed today ─────────────────
  if (doCrew) {
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
    pendingCount  = pending.length

    const jobIds = [...new Set(pending.map(c => c.target_id))]
    type JobLite = { id: string; project_title: string | null; client: string; date: string; location: string }
    const { data: jobRows } = jobIds.length === 0
      ? { data: [] as JobLite[] }
      : await db.from('jobs').select('id, project_title, client, date, location').in('id', jobIds) as
        { data: JobLite[] | null }
    const jobById = new Map((jobRows ?? []).map(j => [j.id, j]))

    // Tomorrow's roster, per person (Nic, 2026-09-17). Without this, an
    // installer whose schedule did not change today got NO message — even
    // with a 9am tomorrow assigned three weeks ago. Jobs dated TODAY are
    // deliberately excluded: those notify the moment they change.
    const tomorrowISO = new Date(new Date(`${todayISO}T00:00:00+08:00`).getTime() + 864e5)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    const tomorrowLbl = formatDayDate(tomorrowISO)

    type TomorrowJob = {
      id: string; project_title: string | null; client: string; location: string
      time_start: string | null; time_end: string | null; sales_poc_id: string | null
      job_assignees: Array<{ user_id: string; is_suggestion: boolean; is_sub_installer: boolean }>
    }
    const { data: tomorrowJobs } = await db
      .from('jobs')
      .select('id, project_title, client, location, time_start, time_end, sales_poc_id, job_assignees(user_id, is_suggestion, is_sub_installer)')
      .lte('date', tomorrowISO)
      .or(`date_end.gte.${tomorrowISO},and(date.eq.${tomorrowISO},date_end.is.null)`)
      .eq('status', 'scheduled') as { data: TomorrowJob[] | null }

    const tomorrowByPerson = new Map<string, TomorrowRow[]>()
    for (const j of tomorrowJobs ?? []) {
      const formal = j.job_assignees.filter(a => !a.is_suggestion)
      for (const a of formal) {
        // Everyone ELSE on the job, so the line reads from this person's side
        // (Nic, 2026-09-17): support crew are told who to follow, a driver is
        // told who is following them. Self is excluded — nobody needs telling
        // they are on their own job.
        const others = formal.filter(x => x.user_id !== a.user_id)
        const list = tomorrowByPerson.get(a.user_id) ?? []
        list.push({
          id:        j.id,
          title:     j.project_title || j.client || 'Untitled job',
          timeLabel: formatTimeRange(j.time_start, j.time_end),
          location:  j.location ?? '',
          role:      a.is_sub_installer ? 'support' : 'driver',
          driverNames:  others.filter(x => !x.is_sub_installer).map(x => nameById.get(x.user_id) ?? 'Unknown'),
          supportNames: others.filter(x =>  x.is_sub_installer).map(x => nameById.get(x.user_id) ?? 'Unknown'),
          pocName:      j.sales_poc_id ? (nameById.get(j.sales_poc_id) ?? '') : '',
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

    // Everyone with EITHER work tomorrow or a change today.
    const recipientIds = new Set<string>([...byPerson.keys(), ...tomorrowByPerson.keys()])

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
      for (const p of splitForTelegram(text)) {
        if (!await sendSummaryTelegram(person.telegram_chat_id, p)) allSent = false
      }
      if (allSent) installerSent++
    }
  }

  // Breadcrumb for Admin → Health, same as the other crons.
  await db.from('events').insert({
    actor_id: null, kind: 'day_summary_cron', target_id: null, target_table: null,
    payload: { part: part ?? 'both', schedulerSent, installerSent, gaps: gapCount, changes: pendingCount },
    visibility: ['role:scheduler'],
  } as never)

  return NextResponse.json({ ok: true, part: part ?? 'both', schedulerSent, installerSent, unassigned: gapCount })
}
