import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getBinViewer } from '@/lib/supabase/queries/bin-viewer'
import { canRestoreBinEntry } from '@/lib/utils/bin-rules'
import { prepareRestore, type JobSnapshot } from '@/lib/utils/bin-snapshot'

// Put a binned job back exactly as it was (Nic, 2026-09-28). One RPC call =
// one transaction, so a failure leaves the job in the bin and nothing half on
// the schedule. No Telegram — deleting told nobody either.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getBinViewer()
  if (!viewer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const svc = createServiceClient()

  const { data } = await svc.from('job_bin' as never)
    .select('id, job_id, status_at_delete, deleted_by, sharer_ids, snapshot').eq('id', id).maybeSingle()
  const entry = data as {
    id: string; job_id: string; status_at_delete: string; deleted_by: string | null
    sharer_ids: string[]; snapshot: JobSnapshot
  } | null
  if (!entry) return NextResponse.json({ error: 'Already restored or emptied' }, { status: 404 })
  if (!canRestoreBinEntry(viewer, { statusAtDelete: entry.status_at_delete, deletedBy: entry.deleted_by, sharerIds: entry.sharer_ids })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [{ data: users }, { data: contacts }] = await Promise.all([
    svc.from('users').select('id'),
    svc.from('external_contacts').select('id'),
  ])
  const { snapshot, leftOff } = prepareRestore(
    entry.snapshot,
    new Set(((users ?? []) as { id: string }[]).map(u => u.id)),
    new Set(((contacts ?? []) as { id: string }[]).map(c => c.id)),
  )

  const { error } = await svc.rpc('restore_job_snapshot' as never, { p_bin_id: entry.id, p_snapshot: snapshot } as never)
  if (error) {
    console.error(`[bin/restore] bin=${entry.id} job=${entry.job_id}: ${error.message}`)
    return NextResponse.json({ error: 'Restore failed — the job is still in the bin' }, { status: 500 })
  }

  await svc.from('events').insert({
    kind: 'job_restored', actor_id: viewer.id, target_id: entry.job_id, target_table: 'jobs',
    payload: { bin_id: entry.id, status: entry.status_at_delete, left_off: leftOff }, visibility: [],
  } as never)
  return NextResponse.json({ jobId: entry.job_id, status: entry.status_at_delete, leftOff })
}
