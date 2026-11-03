import { createServiceClient } from '@/lib/supabase/service'
import { getSchedulers } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'

/**
 * To arrange alerts (spec 2026-11-04): every handover is a bell card AND a
 * Telegram to whoever's turn it now is.
 *   → all schedulers: ready, client said no, crew clash, client OK
 *   → the job's sales PIC + coordinators on it: offered, couldn't fit, withdrawn
 *
 * Best-effort and AWAITED: never throws into the route (the job has already
 * moved), never fire-and-forget (Vercel freezes the function once it
 * responds). The bell card is the generic one in NotificationDrawer — title,
 * body, tap to open the job.
 */

export type ArrangeBell = {
  type:  'arrange_ready' | 'arrange_offered' | 'arrange_returned' | 'arrange_client_ok' | 'arrange_pulled_back'
  title: string
  body:  string
}

async function deliver(jobId: string, userIds: string[], bell: ArrangeBell, telegram: string | null): Promise<void> {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) {
    console.warn('[arrange/notify] nobody to tell', { jobId, type: bell.type })
    return
  }
  const svc = createServiceClient()
  try {
    const { error } = await svc.from('notifications').insert(ids.map(uid => ({
      user_id: uid, type: bell.type, job_id: jobId, title: bell.title, body: bell.body,
    })) as never)
    if (error) console.error('[arrange/notify] bell insert failed', jobId, error)
  } catch (err) {
    console.error('[arrange/notify] bell insert failed', jobId, err)
  }
  if (!telegram) return
  try {
    const { data } = await svc.from('users').select('telegram_chat_id')
      .in('id', ids).is('deleted_at', null) as { data: Array<{ telegram_chat_id: string | null }> | null }
    const chats = [...new Set((data ?? []).map(r => r.telegram_chat_id).filter((c): c is string => !!c))]
    if (chats.length === 0) {
      // Design Load's B3 looked like a broken send for days for exactly this.
      console.warn('[arrange/notify] nobody has a Telegram chat id', { jobId, type: bell.type })
      return
    }
    await Promise.all(chats.map(c => sendTelegram(c, telegram)))
  } catch (err) {
    console.error('[arrange/notify] telegram failed', jobId, err)
  }
}

export async function alertSchedulers(jobId: string, bell: ArrangeBell, telegram: string | null): Promise<void> {
  try {
    const schedulers = await getSchedulers()
    await deliver(jobId, schedulers.map(s => s.id), bell, telegram)
  } catch (err) {
    console.error('[arrange/notify] scheduler lookup failed', jobId, err)
  }
}

export async function alertSalesSide(
  job: { id: string; sales_poc_id: string | null; coordinatorIds: string[] },
  bell: ArrangeBell, telegram: string | null,
): Promise<void> {
  const ids = [...(job.sales_poc_id ? [job.sales_poc_id] : []), ...job.coordinatorIds]
  await deliver(job.id, ids, bell, telegram)
}
