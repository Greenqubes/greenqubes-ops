import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getJobNotifData, getJobRecipients } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobAssigned, tplInstallerAssigned } from '@/lib/telegram/templates'
import { timesOverlap } from '@/lib/utils/clash-detection'
import type { CheckClash } from '@/features/job-detail/EditClashModal'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

// Coordinator / scheduler / admin formally assign installers. This clears any
// sales suggestions for the job, sets the formal assignee list, and notifies:
//   • newly-added installers  → "Job Assigned"
//   • sales POC + coordinators → "Installer Assigned"
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
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveRole = await getEffectiveRole(profile.role)
  if (!['scheduler', 'coordinator', 'admin'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const installerIds: string[] = Array.isArray(body.installer_ids)
    ? body.installer_ids.filter((x: unknown): x is string => typeof x === 'string')
    : []

  // ── checkOnly: report clashes without saving (Workflow V2 Task 19) ─────────
  // Used before saving an already-scheduled job so moving its time or installer
  // onto another booking warns first. Optional date/time/punctuality overrides
  // let the form check its UNSAVED values.
  if (new URL(req.url).searchParams.get('checkOnly') === 'true') {
    type JobRow = { date: string; time_start: string | null; time_end: string | null; punctuality: string }
    const { data: currentJob } = await supabase
      .from('jobs')
      .select('date, time_start, time_end, punctuality')
      .eq('id', jobId)
      .maybeSingle() as { data: JobRow | null; error: unknown }
    if (!currentJob) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const date        = typeof body.date === 'string' && body.date ? body.date : currentJob.date
    const timeStart   = 'time_start'  in body ? ((body.time_start  as string) || null) : currentJob.time_start
    const timeEnd     = 'time_end'    in body ? ((body.time_end    as string) || null) : currentJob.time_end
    const punctuality = typeof body.punctuality === 'string' && body.punctuality
      ? body.punctuality : currentJob.punctuality

    type ConflictRow = {
      id: string; project_title: string | null; client: string
      time_start: string | null; time_end: string | null; punctuality: string
      job_assignees: Array<{ user_id: string; is_sub_installer: boolean }>
    }
    // Sub-installers are excluded from clash detection (Phase 3 rule) — a
    // helper on another job is not a booking conflict.
    const { data: sameDay } = await supabase
      .from('jobs')
      .select('id, project_title, client, time_start, time_end, punctuality, job_assignees(user_id, is_sub_installer)')
      .eq('date', date)
      .neq('id', jobId)
      .in('status', ['scheduled', 'awaiting_approval']) as { data: ConflictRow[] | null; error: unknown }

    const names = new Map<string, string>()
    if (installerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, name')
        .in('id', installerIds) as { data: Array<{ id: string; name: string }> | null }
      for (const u of users ?? []) names.set(u.id, u.name)
    }

    // Hard only when both jobs are strict AND both have fixed start times —
    // same grading as the board and the Phase 2 push-time check.
    const clashes: CheckClash[] = []
    for (const conflict of sameDay ?? []) {
      if (!timesOverlap(timeStart, timeEnd, conflict.time_start, conflict.time_end)) continue
      const bothStrict = punctuality === 'strict' && conflict.punctuality === 'strict'
      const bothFixed  = !!timeStart && !!conflict.time_start
      if (punctuality !== 'strict' && conflict.punctuality !== 'strict') continue
      const severity: CheckClash['severity'] = bothStrict && bothFixed ? 'hard' : 'soft'
      const conflictIds = new Set(
        conflict.job_assignees.filter(a => !a.is_sub_installer).map(a => a.user_id),
      )
      for (const id of installerIds) {
        if (!conflictIds.has(id)) continue
        clashes.push({
          installerId:   id,
          installerName: names.get(id) ?? '',
          severity,
          conflict: {
            jobId:        conflict.id,
            projectTitle: conflict.project_title,
            client:       conflict.client,
            timeStart:    conflict.time_start,
            timeEnd:      conflict.time_end,
          },
        })
      }
    }

    return NextResponse.json({ hasClash: clashes.length > 0, clashes })
  }

  // Which installers are newly added (for their "Job Assigned" notification)?
  const { data: existing } = await supabase
    .from('job_assignees')
    .select('user_id')
    .eq('job_id', jobId)
    .eq('is_suggestion', false)
    .eq('is_sub_installer', false) as { data: Array<{ user_id: string }> | null }
  const existingIds = new Set((existing ?? []).map(r => r.user_id))
  const newlyAddedIds = installerIds.filter(id => !existingIds.has(id))

  // Replace suggestions + formal assignments with the new formal set —
  // touching MAIN rows only. Sub-installer rows (Phase 4) live in their own
  // bucket and are managed by the sub-installers route. One exception: the PK
  // is (job_id, user_id), so someone being formally assigned as a MAIN
  // installer loses any sub row first (main assignment supersedes).
  await supabase.from('job_assignees').delete()
    .eq('job_id', jobId).eq('is_suggestion', true).eq('is_sub_installer', false).throwOnError()
  await supabase.from('job_assignees').delete()
    .eq('job_id', jobId).eq('is_suggestion', false).eq('is_sub_installer', false).throwOnError()
  if (installerIds.length > 0) {
    await supabase.from('job_assignees').delete()
      .eq('job_id', jobId).eq('is_sub_installer', true).in('user_id', installerIds).throwOnError()
    await supabase.from('job_assignees').insert(
      installerIds.map(uid => ({ job_id: jobId, user_id: uid, is_suggestion: false })) as never,
    ).throwOnError()
  }

  // ── Notifications (best-effort — never block the assignment on a send) ──
  try {
    const job = await getJobNotifData(jobId)
    if (job) {
      const jobUrl = `${APP_URL}/jobs/${jobId}`

      let installerNames: string[] = []
      if (installerIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, telegram_chat_id')
          .in('id', installerIds)
          .is('deleted_at', null) as { data: Array<{ id: string; name: string; telegram_chat_id: string | null }> | null }
        const rows = users ?? []
        installerNames = rows.map(u => u.name)

        // Tell each newly-added installer they're on the job.
        await Promise.all(
          rows
            .filter(u => newlyAddedIds.includes(u.id) && u.telegram_chat_id)
            .map(u => sendTelegram(u.telegram_chat_id!, tplJobAssigned({
              projectTitle: job.project_title,
              jobClient:    job.client,
              pocName:      job.client_poc_name,
              pocPhone:     job.client_poc_phone,
              jobDate:      job.date,
              timeStart:    job.time_start,
              timeEnd:      job.time_end,
              location:     job.location,
              jobUrl,
            }))),
        )
      }

      // Tell the sales POC + coordinators who was assigned.
      const { salesPoc } = await getJobRecipients(jobId)
      const { data: coords } = await supabase
        .from('job_coordinators')
        .select('users(telegram_chat_id)')
        .eq('job_id', jobId) as { data: Array<{ users: { telegram_chat_id: string | null } | null }> | null }

      const targets = new Set<string>()
      if (salesPoc?.telegram_chat_id) targets.add(salesPoc.telegram_chat_id)
      for (const c of coords ?? []) {
        const chatId = c.users?.telegram_chat_id
        if (chatId) targets.add(chatId)
      }

      const msg = tplInstallerAssigned({
        projectTitle:   job.project_title,
        jobClient:      job.client,
        jobDate:        job.date,
        timeStart:      job.time_start,
        timeEnd:        job.time_end,
        location:       job.location,
        installerNames,
        jobUrl,
      })
      await Promise.all([...targets].map(chatId => sendTelegram(chatId, msg)))
    }
  } catch {
    // swallow notification errors — the assignment already succeeded
  }

  return NextResponse.json({ ok: true })
}
