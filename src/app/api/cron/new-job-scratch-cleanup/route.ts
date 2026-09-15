import { NextRequest, NextResponse } from 'next/server'
import { listObjects, deleteObject } from '@/lib/storage/r2'
import { NEW_JOB_PREFIX } from '@/lib/storage/new-job-attachments'

const MAX_AGE_DAYS = 7

// Sweeps files uploaded on the New Job form that never became a job
// (new-job/…) — someone opened the form, attached something, and closed the
// tab. Nic's reason for choosing a holding area over keeping files in the
// browser: "if pending job is discarded, so is the file" (2026-09-15).
//
// Safe by construction, the same way the assistant's scratch cleanup is:
// objects under this prefix are NEVER `files` rows. Anything a created job
// needed was COPIED into that job's own folder and the holding-area copy
// deleted on the spot, so this can only ever remove abandoned uploads.
//
// 7 days, not the assistant's 30: a half-filled New Job form is abandoned
// within a session, whereas an assistant chat is worth keeping context for.
//
// Called by Vercel cron daily at 03:30 SGT — see vercel.json.
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
  const objects = await listObjects(NEW_JOB_PREFIX)

  let deleted = 0, failed = 0
  for (const obj of objects) {
    if (!obj.lastModified || obj.lastModified.getTime() > cutoff) continue
    try {
      await deleteObject(obj.key)
      deleted++
    } catch {
      failed++
    }
  }

  return NextResponse.json({ scanned: objects.length, deleted, failed })
}
