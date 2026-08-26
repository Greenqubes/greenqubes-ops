import { createClient } from '@/lib/supabase/server'
import { copyObject, generateKey } from '@/lib/storage/r2'
import { JOB_BUCKETS, type JobBucket } from '@/lib/ai/tool-schemas'

// The assistant's ONE write action (Phase 3). Runs on the USER-SCOPED client:
// RLS is the real enforcement — the same insert rules as the New Job form in
// the browser. Mirrors NewJobShell exactly: pending status, strict
// punctuality default, the four default buckets, sales/scheduler visibility.
// Attachments are copied (R2 copyObject, like Duplicate) from the caller's
// scratch prefix into the job's folder and inserted as `files` rows with a
// bucket_id — scratch objects themselves are never files rows.

export interface CreateJobInput {
  project_title: string | null
  client:        string
  location:      string | null
  date:          string
  date_end:      string | null
  time_start:    string | null
  time_end:      string | null
  description:   string | null
  notes:         string | null
  production_instructions: string | null
  files:         { key: string; name: string; bucket: JobBucket }[]
}

export async function createPendingJobFromChat(
  input:  CreateJobInput,
  userId: string,
): Promise<{ jobId: string; filed: number; skipped: number } | null> {
  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from('jobs')
    .insert({
      status:                  'pending',
      sales_poc_id:            userId,
      project_title:           input.project_title,
      date:                    input.date,
      date_end:                input.date_end,
      time_start:              input.time_start,
      time_end:                input.time_end,
      client:                  input.client,
      location:                input.location ?? '',
      description:             input.description,
      production_ready:        false,
      do_issued:               false,
      punctuality:             'strict',
      production_instructions: input.production_instructions,
      notes:                   input.notes,
      visibility:              ['role:sales', 'role:scheduler'],
    } as never)
    .select('id, r2_folder')
    .single() as unknown as { data: { id: string; r2_folder: string | null } | null; error: unknown }
  if (error || !job) return null

  // Default buckets — same set, order and casing as the New Job form.
  const bucketIds = new Map<JobBucket, string>()
  for (let i = 0; i < JOB_BUCKETS.length; i++) {
    const { data: bucket } = await supabase
      .from('attachment_buckets')
      .insert({ job_id: job.id, name: JOB_BUCKETS[i], position: i } as never)
      .select('id')
      .single() as unknown as { data: { id: string } | null; error: unknown }
    if (bucket) bucketIds.set(JOB_BUCKETS[i], bucket.id)
  }

  let filed = 0, skipped = 0
  for (const f of input.files) {
    const bucketId = bucketIds.get(f.bucket) ?? bucketIds.get('OTHERS')
    if (!bucketId) { skipped++; continue }
    const destKey = generateKey(job.r2_folder ?? job.id, 'attachment', f.name)
    try {
      await copyObject(f.key, destKey)
    } catch {
      skipped++
      continue
    }
    const { error: fileError } = await supabase.from('files').insert({
      job_id:      job.id,
      bucket_id:   bucketId,
      kind:        'attachment',
      r2_key:      destKey,
      name:        f.name,
      uploader_id: userId,
      visibility:  ['public-internal'],
    } as never)
    if (fileError) skipped++
    else filed++
  }

  return { jobId: job.id, filed, skipped }
}
