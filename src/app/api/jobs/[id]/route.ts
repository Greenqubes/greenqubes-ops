import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { daysBetween, addDaysISO } from '@/lib/utils/design-urgency'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplDesignDueShift, tplDesignInstallShift } from '@/lib/telegram/templates'
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

  type JobRow = { date: string; design_due_date: string | null; project_title: string | null; design_brief: string | null; client: string }
  const { data: job } = await supabase
    .from('jobs')
    .select('date, design_due_date, project_title, design_brief, client')
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

  // What the assigned designers get told about this save, if anything:
  // - due_shift:     the install date moved and the due date followed it
  // - install_shift: the install date moved but the due date did NOT follow —
  //                  kept via the prompt, or there was none to shift (edit 17,
  //                  Nic 2026-09-01: designers still hear about the move)
  type DueShiftNotify     = { kind: 'due_shift'; oldDue: string; newDue: string; installDate: string }
  type InstallShiftNotify = { kind: 'install_shift'; oldInstallDate: string; installDate: string; dueDate: string | null }
  let notify: DueShiftNotify | InstallShiftNotify | null = null

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
      notify = { kind: 'due_shift', oldDue: job.design_due_date, newDue, installDate: body.date }
    } else {
      // The due date after this save: the kept/typed one from the body if it
      // was sent (it landed via the whitelist above), else whatever the job
      // already had (null when there's none).
      const dueAfterSave = ('design_due_date' in updates ? updates.design_due_date : job.design_due_date) as string | null
      notify = { kind: 'install_shift', oldInstallDate: job.date, installDate: body.date, dueDate: dueAfterSave }
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

      const rows   = designers ?? []
      const title  = job.project_title ?? 'Untitled job'
      const jobUrl = `${APP_URL}/jobs/${jobId}`
      const n = notify // const copy so the narrowing survives the closures below

      // JSON body (R2-T2 edit 4): carries client + install date alongside the
      // move so the drawer can render "Due date: old → new" (or, for an
      // install-only move, "Install date: old → new" + the unchanged due
      // date) plus Client/Install date. Pre-upgrade rows had a plain
      // "old → new" body string — NotificationDrawer's parser falls back to
      // that rendering when JSON.parse fails, so older rows still render.
      const notifType = n.kind === 'due_shift' ? 'design_due_shift' : 'design_install_shift'
      const bodyJson  = n.kind === 'due_shift'
        ? JSON.stringify({ projectTitle: title, oldDue: n.oldDue, newDue: n.newDue, client: job.client, installDate: n.installDate })
        : JSON.stringify({ projectTitle: title, oldInstallDate: n.oldInstallDate, installDate: n.installDate, dueDate: n.dueDate, client: job.client })

      if (rows.length > 0) {
        await svc.from('notifications').insert(rows.map(d => ({
          user_id: d.user_id,
          type:    notifType,
          job_id:  jobId,
          title,
          body:    bodyJson,
        })) as never)
      }

      // Telegram on EVERY move — due date shifted earlier or later (Nic
      // 2026-08-31; was earlier-only, which read as "Telegram didn't send"
      // on a later move), or install date moved with the due date kept
      // (edit 17). Only designers who have linked Telegram can receive one;
      // the warn line is the tell when a job's designers have no chat id
      // (B3: the test designer accounts had none — nobody to send to).
      const targets = rows.filter(d => d.users?.telegram_chat_id)
      if (targets.length === 0) {
        console.warn(`[jobs/patch] ${n.kind}: no assigned designer has a Telegram chat id`, { jobId, designers: rows.length })
      } else {
        const msg = n.kind === 'due_shift'
          ? tplDesignDueShift({ projectTitle: title, oldDue: n.oldDue, newDue: n.newDue, client: job.client, installDate: n.installDate, jobUrl })
          : tplDesignInstallShift({ projectTitle: title, client: job.client, oldInstallDate: n.oldInstallDate, installDate: n.installDate, dueDate: n.dueDate, jobUrl })
        await Promise.all(targets.map(d => sendTelegram(d.users!.telegram_chat_id!, msg)))
      }
    } catch (err) {
      // Never block the save on a notification failure — the date/shift is
      // already committed — but say why in Vercel → Logs instead of
      // swallowing it silently.
      console.error('[jobs/patch] due-shift notify failed', err)
    }
  }

  return NextResponse.json({ ok: true, design_due_date: updates.design_due_date ?? job.design_due_date })
}
