import { NextRequest, NextResponse } from 'next/server'
import { autofixSecretOk } from '@/lib/autofix/auth'
import { getBugReport } from '@/lib/autofix/store'
import { getDownloadUrl } from '@/lib/storage/r2'
import { getBugBotFileUrl } from '@/lib/telegram/bot'

// Bytes for the cloud fixer: a bug report's screenshot (?bug=<id>) or a photo
// Nic sent the bug bot (?tg=<file_id>). Served through the app so the cloud
// needs no other host allowed, and never sees the R2 keys or the bot token.
export const dynamic = 'force-dynamic'

const MAX_BYTES = 15 * 1024 * 1024

export async function GET(req: NextRequest) {
  if (!autofixSecretOk(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const bugId = req.nextUrl.searchParams.get('bug')
  const tg    = req.nextUrl.searchParams.get('tg')

  let source: string | null = null
  if (bugId) {
    const bug = await getBugReport(bugId)
    if (bug?.screenshot_key) source = await getDownloadUrl(bug.screenshot_key)
  } else if (tg) {
    source = await getBugBotFileUrl(tg)
  }
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const res = await fetch(source, { cache: 'no-store' })
  if (!res.ok || !res.body) return NextResponse.json({ error: 'Could not fetch the file' }, { status: 502 })
  const length = Number(res.headers.get('content-length') ?? 0)
  if (length > MAX_BYTES) return NextResponse.json({ error: 'File too large' }, { status: 413 })
  return new NextResponse(res.body, {
    headers: {
      'Content-Type':  res.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    },
  })
}
