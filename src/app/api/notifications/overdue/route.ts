import { NextRequest, NextResponse } from 'next/server'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobOverdue } from '@/lib/telegram/templates'
import {
  getOverdueJobs,
  wasRecentlyNotified,
  recordOverdueNotification,
} from '@/lib/supabase/queries/notifications'

// Called by Vercel cron every 2 hours (see vercel.json).
// Also callable manually: GET /api/notifications/overdue
// with Authorization: Bearer <CRON_SECRET>

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const jobs = await getOverdueJobs()

  // Current SGT time in minutes-since-midnight
  const sgtNow       = new Date(Date.now() + 8 * 3_600_000)
  const todaySGT     = sgtNow.toISOString().slice(0, 10)
  const nowMinutesSGT = sgtNow.getUTCHours() * 60 + sgtNow.getUTCMinutes()

  const results = { sent: 0, skipped: 0 }

  for (const job of jobs) {
    // For today's jobs, only fire if past time_end
    if (job.date === todaySGT) {
      if (!job.time_end) {
        results.skipped++
        continue
      }
      const [h, m] = job.time_end.split(':').map(Number)
      if (nowMinutesSGT < h * 60 + m) {
        results.skipped++
        continue
      }
    }
    // Jobs from earlier dates are always overdue

    if (await wasRecentlyNotified(job.id)) {
      results.skipped++
      continue
    }

    const timeEnd = job.time_end
      ? (() => {
          const [h, m] = job.time_end!.split(':').map(Number)
          const suffix = h >= 12 ? 'PM' : 'AM'
          const h12    = h % 12 || 12
          return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`
        })()
      : 'end of day'

    const jobUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'}/jobs/${job.id}`

    const msg = tplJobOverdue({
      projectTitle: job.project_title,
      jobClient:    job.client,
      pocName:      job.client_poc_name,
      pocPhone:     job.client_poc_phone,
      jobDate:      job.date,
      timeEnd,
      location:     job.location,
      jobUrl,
    })

    if (job.sales_poc?.telegram_chat_id) {
      await sendTelegram(job.sales_poc.telegram_chat_id, msg)
    }
    for (const a of job.job_assignees) {
      if (a.users?.telegram_chat_id) {
        await sendTelegram(a.users.telegram_chat_id, msg)
      }
    }

    await recordOverdueNotification(job.id)
    results.sent++
  }

  return NextResponse.json({ ok: true, ...results })
}
