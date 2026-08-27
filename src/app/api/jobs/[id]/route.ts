import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { daysBetween, addDaysISO } from '@/lib/utils/design-urgency'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplDesignDueShift, formatDate } from '@/lib/telegram/templates'
import { scoreDesignJob } from '@/lib/ai/design-score'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

function todaySGT(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveRole = await getEffectiveRole(profile.role)
  // Addendum §2: coordinator gains sales-level delete on pending jobs.
  if (!['sales', 'scheduler', 'coordinator'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  type JobRow = { id: string; status: string }
  const { data: job } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if ((effectiveRole === 'sales' || effectiveRole === 'coordinator') && job.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending jobs can be deleted' }, { status: 409 })
  }

  // Authorization is enforced entirely by the role + pending-only gates above:
  // the only jobs DELETE RLS policy (0019) covers scheduler/admin, so sales
  // and coordinator have no row-level policy to rely on. Deleting via the
  // session client would silently filter to 0 rows for them and still report
  // success, so the delete runs on the service client instead, and the
  // result is checked to confirm a row was actually removed.
  const svc = createServiceClient()
  const { data: deletedRows, error: deleteError } = await svc
    .from('jobs')
    .delete()
    .eq('id', jobId)
    .select('id')

  if (deleteError) {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

// Design brief fields + due-date auto-shift (Task 6). No general job-fields
// PATCH existed before this — the rest of the edit form still saves directly
// via a client-side `supabase.from('jobs').update()` (see JobDetailShell).
// This route exists specifically because the auto-shift needs the job's
// pre-save `date`/`design_due_date` read server-side (the client is about to
// overwrite `date` in its own save call) and because notifying designers by
// Telegram needs the bot token, which never reaches the browser.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveRole = await getEffectiveRole(profile.role)

  const body = await req.json().catch(() => ({})) as {
    date?:               string
    design_brief?:       string | null
    design_due_date?:    string | null
    design_due_manual?:  boolean
    rescore?:            boolean
    keepManualDue?:      boolean
  }

  // Lightweight rescore-only request (Task 7): fired by DesignBriefSection
  // after a client-side brief-file upload, since that insert never touches
  // this route. Writes nothing — just re-triggers scoring — so designers
  // (who can upload attachments here but can't edit the brief/due-date
  // fields below) are allowed through this one branch, subject to the two
  // guards below (review fix, CRITICAL): a designer must actually be on the
  // job, and a job scored in the last 10 minutes is skipped rather than
  // re-billed — this branch has no diff to gate it, so without a cooldown
  // it's an unmetered re-roll / cost lever.
  if (body.rescore === true) {
    if (!['sales', 'scheduler', 'coordinator', 'admin', 'designer'].includes(effectiveRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    type RescoreJobRow = { id: string; design_scored_at: string | null }
    const { data: rescoreJob } = await supabase
      .from('jobs')
      .select('id, design_scored_at')
      .eq('id', jobId)
      .maybeSingle() as { data: RescoreJobRow | null; error: unknown }
    if (!rescoreJob) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (effectiveRole === 'designer') {
      const { data: assignedRow } = await supabase
        .from('job_designers')
        .select('user_id')
        .eq('job_id', jobId)
        .eq('user_id', profile.id)
        .maybeSingle()
      if (!assignedRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (rescoreJob.design_scored_at) {
      const scoredMsAgo = Date.now() - new Date(rescoreJob.design_scored_at).getTime()
      if (scoredMsAgo < 10 * 60_000) {
        return NextResponse.json({ ok: true, skipped: 'cooldown' })
      }
    }

    after(() => scoreDesignJob(jobId, 'brief_change'))
    return NextResponse.json({ ok: true })
  }

  if (!['sales', 'scheduler', 'coordinator', 'admin'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  type JobRow = { date: string; design_due_date: string | null; project_title: string | null; design_brief: string | null }
  const { data: job } = await supabase
    .from('jobs')
    .select('date, design_due_date, project_title, design_brief')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Whitelist — only the design-brief fields (plus `date`, needed for the
  // shift math below) ever land here; every other job field still goes
  // through the client-side update.
  const updates: Record<string, unknown> = {}
  if ('design_brief' in body)       updates.design_brief       = body.design_brief ?? null
  if ('design_due_date' in body)    updates.design_due_date    = body.design_due_date ?? null
  if ('design_due_manual' in body)  updates.design_due_manual  = !!body.design_due_manual

  let notify: { oldDue: string; newDue: string; movedEarlier: boolean } | null = null

  if (body.date && body.date !== job.date) {
    updates.date = body.date

    // Auto-shift (spec, Nic 2026-08-26): preserve the lead-time gap by moving
    // the due date the same signed delta the install date moved, regardless
    // of design_due_manual. Clamped at today (SGT) — never shifted into the
    // past. The AI itself never re-proposes over a manual date; this is a
    // separate, purely mechanical move.
    //
    // Addendum §1 (Nic, 2026-08-27): when this save also carries a due date
    // the user typed THIS session, the client asks first and — on "keep" —
    // sends keepManualDue: true alongside its own design_due_date. Skip the
    // shift entirely then: the body's due date already lands via the
    // whitelist above, and `notify` staying null (no shift happened) also
    // correctly skips the designer-notification block below.
    const skipShiftForManualKeep = body.keepManualDue === true && 'design_due_date' in body
    if (job.design_due_date && !skipShiftForManualKeep) {
      const delta   = daysBetween(job.date, body.date)
      const shifted = addDaysISO(job.design_due_date, delta)
      const today    = todaySGT()
      const newDue   = shifted < today ? today : shifted
      updates.design_due_date = newDue
      notify = { oldDue: job.design_due_date, newDue, movedEarlier: delta < 0 }
    }
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('jobs').update(updates as never).eq('id', jobId).throwOnError()
  }

  // ── AI scoring trigger (Task 7) — fire only when content that actually
  // feeds the model changed; resubmitting identical values must not re-score.
  // Brief-change wins over date-change when both moved in the same save.
  const briefChanged = body.design_brief !== undefined && body.design_brief !== job.design_brief
  const dateChanged   = body.date !== undefined && body.date !== job.date
  if (briefChanged || dateChanged) {
    after(() => scoreDesignJob(jobId, briefChanged ? 'brief_change' : 'date_change'))
  }

  // ── Notify assigned designers of the shift (best-effort) ──────────────────
  if (notify) {
    try {
      const svc = createServiceClient()

      type DesignerContact = { user_id: string; users: { telegram_chat_id: string | null } | null }
      const { data: designers } = await svc
        .from('job_designers')
        .select('user_id, users(telegram_chat_id)')
        .eq('job_id', jobId) as { data: DesignerContact[] | null; error: unknown }

      const rows = designers ?? []
      const title = job.project_title ?? 'Untitled job'
      const bodyLine = `${formatDate(notify.oldDue)} → ${formatDate(notify.newDue)}`

      if (rows.length > 0) {
        await svc.from('notifications').insert(rows.map(d => ({
          user_id: d.user_id,
          type:    'design_due_shift',
          job_id:  jobId,
          title,
          body:    bodyLine,
        })) as never)
      }

      // Telegram only when the date moved earlier — a later due date is not urgent.
      if (notify.movedEarlier) {
        const msg = tplDesignDueShift({
          projectTitle: title,
          oldDue:       notify.oldDue,
          newDue:       notify.newDue,
          jobUrl:       `${APP_URL}/jobs/${jobId}`,
        })
        await Promise.all(
          rows
            .filter(d => d.users?.telegram_chat_id)
            .map(d => sendTelegram(d.users!.telegram_chat_id!, msg)),
        )
      }
    } catch {
      // swallow notification errors — the date/shift already saved
    }
  }

  return NextResponse.json({ ok: true, design_due_date: updates.design_due_date ?? job.design_due_date })
}
