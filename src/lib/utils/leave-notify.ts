import { createServiceClient } from '@/lib/supabase/service'
import { getSchedulers } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplLeaveClash, formatDate } from '@/lib/telegram/templates'
import { leaveBlocksJob, leaveDatesLabel, addDays, type LeaveRecord } from './leave-overlap'

// Two levels, deliberately (spec §6):
//   1. EVERY new or moved leave entry -> a bell card to schedulers. No
//      Telegram: leave is recorded often and most of it clashes with nothing,
//      so Telegramming all of it would train people to ignore the bot.
//   2. Leave that lands on a job the person is ALREADY assigned to -> bell AND
//      Telegram to the schedulers, the job's person-in-charge and its
//      coordinators. That one needs acting on today.
//
// The leave TYPE never appears in either. It is not read here at all — the
// query below does not touch user_leave_details — so there is no path by
// which "medical" could reach a notification.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? ''
// Matches the guard in leave-overlap: a job starting more than this far before
// the leave cannot still be running during it.
const MAX_SPAN_DAYS = 62

type AffectedJob = {
  id: string; project_title: string | null; client: string; location: string
  date: string; date_end: string | null; time_start: string | null; time_end: string | null
  sales_poc_id: string | null
  job_assignees: Array<{ user_id: string; is_suggestion: boolean }>
}

// Best-effort — never throws into the save path. A failed notification must
// not lose HR's leave entry (the assign-installers rule).
export async function notifyLeave(leave: LeaveRecord): Promise<void> {
  try {
    const svc = createServiceClient()
    const dates = leaveDatesLabel(leave, formatDate)

    type NameRow = { name: string }
    const { data: person } = await svc.from('users').select('name').eq('id', leave.user_id)
      .maybeSingle() as { data: NameRow | null; error: unknown }
    const personName = person?.name ?? 'Someone'

    const schedulers = await getSchedulers()

    // 1. Bell to schedulers on every entry.
    if (schedulers.length > 0) {
      await svc.from('notifications').insert(schedulers.map(s => ({
        user_id: s.id,
        type:    'leave_recorded',
        job_id:  null,
        title:   `On leave: ${personName}`,
        body:    dates,
      })) as never)
    }

    // 2. Escalation — jobs this person is FORMALLY on (suggestions excluded;
    //    support-crew rows included) that the leave actually blocks.
    const { data: jobsRaw } = await svc
      .from('jobs')
      .select('id, project_title, client, location, date, date_end, time_start, time_end, sales_poc_id, job_assignees(user_id, is_suggestion)')
      .in('status', ['scheduled', 'awaiting_approval'])
      .lte('date', leave.date_end)
      .gte('date', addDays(leave.date_start, -MAX_SPAN_DAYS))
    const affected = ((jobsRaw ?? []) as unknown as AffectedJob[])
      .filter(j => j.job_assignees.some(a => a.user_id === leave.user_id && !a.is_suggestion))
      .filter(j => leaveBlocksJob(leave, j.date, j.date_end, j.time_start, j.time_end))

    for (const job of affected) {
      type CoordRow = { user_id: string }
      const { data: coords } = await svc.from('job_coordinators').select('user_id').eq('job_id', job.id)
      const bellIds = new Set<string>(schedulers.map(s => s.id))
      if (job.sales_poc_id) bellIds.add(job.sales_poc_id)
      for (const c of (coords ?? []) as CoordRow[]) bellIds.add(c.user_id)

      const jobName = job.project_title || job.client
      await svc.from('notifications').insert([...bellIds].map(uid => ({
        user_id: uid,
        type:    'leave_clash',
        job_id:  job.id,
        title:   `Leave clash: ${personName}`,
        body:    `${personName} is on leave ${dates} but is on "${jobName}" (${formatDate(job.date)}).`,
      })) as never)

      type ChatRow = { telegram_chat_id: string | null }
      const { data: chatRows } = await svc.from('users')
        .select('telegram_chat_id').in('id', [...bellIds]).is('deleted_at', null)
      const targets = new Set<string>()
      for (const r of (chatRows ?? []) as ChatRow[]) {
        if (r.telegram_chat_id) targets.add(r.telegram_chat_id)
      }
      if (targets.size === 0) {
        // Design Load's B3 was exactly this and looked like a broken send for
        // days: the only recipient had no Telegram link. Say so in the logs.
        console.warn('[leave/notify] leave clash: nobody has a Telegram chat id', { jobId: job.id })
        continue
      }
      const msg = tplLeaveClash({
        personName,
        leaveDates:   dates,
        projectTitle: job.project_title,
        jobClient:    job.client,
        jobDate:      job.date,
        timeStart:    job.time_start,
        timeEnd:      job.time_end,
        location:     job.location,
        jobUrl:       `${APP_URL}/jobs/${job.id}`,
      })
      await Promise.all([...targets].map(chatId => sendTelegram(chatId, msg)))
    }
  } catch (err) {
    // Never block the leave save on a notification failure — but say why in
    // Vercel -> Logs rather than swallowing it silently.
    console.error('[leave/notify] failed', err)
  }
}
