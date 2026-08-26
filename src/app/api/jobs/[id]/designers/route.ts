import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { setJobDesigners } from '@/lib/supabase/queries/designers'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplDesignAssigned } from '@/lib/telegram/templates'
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

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!['sales', 'scheduler', 'coordinator', 'admin'].includes(profile.role)) {
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

      // Bell notifications for every newly-added designer.
      await svc.from('notifications').insert(added.map(uid => ({
        user_id: uid,
        type:    'design_assigned',
        job_id:  jobId,
        title:   'New design job assigned',
        body:    job?.project_title ?? 'Untitled job',
      })) as never)

      // Telegram — only designers with a chat id.
      if (job) {
        const jobUrl = `${APP_URL}/jobs/${jobId}`
        const msg = tplDesignAssigned({
          projectTitle: job.project_title ?? 'Untitled job',
          client:       job.client,
          date:         job.date,
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

  // scoring hook (Task 7)

  return NextResponse.json({ ok: true, added })
}
