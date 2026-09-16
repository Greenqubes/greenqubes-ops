import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getJobNotifData, getJobRecipients, recordCrewChange } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobAssigned, tplInstallerAssigned } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/**
 * The ONE write path for a driver-board drag: drivers and support crew set
 * together, in one request.
 *
 * Why not reuse /assign-installers + /sub-installers: a drag changes both
 * lists at once, and two sequential calls can leave a job with the new driver
 * and the old support crew if the second fails. They also each fire their own
 * Telegram, which is precisely what the board is designed NOT to do.
 *
 * NOTIFICATIONS (Nic, 2026-09-15 — the load-bearing decision of the feature):
 * a drag Telegrams NOBODY, because a scheduler arranging tomorrow would buzz
 * an installer ten times for a day that is not settled, each message
 * contradicting the last. Changes are recorded and collected into a 6pm
 * summary instead — EXCEPT a job dated TODAY, which notifies immediately, so
 * a 2pm reassignment never reaches the installer after the job should have
 * started.
 *
 * Scheduler and admin only. Sales and coordinators have been suggest-only for
 * installers since 2026-09-01; for them the board is read-only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Test the REAL role alongside the effective one — getEffectiveRole never
  // returns 'admin' (a plain admin resolves to 'scheduler'), so an admin-only
  // gate written against it silently never matches. Same trap as the
  // quiet-push button, 2026-09-15.
  const effectiveRole = await getEffectiveRole(profile.role)
  if (!['scheduler', 'admin'].includes(effectiveRole) && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const asIds = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []
  const driverIds = [...new Set(asIds(body.driver_ids))]
  // Nobody can be a driver and support crew on the same job — the
  // job_assignees PK is (job_id, user_id), so one row per person.
  const supportIds = [...new Set(asIds(body.support_ids))].filter(id => !driverIds.includes(id))

  type JobRow = { id: string; date: string; status: string }
  const { data: job } = await supabase
    .from('jobs').select('id, date, status').eq('id', jobId).maybeSingle() as
    { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (job.status === 'completed') {
    return NextResponse.json({ error: 'This job is completed — reopen it first.' }, { status: 409 })
  }

  // ── What changed, before we write ───────────────────────────────────────
  type ExistingRow = { user_id: string; is_sub_installer: boolean }
  const { data: existing } = await supabase
    .from('job_assignees')
    .select('user_id, is_sub_installer')
    .eq('job_id', jobId)
    .eq('is_suggestion', false) as { data: ExistingRow[] | null }
  const before = new Map((existing ?? []).map(r => [r.user_id, r.is_sub_installer]))
  const after  = new Map<string, boolean>([
    ...driverIds.map(id  => [id, false] as const),
    ...supportIds.map(id => [id, true]  as const),
  ])

  const changes: Array<{ userId: string; action: 'added' | 'removed'; asSupport: boolean }> = []
  for (const [id, asSupport] of after) {
    if (!before.has(id) || before.get(id) !== asSupport) changes.push({ userId: id, action: 'added', asSupport })
  }
  for (const [id, asSupport] of before) {
    if (!after.has(id)) changes.push({ userId: id, action: 'removed', asSupport })
  }

  // ── Write: replace the whole formal crew in one pass ─────────────────────
  // Suggestions go too. A drag is a formal decision by the scheduler, and
  // leaving a stale sales suggestion behind would resurface it on the form.
  await supabase.from('job_assignees').delete()
    .eq('job_id', jobId).throwOnError()

  if (after.size > 0) {
    const rows = [...after].map(([uid, asSupport]) => ({
      job_id: jobId, user_id: uid, is_suggestion: false, is_sub_installer: asSupport,
    }))
    // .select() so an RLS refusal is a real failure — an INSERT filtered out
    // by RLS is NOT an error: PostgREST answers with no rows and
    // .throwOnError() passes. This repo has shipped that bug four times.
    const { data: written, error } = await supabase
      .from('job_assignees').insert(rows as never).select('user_id')
    if (error || (written ?? []).length !== rows.length) {
      console.error('[jobs/crew] write refused', jobId, error)
      return NextResponse.json(
        { error: 'The crew could not be saved — you may not have permission.' },
        { status: 403 },
      )
    }
  }

  // ── Notify only when the job is TODAY ────────────────────────────────────
  // 'en-CA' gives YYYY-MM-DD, and the timeZone is stated explicitly: this
  // machine's clock is not Singapore time and TZ= is ignored here (2026-09-10).
  const todayISO  = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const isToday   = job.date === todayISO
  let notifiedNow = false

  if (isToday && changes.length > 0) {
    try {
      const notif = await getJobNotifData(jobId)
      if (notif) {
        const jobUrl   = `${APP_URL}/jobs/${jobId}`
        const addedIds = changes.filter(c => c.action === 'added').map(c => c.userId)

        if (addedIds.length > 0) {
          const { data: users } = await supabase
            .from('users').select('id, name, telegram_chat_id')
            .in('id', addedIds).is('deleted_at', null) as
            { data: Array<{ id: string; name: string; telegram_chat_id: string | null }> | null }
          await Promise.all((users ?? [])
            .filter(u => u.telegram_chat_id)
            .map(u => sendTelegram(u.telegram_chat_id!, tplJobAssigned({
              projectTitle: notif.project_title, jobClient: notif.client,
              pocName:      notif.client_poc_name, pocPhone: notif.client_poc_phone,
              jobDate:      notif.date, timeStart: notif.time_start, timeEnd: notif.time_end,
              location:     notif.location, jobUrl,
            }))))
        }

        const { salesPoc } = await getJobRecipients(jobId)
        if (salesPoc?.telegram_chat_id) {
          const { data: names } = await supabase
            .from('users').select('name').in('id', driverIds) as { data: Array<{ name: string }> | null }
          await sendTelegram(salesPoc.telegram_chat_id, tplInstallerAssigned({
            projectTitle:   notif.project_title, jobClient: notif.client, jobDate: notif.date,
            timeStart:      notif.time_start, timeEnd: notif.time_end, location: notif.location,
            installerNames: (names ?? []).map(n => n.name), jobUrl,
            kind: driverIds.length === 0 ? 'removed' : before.size > 0 ? 'changed' : 'assigned',
          }))
        }
        notifiedNow = true
      }
    } catch (err) {
      // The crew change already succeeded — a failed send must not undo it.
      // Logged rather than swallowed: a silent notification failure is how
      // Design Load's B3 went unexplained for days.
      console.error('[jobs/crew] immediate notify failed', err)
    }
  }

  await recordCrewChange(jobId, changes, profile.id, notifiedNow)

  return NextResponse.json({ ok: true, notifiedNow })
}
