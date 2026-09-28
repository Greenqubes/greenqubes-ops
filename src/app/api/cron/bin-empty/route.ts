import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { listBin, getRetention, purgeBinEntry } from '@/lib/supabase/queries/job-bin'
import { isExpired } from '@/lib/utils/bin-rules'

// Empties bin entries past the admin's retention (Admin → Settings) and
// deletes their R2 objects — "once bin empties files go with it" (Nic,
// 2026-09-28). A file that fails to delete is left behind and logged; the
// entry is still removed, so nothing can restore a job whose files are gone.
//
// Called by Vercel cron daily at 04:00 SGT — see vercel.json.
// Manual run: GET with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const svc = createServiceClient()
  const [rows, retention] = await Promise.all([listBin(svc), getRetention(svc)])
  const now = new Date().toISOString()
  let emptied = 0, filesDeleted = 0, filesFailed = 0
  for (const r of rows) {
    if (!isExpired(r.deleted_at, retention, now)) continue
    const res = await purgeBinEntry(svc, r.id, null)
    if (res) { emptied++; filesDeleted += res.filesDeleted; filesFailed += res.filesFailed }
  }
  // Health-tab breadcrumb, same pattern as the other crons.
  await svc.from('events').insert({
    kind: 'bin_empty_cron', actor_id: null, target_id: null, target_table: null,
    payload: { retention, scanned: rows.length, emptied, filesDeleted, filesFailed }, visibility: [],
  } as never)
  return NextResponse.json({ ok: true, scanned: rows.length, emptied, filesDeleted, filesFailed })
}
