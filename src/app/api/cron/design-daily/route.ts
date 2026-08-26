import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { scoreDesignJob } from '@/lib/ai/design-score'
import { reminderDue } from '@/lib/utils/design-reminder'

// Called by Vercel cron daily at 08:30 SGT (see vercel.json). Manual run:
// GET with Authorization: Bearer <CRON_SECRET>.
//
// Fail-closed auth (2026-08-13 hardening rule — binding over the older
// fail-open crons like /api/notifications/overdue and asst-scratch-cleanup,
// which run open when CRON_SECRET is unset): an unset secret must 401,
// never run open.
//
// Part A — nightly sweep scoring: catches any briefed + assigned job the
// per-request triggers (brief save, assign, date change — design-score.ts)
// somehow missed, e.g. a job briefed before any designer was assigned.
// Part B — 3-day reminders: nudges each assigned designer on a job whose
// DESIGNER JO bucket has held a file for 3+ days and isn't ticked done yet.
// Cadence state lives entirely in the notifications table itself — the
// latest `design_reminder` row per (user_id, job_id) is `lastReminderAtISO`
// fed into reminderDue(); answering "No" in the drawer just marks that row
// read, so the next nudge is naturally >=3 days later. No extra columns.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  // ── Part A: sweep scoring ────────────────────────────────────────────────
  type SweepJob = { id: string }
  const { data: sweepCandidates } = await db
    .from('jobs')
    .select('id')
    .not('design_brief', 'is', null)
    .is('design_scored_at', null)
    .is('design_completed_at', null)
    .neq('status', 'completed') as { data: SweepJob[] | null; error: unknown }

  const sweepJobs = await withAssignedDesigners(db, sweepCandidates ?? [])

  let scored = 0
  for (const job of sweepJobs) {
    // Sequential — small volumes, keeps model-API rate limits calm.
    // scoreDesignJob never throws (design-score.ts's own try/catch).
    await scoreDesignJob(job.id, 'nightly')
    scored++
  }

  // ── Part B: 3-day reminders ──────────────────────────────────────────────
  type ReminderJob = { id: string; project_title: string | null }
  const { data: reminderCandidates } = await db
    .from('jobs')
    .select('id, project_title')
    .is('design_completed_at', null)
    .neq('status', 'completed') as { data: ReminderJob[] | null; error: unknown }

  const reminderJobs = await withAssignedDesigners(db, reminderCandidates ?? [])
  const jobIds = reminderJobs.map(j => j.id)

  let remindersSent = 0
  if (jobIds.length > 0) {
    // Designer assignments for these jobs (job_id → user_id[]).
    type AssignRow = { job_id: string; user_id: string }
    const { data: assignRows } = await db
      .from('job_designers')
      .select('job_id, user_id')
      .in('job_id', jobIds) as { data: AssignRow[] | null; error: unknown }
    const designersByJob = new Map<string, string[]>()
    for (const row of assignRows ?? []) {
      const list = designersByJob.get(row.job_id) ?? []
      list.push(row.user_id)
      designersByJob.set(row.job_id, list)
    }

    // Each job's DESIGNER JO bucket — matched with the same /designer\s*jo/i
    // regex the UI uses (AttachmentBuckets.tsx, JobDetailShell.tsx) and
    // src/app/api/jobs/[id]/design-complete/route.ts, not Postgres ilike
    // (which can't express \s* — "DESIGNERJO" with no space must match too).
    // Rows come back oldest-first so a second matching bucket (e.g. "Designer
    // JO 2") never displaces the original as the job's canonical one.
    type BucketRow = { id: string; job_id: string; name: string; created_at: string }
    const { data: bucketRows } = await db
      .from('attachment_buckets')
      .select('id, job_id, name, created_at')
      .in('job_id', jobIds)
      .order('created_at', { ascending: true }) as { data: BucketRow[] | null; error: unknown }
    const bucketByJob = new Map<string, string>()
    for (const row of bucketRows ?? []) {
      if (!/designer\s*jo/i.test(row.name)) continue
      if (!bucketByJob.has(row.job_id)) bucketByJob.set(row.job_id, row.id)
    }
    const bucketIds = [...bucketByJob.values()]

    // Earliest file ts per bucket = the JO-uploaded timestamp.
    const earliestFileByBucket = new Map<string, string>()
    if (bucketIds.length > 0) {
      type FileRow = { bucket_id: string; ts: string }
      const { data: fileRows } = await db
        .from('files')
        .select('bucket_id, ts')
        .in('bucket_id', bucketIds)
        .order('ts', { ascending: true }) as { data: FileRow[] | null; error: unknown }
      // Ascending order — first row seen per bucket is the earliest.
      for (const row of fileRows ?? []) {
        if (!earliestFileByBucket.has(row.bucket_id)) {
          earliestFileByBucket.set(row.bucket_id, row.ts)
        }
      }
    }

    // Latest design_reminder notification per (job_id, user_id) pair.
    type NotifRow = { job_id: string | null; user_id: string; created_at: string }
    const { data: notifRows } = await db
      .from('notifications')
      .select('job_id, user_id, created_at')
      .eq('type', 'design_reminder')
      .in('job_id', jobIds)
      .order('created_at', { ascending: false }) as { data: NotifRow[] | null; error: unknown }
    // Descending order — first row seen per pair is the latest.
    const lastReminderByPair = new Map<string, string>()
    for (const row of notifRows ?? []) {
      if (!row.job_id) continue
      const key = `${row.job_id}:${row.user_id}`
      if (!lastReminderByPair.has(key)) lastReminderByPair.set(key, row.created_at)
    }

    const nowISO = new Date().toISOString()
    type NewNotif = { user_id: string; type: string; job_id: string; title: string; body: string }
    const toInsert: NewNotif[] = []

    for (const job of reminderJobs) {
      const bucketId = bucketByJob.get(job.id)
      const joUploadedAtISO = bucketId ? (earliestFileByBucket.get(bucketId) ?? null) : null
      if (!joUploadedAtISO) continue // no JO file yet — nothing to nudge about

      for (const userId of designersByJob.get(job.id) ?? []) {
        const key = `${job.id}:${userId}`
        const due = reminderDue({
          joUploadedAtISO,
          completedAtISO:    null, // reminderJobs is already filtered to design_completed_at is null
          lastReminderAtISO: lastReminderByPair.get(key) ?? null,
          nowISO,
        })
        if (!due) continue
        toInsert.push({
          user_id: userId,
          type:    'design_reminder',
          job_id:  job.id,
          title:   job.project_title ?? 'Untitled job',
          body:    'design_reminder',
        })
      }
    }

    if (toInsert.length > 0) {
      await db.from('notifications').insert(toInsert as never)
      remindersSent = toInsert.length
    }
  }

  // Health-tab breadcrumb, same pattern as the overdue check / obsidian sync.
  await db.from('events').insert({
    kind: 'design_daily_cron', actor_id: null, target_id: null,
    target_table: null, payload: { scored, remindersSent }, visibility: [],
  } as never)

  return NextResponse.json({ ok: true, scored, remindersSent })
}

// Filters a list of {id, ...} jobs down to only those with >=1 job_designers
// row — one shared query per call site instead of repeating the join-table
// round trip inline in both Part A and Part B.
async function withAssignedDesigners<T extends { id: string }>(
  db:   ReturnType<typeof createServiceClient>,
  jobs: T[],
): Promise<T[]> {
  if (jobs.length === 0) return []
  const ids = jobs.map(j => j.id)
  type AssignRow = { job_id: string }
  const { data } = await db
    .from('job_designers')
    .select('job_id')
    .in('job_id', ids) as { data: AssignRow[] | null; error: unknown }
  const assignedIds = new Set((data ?? []).map(row => row.job_id))
  return jobs.filter(j => assignedIds.has(j.id))
}
