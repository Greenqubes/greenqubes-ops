import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteObject } from '@/lib/storage/r2'
import { ownsNewJobScratchKey } from '@/lib/storage/new-job-attachments'

// Deletes holding-area uploads the moment someone abandons them — pressing
// Cancel on the New Job form, or the bin on a single file (Nic, 2026-09-15).
//
// The cleanup cron already sweeps this prefix, but it runs nightly and only
// acts after 7 days. That is the right safety net for a closed tab or a dead
// battery, and the wrong answer to someone explicitly saying "discard this":
// the card promises the files go with the job, so they should go now.
//
// Same guard as the attach route, for the same reason: the keys come from the
// browser, so each is checked to be in the CALLER's own holding area before
// anything is deleted. Without it this route would delete arbitrary objects.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { keys?: string[] }
  const keys = Array.isArray(body.keys) ? body.keys : []

  let deleted = 0, skipped = 0
  for (const key of keys) {
    if (typeof key !== 'string' || !ownsNewJobScratchKey(profile.id, key)) { skipped++; continue }
    try { await deleteObject(key); deleted++ } catch { skipped++ }
  }

  return NextResponse.json({ deleted, skipped })
}
