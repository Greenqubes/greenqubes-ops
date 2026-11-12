import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSheetKey, getWeekSheet } from '@/lib/supabase/queries/jobsheet'
import { keysMatch } from '@/lib/utils/jobsheet-key'
import { buildWeekRows, parseWeek, SHEET_COLUMNS } from '@/lib/utils/jobsheet-rows'

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

  const { jobs, leaves } = await getWeekSheet(svc, week)
  return NextResponse.json(
    { week, columns: SHEET_COLUMNS, rows: buildWeekRows(week, jobs, leaves) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
