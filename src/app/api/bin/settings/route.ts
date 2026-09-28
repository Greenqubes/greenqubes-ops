import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getBinViewer } from '@/lib/supabase/queries/bin-viewer'
import { getRetention } from '@/lib/supabase/queries/job-bin'

// How long the bin keeps things — read by the delete confirmations so they
// can name the date. Any bin role; only Admin → Settings can change it.
export async function GET() {
  if (!(await getBinViewer())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ retention: await getRetention(createServiceClient()) })
}
