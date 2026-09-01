import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplSubInstallerAssigned } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

// Scheduler / admin confirm the sub-installer set for a job. Mirrors
// assign-installers but touches ONLY sub rows (is_sub_installer=true):
// clears sub suggestions, sets the formal sub list, Telegrams newly-added
// subs their job link. Main installer rows are never touched here.
// job_assignees PK is (job_id, user_id) — someone already on the job as a
// main installer is silently skipped rather than double-inserted.
// Smoke feedback edit 8 (Nic explicit, 2026-08-27): coordinator lost formal
// installer assignment "everywhere" — extended here to the sub-installer
// bucket for consistency with the main grid (not explicitly named in the
// feedback doc's route list, but same is_suggestion/formal pattern; a
// coordinator suggests subs via /suggest-installer's is_sub flag instead).
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
  if (!['scheduler', 'admin'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const requestedIds: string[] = Array.isArray(body.installer_ids)
    ? body.installer_ids.filter((x: unknown): x is string => typeof x === 'string')
    : []

  // Anyone already a MAIN installer on this job keeps that role — skip them.
  const { data: mains } = await supabase
    .from('job_assignees')
    .select('user_id')
    .eq('job_id', jobId)
    .eq('is_sub_installer', false)
    .eq('is_suggestion', false) as { data: Array<{ user_id: string }> | null }
  const mainIds = new Set((mains ?? []).map(r => r.user_id))
  const subIds  = requestedIds.filter(id => !mainIds.has(id))

  // Who is newly added (for their Telegram)?
  const { data: existing } = await supabase
    .from('job_assignees')
    .select('user_id')
    .eq('job_id', jobId)
    .eq('is_sub_installer', true)
    .eq('is_suggestion', false) as { data: Array<{ user_id: string }> | null }
  const existingIds  = new Set((existing ?? []).map(r => r.user_id))
  const newlyAddedIds = subIds.filter(id => !existingIds.has(id))

  // Replace sub suggestions + formal subs with the new formal sub set.
  await supabase.from('job_assignees').delete()
    .eq('job_id', jobId).eq('is_sub_installer', true).throwOnError()
  if (subIds.length > 0) {
    await supabase.from('job_assignees').insert(
      subIds.map(uid => ({
        job_id: jobId, user_id: uid, is_suggestion: false, is_sub_installer: true,
      })) as never,
    ).throwOnError()
  }

  // ── Telegram the newly-added subs (best-effort) ──────────────────────────
  // Distinct template: subs support the main crew, and the message says so.
  try {
    if (newlyAddedIds.length > 0) {
      const job = await getJobNotifData(jobId)
      if (job) {
        const { data: users } = await supabase
          .from('users')
          .select('id, name, telegram_chat_id')
          .in('id', newlyAddedIds)
          .is('deleted_at', null) as { data: Array<{ id: string; telegram_chat_id: string | null }> | null }

        let mainInstallers: string[] = []
        if (mainIds.size > 0) {
          const { data: mainUsers } = await supabase
            .from('users')
            .select('name')
            .in('id', [...mainIds]) as { data: Array<{ name: string }> | null }
          mainInstallers = (mainUsers ?? []).map(u => u.name)
        }

        const jobUrl = `${APP_URL}/jobs/${jobId}`
        await Promise.all(
          (users ?? [])
            .filter(u => u.telegram_chat_id)
            .map(u => sendTelegram(u.telegram_chat_id!, tplSubInstallerAssigned({
              projectTitle: job.project_title,
              jobClient:    job.client,
              pocName:      job.client_poc_name,
              pocPhone:     job.client_poc_phone,
              jobDate:      job.date,
              timeStart:    job.time_start,
              timeEnd:      job.time_end,
              location:     job.location,
              mainInstallers,
              jobUrl,
            }))),
        )
      }
    }
  } catch {
    // swallow notification errors — the assignment already succeeded
  }

  return NextResponse.json({ ok: true })
}
