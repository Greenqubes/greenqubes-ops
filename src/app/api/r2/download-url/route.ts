import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getDownloadUrl } from '@/lib/storage/r2'
import { voiceKeyBelongsToJob } from '@/lib/storage/gallery-delete'

// Signs a short-lived download URL for an R2 object, but ONLY after checking the
// caller is allowed to see it (audit 2026-08-13, finding #3). Previously any
// authenticated user could get a URL for any key they named.
//
// Authorization model:
//   • Job files (a row in `files` with this r2_key): allowed iff the caller can
//     see the owning job. We re-use the jobs RLS SELECT (office roles see all
//     jobs; installers see only assigned ones) as the source of truth.
//   • Bug screenshots (a row in `bug_reports` with this screenshot_key, no
//     `files` row): scheduler / admin only — matches the Bugs tab access.
//   • Anything else: 404 (no record references the key).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key, filename } = await req.json() as { key?: string; filename?: string }
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key required' }, { status: 400 })
  }

  const service = createServiceClient()

  // ── Job file? Authorize by whether the caller can see the owning job. ───────
  // Service client reads job_id regardless of the caller's own file RLS; the
  // access decision is then made by the jobs RLS on the user's session.
  const { data: fileRow } = await service
    .from('files')
    .select('job_id')
    .eq('r2_key', key)
    .maybeSingle() as { data: { job_id: string | null } | null; error: unknown }

  if (fileRow?.job_id) {
    const { data: visibleJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', fileRow.job_id)
      .maybeSingle() as { data: { id: string } | null; error: unknown }
    if (!visibleJob) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const url = await getDownloadUrl(key, filename)
    return NextResponse.json({ url })
  }

  // ── Bug screenshot? scheduler / admin only. ─────────────────────────────────
  const { data: bugRow } = await service
    .from('bug_reports')
    .select('id')
    .eq('screenshot_key', key)
    .maybeSingle() as { data: { id: string } | null; error: unknown }

  if (bugRow) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle() as { data: { role: string } | null; error: unknown }
    if (profile?.role !== 'scheduler' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const url = await getDownloadUrl(key, filename)
    return NextResponse.json({ url })
  }

  // ── A chat voice note? (job Gallery, Nic 2026-11-11.) Voice notes live only
  //    in messages.voice_url — no files row — so until this branch they could
  //    never be signed and the chat's play button did nothing. Read on the
  //    caller's OWN session: if RLS lets them read that message, they may play it.
  const { data: voiceMsg } = await supabase
    .from('messages')
    .select('id, job_id')
    .eq('voice_url', key)
    .limit(1)
    .maybeSingle() as { data: { id: string; job_id: string } | null; error: unknown }
  const { data: voiceJob } = voiceMsg
    ? await service.from('jobs').select('r2_folder').eq('id', voiceMsg.job_id).maybeSingle() as
        { data: { r2_folder: string | null } | null; error: unknown }
    : { data: null }
  if (voiceMsg && voiceKeyBelongsToJob(key, voiceJob?.r2_folder ?? null, voiceMsg.job_id)) {
    const url = await getDownloadUrl(key, filename)
    return NextResponse.json({ url })
  }

  // No record references this key.
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
