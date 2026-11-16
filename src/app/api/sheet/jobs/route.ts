import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSheetKey, getWeekSheet } from '@/lib/supabase/queries/jobsheet'
import { keysMatch } from '@/lib/utils/jobsheet-key'
import { buildWeekRows, parseWeek, SHEET_COLUMNS } from '@/lib/utils/jobsheet-rows'
import { buildPaintedWeek } from '@/lib/utils/jobsheet-layout'

/**
 * GET /api/sheet/jobs?key=…&week=YYYY-MM-DD — one week of scheduled jobs for
 * Nic's old "Greenqubes Jobs" Google Sheet (spec 2026-11-11 Part 2). Read by
 * the Apps Script inside that sheet (scripts/google-sheet/jobsheet-sync.gs),
 * which rewrites each week's tab whole with these rows (full automation,
 * Nic 2026-11-12).
 *
 * No login: src/middleware.ts skips /api/*, and Google calls this from its
 * own servers. The secret key (Admin → Settings) is the whole gate, so it is
 * checked FIRST, in constant time, and a wrong or missing key gets the same
 * bare 404 as a page that doesn't exist.
 */
export async function GET(req: NextRequest) {
  const svc = createServiceClient()
  const params = req.nextUrl.searchParams
  if (!keysMatch(params.get('key'), await getSheetKey(svc))) {
    return new NextResponse('Not found', { status: 404 })
  }

  const week = parseWeek(params.get('week'))
  if (!week) return NextResponse.json({ error: 'bad_week' }, { status: 400 })

  const data = await getWeekSheet(svc, week)
  const headers = { 'Cache-Control': 'no-store' }

  // Script v2 (the scheduler's layout, Nic 2026-11-16) asks for layout=2 and
  // gets every cell painted. Anything else — the script already in the sheet —
  // gets the earlier answer unchanged, so the live sheet only changes once
  // Nic pastes v2. Delete this older path once the real sheet runs v2.
  if (params.get('layout') === '2') {
    return NextResponse.json(buildPaintedWeek({ monday: week, now: new Date(), ...data }), { headers })
  }
  return NextResponse.json(
    { week, columns: SHEET_COLUMNS, rows: buildWeekRows(week, data.jobs, data.leaves) },
    { headers },
  )
}
