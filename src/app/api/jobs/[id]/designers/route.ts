import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { setJobDesigners } from '@/lib/supabase/queries/designers'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplDesignAssigned } from '@/lib/telegram/templates'
import { scoreDesignJob } from '@/lib/ai/design-score'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

// Sales / scheduler / coordinator / admin set the design-team list for a job.
// Diffs against the current job_designers set and notifies only the newly
// added designers — bell + Telegram. Removed designers get no notification,
// and re-saving an unchanged set (empty diff) sends nothing.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role; name: string; email: string | null }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role, name, email')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Who's assigning — any role can (R2-T2 edit 4): display name, fall back
  // to email, so the assigned designer sees a real person, not a role.
  const assignerName = profile.name?.trim() || profile.email || 'Someone'

  const effectiveRole = await getEffectiveRole(profile.role)
  if (!['sales', 'scheduler', 'coordinator', 'admin'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userIds } = await req.json().catch(() => ({})) as { userIds?: string[] }
  if (!Array.isArray(userIds)) {
    return NextResponse.json({ error: 'userIds required' }, { status: 400 })
  }

  const { added } = await setJobDesigners(jobId, userIds)

  // ── Notifications (best-effort — never block the assignment on a send) ──
  if (added.length > 0) {
    try {
      const svc = createServiceClient()

      type JobRow = { project_title: string | null; client: string; date: string }
      const { data: job } = await svc
        .from('jobs')
        .select('project_title, client, date')
        .eq('id', jobId)
        .maybeSingle() as { data: JobRow | null; error: unknown }

      type DesignerContact = { id: string; telegram_chat_id: string | null }
      const { data: designers } = await svc
        .from('users')
        .select('id, telegram_chat_id')
        .in('id', added)
        .is('deleted_at', null) as { data: DesignerContact[] | null; error: unknown }

      // Bell notifications for every newly-added designer. Body carries a
      // JSON blob (projectTitle/assignedBy/client/installDate) so the drawer
      // can render the assigner + client + install date (R2-T2 edit 4);
      // pre-upgrade rows had a plain-text body, and NotificationDrawer's
      // parser falls back to the old single-line rendering when JSON.parse
      // fails, so older rows still render sensibly.
      const projectTitleFallback = job?.project_title ?? 'Untitled job'
      const assignedBody = job
        ? JSON.stringify({
            projectTitle: projectTitleFallback,
            assignedBy:   assignerName,
            client:       job.client,
            installDate:  job.date,
          })
        : projectTitleFallback

      await svc.from('notifications').insert(added.map(uid => ({
        user_id: uid,
        type:    'design_assigned',
        job_id:  jobId,
        title:   'New design job assigned',
        body:    assignedBody,
      })) as never)

      // Telegram — only designers with a chat id.
      if (job) {
        const jobUrl = `${APP_URL}/jobs/${jobId}`
        const msg = tplDesignAssigned({
          projectTitle: job.project_title ?? 'Untitled job',
          client:       job.client,
          date:         job.date,
          assignedBy:   assignerName,
          jobUrl,
        })
        await Promise.all(
          (designers ?? [])
            .filter(d => d.telegram_chat_id)
            .map(d => sendTelegram(d.telegram_chat_id!, msg)),
        )
      }
    } catch {
      // swallow notification errors — the assignment already succeeded
    }
  }

  // Dispatched via after() (review fix, controller ruling): a bare
  // `void scoreDesignJob(...)` can be frozen by the serverless runtime once
  // this handler's response is sent, since nothing is left awaiting it.
  // after() keeps it alive until the callback settles. A freshly assigned
  // designer means there's now someone to score for, even if the brief text
  // itself didn't just change.
  if (added.length > 0) after(() => scoreDesignJob(jobId, 'assign'))

  return NextResponse.json({ ok: true, added })
}
