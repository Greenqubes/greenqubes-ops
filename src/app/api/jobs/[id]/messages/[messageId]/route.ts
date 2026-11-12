import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { deleteObject } from '@/lib/storage/r2'
import { canDeleteForEveryone, pageFileGates, voiceKeyBelongsToJob } from '@/lib/storage/gallery-delete'
import { loadDeleteContext, recordChatDeletion } from '@/lib/supabase/queries/gallery'
import type { Role } from '@/lib/supabase/types'

/**
 * DELETE /api/jobs/[id]/messages/[messageId] — Delete for everyone on a voice
 * note (the job Gallery, Nic 2026-11-11). Voice notes only: text messages
 * aren't deletable (400). Allowed for whoever sent it, schedulers and admin,
 * never once the job is completed (canDeleteForEveryone, source 'voice').
 * The recording leaves R2 first, then the row, then a grey "Voice note
 * deleted by <name>" line is recorded.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const { id: jobId, messageId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase.from('users').select('id, name, role')
    .eq('auth_id', user.id).maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)
  const isAdmin = profile.role === 'admin'

  // Read on the caller's OWN session: if RLS hides the message, so do we.
  type MsgRow = { id: string; job_id: string; author_id: string | null; kind: string; voice_url: string | null; ts: string }
  const { data: msg } = await supabase.from('messages')
    .select('id, job_id, author_id, kind, voice_url, ts')
    .eq('id', messageId).eq('job_id', jobId).maybeSingle() as { data: MsgRow | null; error: unknown }
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (msg.kind !== 'voice') return NextResponse.json({ error: 'Only voice notes can be deleted' }, { status: 400 })

  const service = createServiceClient()
  const job = await loadDeleteContext(service, jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const gates = pageFileGates({ role, isAdmin, viewerId: profile.id, job })
  const allowed = canDeleteForEveryone({
    role, isAdmin, viewerId: profile.id, source: 'voice', fileKind: null, byId: msg.author_id,
    jobStatus: job.status, completedAt: job.completed_at, otherCompletionFiles: 0,
    filesLocked: gates.filesLocked, designBriefEditable: gates.designBriefEditable, sentAt: msg.ts,
  })
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // voice_url is free text from the browser: only a key inside THIS job's
  // voice folder is ever removed from storage (final review I9).
  if (msg.voice_url && voiceKeyBelongsToJob(msg.voice_url, job.r2_folder, jobId)) {
    try {
      await deleteObject(msg.voice_url)
    } catch (e) {
      console.error('[voice delete] R2 delete failed', msg.voice_url, e)
      return NextResponse.json({ error: 'Storage delete failed' }, { status: 502 })
    }
  }
  const { error } = await service.from('messages').delete().eq('id', msg.id)
  if (error) {
    console.error('[voice delete] DB delete failed', msg.id, error)
    return NextResponse.json({ error: 'Database delete failed' }, { status: 500 })
  }
  await recordChatDeletion(service, {
    jobId, itemName: null, isVoice: true, itemTs: msg.ts, deletedBy: profile.id, deletedByName: profile.name,
  })
  return NextResponse.json({ ok: true })
}
