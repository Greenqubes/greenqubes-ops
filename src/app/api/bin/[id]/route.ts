import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getBinViewer } from '@/lib/supabase/queries/bin-viewer'
import { canDeleteForever } from '@/lib/utils/bin-rules'
import { purgeBinEntry } from '@/lib/supabase/queries/job-bin'

// Delete forever — admin only, the safeguard (Nic, 2026-09-28).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await getBinViewer()
  if (!viewer || !canDeleteForever(viewer)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const result = await purgeBinEntry(createServiceClient(), id, viewer.id)
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, filesDeleted: result.filesDeleted })
}
