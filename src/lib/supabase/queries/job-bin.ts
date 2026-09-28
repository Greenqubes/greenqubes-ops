import type { createServiceClient } from '@/lib/supabase/service'
import { deleteObject } from '@/lib/storage/r2'
import { BIN_CHILD_TABLES, snapshotUserIds, snapshotR2Keys, type JobSnapshot, type Row } from '@/lib/utils/bin-snapshot'
import { pendingSharerIds } from '@/lib/auth/pending-privacy'
import { parseRetention, emptiesOn, type RetentionKey } from '@/lib/utils/bin-rules'
import { purgeClaimed } from '@/lib/utils/bin-purge'

/**
 * The job bin, server side (spec 2026-09-28-job-bin-design.md). Every
 * function takes the SERVICE client: job_bin and app_settings have no RLS
 * policies at all, and callers have already decided who may do what with
 * src/lib/utils/bin-rules.ts.
 */

type Svc = ReturnType<typeof createServiceClient>

export async function buildSnapshot(svc: Svc, jobId: string): Promise<JobSnapshot | null> {
  const { data: job, error } = await svc.from('jobs').select('*').eq('id', jobId).maybeSingle()
  if (error || !job) return null
  const children = {} as JobSnapshot['children']
  for (const t of BIN_CHILD_TABLES) {
    const { data, error: e } = await svc.from(t).select('*').eq('job_id', jobId)
    if (e) throw new Error(`snapshot ${t}: ${e.message}`)
    children[t] = (data ?? []) as Row[]
  }
  const snap: JobSnapshot = { version: 1, job: job as Row, children, people: {} }
  const ids = snapshotUserIds(snap)
  if (ids.length) {
    const { data: people } = await svc.from('users').select('id, name').in('id', ids)
    for (const p of (people ?? []) as { id: string; name: string }[]) snap.people[p.id] = p.name
  }
  return snap
}

export async function getRetention(svc: Svc): Promise<RetentionKey> {
  const { data } = await svc.from('app_settings' as never).select('value').eq('key', 'bin_retention').maybeSingle()
  return parseRetention((data as { value: unknown } | null)?.value)
}

export async function setRetention(svc: Svc, key: RetentionKey, by: string): Promise<void> {
  const { error } = await svc.from('app_settings' as never)
    .upsert({ key: 'bin_retention', value: key, updated_at: new Date().toISOString(), updated_by: by } as never)
  if (error) throw error
}

export async function moveJobToBin(
  svc: Svc, jobId: string, deletedBy: string,
): Promise<{ binId: string; emptiesOn: string } | { error: string; status: number }> {
  let snap: JobSnapshot | null
  try { snap = await buildSnapshot(svc, jobId) } catch { return { error: 'Could not copy the job to the bin', status: 500 } }
  if (!snap) return { error: 'Not found', status: 404 }

  const j = snap.job as {
    project_title?: string | null; client?: string | null; date?: string | null
    status: string; created_by: string | null; sales_poc_id: string | null
  }
  const sharers = pendingSharerIds({
    status: j.status, created_by: j.created_by, sales_poc_id: j.sales_poc_id,
    coordinatorIds: snap.children.job_coordinators.map(c => c.user_id as string),
  })

  // The copy is written FIRST. If it fails, the job is not deleted.
  const { data: bin, error: binErr } = await svc.from('job_bin' as never).insert({
    job_id: jobId, title: j.project_title ?? null, client: j.client ?? null, job_date: j.date ?? null,
    status_at_delete: j.status, deleted_by: deletedBy, sharer_ids: sharers,
    r2_keys: snapshotR2Keys(snap), snapshot: snap,
  } as never).select('id, deleted_at').single()
  if (binErr || !bin) return { error: 'Could not copy the job to the bin', status: 500 }
  const binRow = bin as { id: string; deleted_at: string }

  const { data: gone, error: delErr } = await svc.from('jobs').delete().eq('id', jobId).select('id')
  if (delErr || !gone?.length) {
    // Never leave a copy of a job that still exists — it could be restored
    // on top of itself later.
    await svc.from('job_bin' as never).delete().eq('id', binRow.id)
    return { error: delErr ? 'Delete failed' : 'Not found', status: delErr ? 500 : 404 }
  }

  await svc.from('events').insert({
    kind: 'job_deleted', actor_id: deletedBy, target_id: jobId, target_table: 'jobs',
    payload: { title: j.project_title ?? null, client: j.client ?? null, date: j.date ?? null, status: j.status, bin_id: binRow.id },
    visibility: [],
  } as never)

  return { binId: binRow.id, emptiesOn: emptiesOn(binRow.deleted_at, await getRetention(svc)) }
}

export type BinRow = {
  id: string; job_id: string; title: string | null; client: string | null; job_date: string | null
  status_at_delete: string; deleted_by: string | null; deleted_at: string; sharer_ids: string[]; r2_keys: string[]
}

export async function listBin(svc: Svc): Promise<BinRow[]> {
  const { data, error } = await svc.from('job_bin' as never)
    .select('id, job_id, title, client, job_date, status_at_delete, deleted_by, deleted_at, sharer_ids, r2_keys')
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as BinRow[]
}

/** Empty one bin entry for good. The row is CLAIMED first — deleted, with its
 *  R2 keys handed back in the same statement — and only then are the files
 *  deleted (see bin-purge.ts for why that order). A restore racing this finds
 *  no row and fails cleanly; a file that fails to delete is left orphaned and
 *  logged, never a restorable job whose files are gone. */
export async function purgeBinEntry(
  svc: Svc, binId: string, actorId: string | null,
): Promise<{ filesDeleted: number; filesFailed: number } | null> {
  let row: { id: string; job_id: string; title: string | null; r2_keys: string[] } | null = null
  const result = await purgeClaimed(
    async () => {
      const { data, error } = await svc.from('job_bin' as never).delete().eq('id', binId)
        .select('id, job_id, title, r2_keys')
      if (error) throw error
      row = ((data ?? []) as unknown as NonNullable<typeof row>[])[0] ?? null
      return row ? row.r2_keys : null
    },
    async key => {
      try { await deleteObject(key) }
      catch (e) { console.error(`[bin/purge] bin=${binId} left R2 object ${key}`); throw e }
    },
  )
  if (!result || !row) return null
  const { filesDeleted, filesFailed } = result
  const claimed = row as { job_id: string; title: string | null }
  await svc.from('events').insert({
    kind: 'job_purged', actor_id: actorId, target_id: claimed.job_id, target_table: 'jobs',
    payload: { title: claimed.title, files_deleted: filesDeleted, files_failed: filesFailed }, visibility: [],
  } as never)
  return { filesDeleted, filesFailed }
}
