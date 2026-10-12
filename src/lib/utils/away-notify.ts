import { createServiceClient } from '@/lib/supabase/service'
import { getSchedulers } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplAwayClash } from '@/lib/telegram/templates'
import { awayBlocksJob, awayWhenLabel, pairKey, newPairs, type AwayTrip } from './away-overlap'

// Same two levels as leave-notify (spec §7), approved by Nic 2026-10-09:
//   1. Every new or changed trip -> bell card to schedulers. No Telegram.
//   2. A trip overlapping a job someone on it is FORMALLY on -> bell AND
//      Telegram to the schedulers, the job's PIC and its coordinators.
//      On an edit, only (person, job) pairs that are NEW are notified.
// Best-effort: never throws into the save path.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
// A job starting more than this far before the trip cannot still be running.
const MAX_SPAN_DAYS = 62

type AffectedJob = {
  id: string; project_title: string | null; client: string; location: string
  date: string; date_end: string | null; time_start: string | null; time_end: string | null
  sales_poc_id: string | null
  job_assignees: Array<{ user_id: string; is_suggestion: boolean }>
}

type Pair = { personId: string; job: AffectedJob }

function minusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10)
}

/** Every (person on the trip, job they are formally on) the trip overlaps. */
async function affectedPairs(trip: AwayTrip): Promise<Map<string, Pair>> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('jobs')
    .select('id, project_title, client, location, date, date_end, time_start, time_end, sales_poc_id, job_assignees(user_id, is_suggestion)')
    .in('status', ['scheduled', 'awaiting_approval'])
    .lte('date', trip.end_date)
    .gte('date', minusDays(trip.start_date, MAX_SPAN_DAYS))
  const pairs = new Map<string, Pair>()
  for (const job of (data ?? []) as unknown as AffectedJob[]) {
    if (!awayBlocksJob(trip, job.date, job.date_end, job.time_start, job.time_end)) continue
    for (const p of trip.people) {
      if (job.job_assignees.some(a => a.user_id === p.id && !a.is_suggestion)) {
        pairs.set(pairKey(p.id, job.id), { personId: p.id, job })
      }
    }
  }
  return pairs
}

/** Level 1 — a bell card to every scheduler. Returns their ids for level 2. */
async function announce(trip: AwayTrip): Promise<string[]> {
  const svc = createServiceClient()
  const schedulers = await getSchedulers()
  if (schedulers.length > 0) {
    await svc.from('notifications').insert(schedulers.map(s => ({
      user_id: s.id,
      type:    'away_recorded',
      job_id:  null,
      title:   `Away: ${trip.people.map(p => p.name).join(', ')} — ${trip.title}`,
      body:    awayWhenLabel(trip),
    })) as never)
  }
  return schedulers.map(s => s.id)
}

/** Level 2 — bell + Telegram per affected job. */
async function escalate(trip: AwayTrip, schedulerIds: string[], pairs: Pair[]) {
  const svc = createServiceClient()
  const when = awayWhenLabel(trip)
  for (const { personId, job } of pairs) {
    const personName = trip.people.find(p => p.id === personId)?.name ?? 'Someone'
    const { data: coords } = await svc.from('job_coordinators').select('user_id').eq('job_id', job.id)
    const ids = new Set<string>(schedulerIds)
    if (job.sales_poc_id) ids.add(job.sales_poc_id)
    for (const c of (coords ?? []) as Array<{ user_id: string }>) ids.add(c.user_id)

    const jobName = job.project_title || job.client
    await svc.from('notifications').insert([...ids].map(uid => ({
      user_id: uid,
      type:    'away_clash',
      job_id:  job.id,
      title:   `Away: ${personName}`,
      body:    `${personName} is away (${trip.title}, ${when}) but is on "${jobName}". Warning only.`,
    })) as never)

    const { data: chatRows } = await svc.from('users')
      .select('telegram_chat_id').in('id', [...ids]).is('deleted_at', null)
    const targets = new Set<string>()
    for (const r of (chatRows ?? []) as Array<{ telegram_chat_id: string | null }>) {
      if (r.telegram_chat_id) targets.add(r.telegram_chat_id)
    }
    if (targets.size === 0) {
      // Design Load's B3 looked like a broken send for days for exactly this.
      console.warn('[away/notify] nobody has a Telegram chat id', { jobId: job.id })
      continue
    }
    const msg = tplAwayClash({
      personName, tripTitle: trip.title, tripWhen: when,
      projectTitle: job.project_title, jobClient: job.client, jobDate: job.date,
      timeStart: job.time_start, timeEnd: job.time_end, location: job.location,
      jobUrl: `${APP_URL}/jobs/${job.id}`,
    })
    await Promise.all([...targets].map(chatId => sendTelegram(chatId, msg)))
  }
}

export async function notifyAwayCreated(trip: AwayTrip): Promise<void> {
  try {
    const schedulerIds = await announce(trip)
    const pairs = await affectedPairs(trip)
    await escalate(trip, schedulerIds, [...pairs.values()])
  } catch (err) {
    console.error('[away/notify] create failed', err)
  }
}

// `before` is the trip as it was BEFORE the update, re-checked against jobs as
// they are now — exactly "who has already been warned". Only pairs the edit
// newly creates are escalated (Nic, 2026-10-09).
export async function notifyAwayEdited(before: AwayTrip, after: AwayTrip): Promise<void> {
  try {
    const schedulerIds = await announce(after)
    const [oldPairs, nowPairs] = await Promise.all([affectedPairs(before), affectedPairs(after)])
    const fresh = newPairs(new Set(oldPairs.keys()), new Set(nowPairs.keys()))
    await escalate(after, schedulerIds, [...fresh].map(k => nowPairs.get(k)!))
  } catch (err) {
    console.error('[away/notify] edit failed', err)
  }
}
