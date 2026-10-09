import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { stageOf, STAGE_STATUS, type Stage } from '@/lib/utils/job-stage'
import { canMoveStage, isStageMoveValid, missingForStage, postponeNotifyNow, stageWriteVia, stageMoveBlocked } from '@/lib/utils/job-stage-rules'
import { recordCrewChange } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobPostponed } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/**
 * Stage moves that are not "push to schedule" (spec 2026-10-09):
 *   Draft → Pending, Pending → Draft, Scheduled → Pending (postponed).
 * Push to Schedule keeps its own route (/submit): it carries the clash flow
 * and the scheduler Telegram.
 *
 * Scheduled → Pending clears the date and takes the whole crew off — crew
 * are confirmed once a job is on the schedule, and an installer must never
 * see a Pending job. Removed crew are told at 6pm, or now if it was today.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase.from('users').select('id, role')
    .eq('auth_id', user.id).maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)

  const body = await req.json().catch(() => ({})) as { to?: string }
  const to = body.to
  if (to !== 'draft' && to !== 'pending') return NextResponse.json({ error: 'bad_target' }, { status: 400 })

  type JobRow = {
    id: string; status: string; date: string | null; scheduled_at: string | null; created_by: string | null; sales_poc_id: string | null
    project_title: string | null; client: string; client_poc_name: string | null
    client_poc_phone: string | null; location: string
    job_coordinators: Array<{ user_id: string }>
    job_designers:    Array<{ user_id: string }>
  }
  const { data: job } = await supabase.from('jobs')
    .select('id, status, date, scheduled_at, created_by, sales_poc_id, project_title, client, client_poc_name, client_poc_phone, location, job_coordinators(user_id), job_designers(user_id)')
    .eq('id', jobId).maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const from = stageOf(job.status)
  if (!isStageMoveValid(from, to)) return NextResponse.json({ error: 'invalid_move' }, { status: 409 })
  const rulesJob = {
    status: job.status, created_by: job.created_by, sales_poc_id: job.sales_poc_id,
    coordinatorIds: job.job_coordinators.map(c => c.user_id),
  }
  if (!canMoveStage({ id: profile.id, role }, rulesJob, to)) {
    return NextResponse.json({ error: 'not_permitted' }, { status: 403 })
  }

  // Designers cannot see a Draft (0062), yet design-daily would keep
  // reminding them about it — take them off first (review fix, 2026-10-09).
  const blocked = stageMoveBlocked(to, job.job_designers.length)
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 })

  if (to === 'pending') {
    const missing = missingForStage('pending', job)
    if (missing.length) return NextResponse.json({ error: 'missing_fields', fields: missing }, { status: 422 })
  }

  const postponing = from === 'scheduled' && to === 'pending'
  const patch: Record<string, unknown> = { status: STAGE_STATUS[to as Stage] }
  if (postponing) patch.date = null

  // 1. The job itself, on the caller's OWN client — RLS has the final say on
  //    whether they may change it. .select('id'): an UPDATE filtered by RLS is
  //    not an error (the trap this repo has shipped four times).
  //    Exception: a move INTO Draft. The row then becomes hidden from a
  //    non-sharer (0062) and UPDATE … RETURNING on their session fails, so it
  //    is written on the service key — the session read above and
  //    canMoveStage already authorised it (the handover route's pattern).
  const { data: updated, error: updErr } = stageWriteVia(from, to) === 'service'
    ? await createServiceClient().from('jobs').update(patch as never).eq('id', jobId).select('id')
    : await supabase.from('jobs').update(patch as never).eq('id', jobId).select('id')
  if (updErr || !updated?.length) return NextResponse.json({ error: 'not_permitted' }, { status: 403 })

  // 2. The crew, on the service client, only AFTER the move was allowed.
  //    job_assignees has no UPDATE policy at all and sales cannot delete
  //    outside-contractor rows (0039), so on the caller's client these writes
  //    would silently do nothing — and an installer could then see a Pending
  //    job. Every write is checked; on failure the move is undone.
  const svc = createServiceClient()
  let removed: Array<{ user_id: string; is_sub_installer: boolean }> = []
  try {
    if (postponing) {
      // Scheduled → Pending: crew are confirmed on the schedule, so the
      // confirmed crew and contractors come off. Suggestions stay.
      const { data: gone, error } = await svc.from('job_assignees').delete()
        .eq('job_id', jobId).eq('is_suggestion', false).select('user_id, is_sub_installer')
      if (error) throw error
      removed = (gone ?? []) as typeof removed
      const { error: extErr } = await svc.from('job_external_contacts').delete()
        .eq('job_id', jobId).eq('is_suggestion', false)
      if (extErr) throw extErr
    } else if (from === 'draft' && to === 'pending') {
      // A scheduler may have confirmed crew on the draft, hidden from the
      // installers only while it was a draft (0062). On a Pending job crew
      // may only be suggested, so confirmed picks become suggestions — they
      // come back as picks to confirm once it is pushed.
      const { error } = await svc.from('job_assignees')
        .update({ is_suggestion: true, suggested_by: profile.id } as never)
        .eq('job_id', jobId).eq('is_suggestion', false)
      if (error) throw error
      const { error: extErr } = await svc.from('job_external_contacts')
        .update({ is_suggestion: true } as never)
        .eq('job_id', jobId).eq('is_suggestion', false)
      if (extErr) throw extErr
    }
  } catch (err) {
    console.error('[jobs/stage] crew update failed, undoing the move', jobId, err)
    // scheduled_at too: the 0038 trigger re-stamps it when status returns to
    // 'scheduled', which would cost the job its FCFS place.
    await svc.from('jobs').update({ status: job.status, date: job.date } as never).eq('id', jobId)
    await svc.from('jobs').update({ scheduled_at: job.scheduled_at } as never).eq('id', jobId)
    return NextResponse.json({ error: 'crew_not_updated' }, { status: 500 })
  }

  if (postponing && removed.length && job.date) {
    const todayISO = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
    const now = postponeNotifyNow(job.date, todayISO)
    if (now) {
      try {
        const { data: users } = await supabase.from('users').select('id, telegram_chat_id')
          .in('id', removed.map(r => r.user_id)).is('deleted_at', null) as
          { data: Array<{ id: string; telegram_chat_id: string | null }> | null }
        const text = tplJobPostponed({
          projectTitle: job.project_title, jobClient: job.client,
          oldDate: job.date, location: job.location, jobUrl: `${APP_URL}/jobs/${jobId}`,
        })
        await Promise.all((users ?? []).filter(u => u.telegram_chat_id)
          .map(u => sendTelegram(u.telegram_chat_id!, text)))
      } catch (err) {
        // The move already happened — log, don't undo (Design Load B3 lesson).
        console.error('[jobs/stage] postpone notify failed', err)
      }
    }
    await recordCrewChange(jobId,
      removed.map(r => ({ userId: r.user_id, action: 'removed' as const, asSupport: r.is_sub_installer })),
      profile.id, now)
  }

  return NextResponse.json({ ok: true, status: patch.status })
}
