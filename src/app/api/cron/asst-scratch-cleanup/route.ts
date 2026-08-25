import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { listObjects, deleteObject } from '@/lib/storage/r2'

const MAX_AGE_DAYS = 30

// Deletes assistant chat scratch attachments (asst-chat/…) older than 30
// days. Scratch objects are never `files` rows; anything a created job needed
// was COPIED into the job's folder, so deleting scratch can never touch job
// files. Called by Vercel cron daily at 03:00 SGT — see vercel.json.
// Manual run: GET with Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const cutoff  = Date.now() - MAX_AGE_DAYS * 86_400_000
  const objects = await listObjects('asst-chat/')

  let deleted = 0, failed = 0
  for (const obj of objects) {
    if (!obj.lastModified || obj.lastModified.getTime() >= cutoff) continue
    try {
      await deleteObject(obj.key)
      deleted++
    } catch {
      failed++
    }
  }

  // Health-tab breadcrumb, same pattern as the overdue check's events row.
  const db = createServiceClient()
  await db.from('events').insert({
    kind: 'asst_scratch_cleanup', actor_id: null, target_id: null,
    target_table: null, payload: { deleted, failed }, visibility: [],
  } as never)

  return NextResponse.json({ ok: true, scanned: objects.length, deleted, failed })
}
