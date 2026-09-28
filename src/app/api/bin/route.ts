import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getBinViewer } from '@/lib/supabase/queries/bin-viewer'
import { listBin, getRetention } from '@/lib/supabase/queries/job-bin'
import { canSeeBinEntry, canRestoreBinEntry, emptiesOn } from '@/lib/utils/bin-rules'
import { isPendingStatus } from '@/lib/auth/pending-privacy'

// The bin, filtered to what this person may see (bin-rules.ts). Deleted
// drafts stay private exactly as live ones do (Nic, 2026-09-28).
export async function GET() {
  const viewer = await getBinViewer()
  if (!viewer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const svc = createServiceClient()
  const [rows, retention] = await Promise.all([listBin(svc), getRetention(svc)])

  const deleterIds = [...new Set(rows.map(r => r.deleted_by).filter(Boolean))] as string[]
  const { data: people } = deleterIds.length
    ? await svc.from('users').select('id, name').in('id', deleterIds)
    : { data: [] }
  const nameOf = new Map(((people ?? []) as { id: string; name: string }[]).map(p => [p.id, p.name]))

  const entries = rows
    .map(r => ({ r, access: { statusAtDelete: r.status_at_delete, deletedBy: r.deleted_by, sharerIds: r.sharer_ids } }))
    .filter(({ access }) => canSeeBinEntry(viewer, access))
    .map(({ r, access }) => {
      const canRestore = canRestoreBinEntry(viewer, access)
      const deletedByName = r.deleted_by ? (nameOf.get(r.deleted_by) ?? 'Unknown') : 'Unknown'
      return {
        id: r.id, jobId: r.job_id, title: r.title, client: r.client, jobDate: r.job_date,
        status: r.status_at_delete, deletedByName, deletedAt: r.deleted_at,
        emptiesOn: emptiesOn(r.deleted_at, retention), canRestore,
        restoreHint: canRestore || isPendingStatus(r.status_at_delete)
          ? null
          : `Only ${deletedByName}, a scheduler or an admin can restore this`,
      }
    })
  return NextResponse.json({ entries, retention })
}
