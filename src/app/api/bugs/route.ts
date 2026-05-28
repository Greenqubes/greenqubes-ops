import { NextRequest, NextResponse }       from 'next/server'
import { createClient }                    from '@/lib/supabase/server'
import { insertBugReport, getBugReports, countBugReportsForDate } from '@/lib/supabase/queries/bugs'
import { sendBugTelegram }                 from '@/lib/telegram/bot'
import { tplBugReport }                    from '@/lib/telegram/templates'
import { getDownloadUrl }                  from '@/lib/storage/r2'
import { writeFile, mkdir }               from 'fs/promises'
import path                               from 'path'

type BugPayload = {
  message:       string
  priority:      'low' | 'medium' | 'high' | 'urgent'
  screenshotKey: string | null
  route:         string
  screen:        string
}

function parseBrowser(ua: string): { platform: string; browser: string; os: string } {
  const isMobile  = /Mobile|Android|iPhone|iPad/i.test(ua)
  const platform  = isMobile ? 'Mobile' : 'Desktop'

  let browser = 'Unknown'
  if (/Edg\//i.test(ua))     browser = 'Edge'
  else if (/OPR\//i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua)) {
    const m = ua.match(/Chrome\/([\d.]+)/)
    browser = `Chrome${m ? ' ' + m[1].split('.')[0] : ''}`
  } else if (/Firefox\//i.test(ua)) {
    const m = ua.match(/Firefox\/([\d.]+)/)
    browser = `Firefox${m ? ' ' + m[1].split('.')[0] : ''}`
  } else if (/Safari\//i.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/)
    browser = `Safari${m ? ' ' + m[1].split('.')[0] : ''}`
  }

  let os = 'Unknown'
  if (/iPhone/i.test(ua))       os = 'iOS'
  else if (/iPad/i.test(ua))    os = 'iPadOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Linux/i.test(ua))   os = 'Linux'

  const device = isMobile
    ? ((/iPhone/i.test(ua) ? 'iPhone' : /iPad/i.test(ua) ? 'iPad' : 'Android'))
    : ''
  const platformStr = device ? `${platform} · ${device} · ${browser}` : `${platform} · ${browser}`

  return { platform: platformStr, browser, os }
}

function toSGT(date: Date): string {
  return date.toLocaleString('en-SG', {
    day:      '2-digit',
    month:    'short',
    year:     'numeric',
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'Asia/Singapore',
  }) + ' SGT'
}

function buildMarkdown(p: {
  priority:      string
  sgtTime:       string
  userEmail:     string
  userRole:      string
  route:         string
  ip:            string
  platform:      string
  os:            string
  screen:        string
  screenshotUrl: string
  message:       string
}): string {
  return [
    `# Bug Report — ${p.priority.toUpperCase()} — ${p.sgtTime}`,
    '',
    `**Time:** ${p.sgtTime}`,
    `**User:** ${p.userEmail} (${p.userRole})`,
    `**Page:** ${p.route}`,
    `**Priority:** ${p.priority}`,
    `**IP:** ${p.ip}`,
    `**Platform:** ${p.platform}`,
    `**OS:** ${p.os}`,
    `**Screen:** ${p.screen}`,
    `**Screenshot:** ${p.screenshotUrl || 'none'}`,
    '',
    '## Description',
    '',
    p.message,
  ].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle() as { data: { role: string } | null; error: unknown }

    const userEmail = user.email ?? 'unknown'
    const userRole  = profile?.role ?? 'unknown'

    const body = await req.json() as BugPayload
    if (!body.message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 })
    }
    const validPriorities = ['low', 'medium', 'high', 'urgent']
    if (!validPriorities.includes(body.priority)) {
      return NextResponse.json({ error: 'invalid priority' }, { status: 400 })
    }

    const ua       = req.headers.get('user-agent') ?? ''
    const ip       = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    const now      = new Date()
    const sgtTime  = toSGT(now)
    const { platform, os } = parseBrowser(ua)

    // Screenshot download URL for Telegram (if screenshot was uploaded)
    let screenshotUrl = ''
    if (body.screenshotKey) {
      try { screenshotUrl = await getDownloadUrl(body.screenshotKey) } catch { /* best-effort */ }
    }

    const markdown = buildMarkdown({
      priority: body.priority, sgtTime, userEmail, userRole,
      route:    body.route, ip, platform, os,
      screen:   body.screen, screenshotUrl, message: body.message,
    })

    // Build filename + version-scoped relative path
    // Structure: {version}/bugs_{role}_{YYYY-MM-DD}_{N}.md
    const version      = process.env.APP_VERSION ?? 'pre-alpha'
    const dateStr      = now.toISOString().slice(0, 10)
    const countToday   = await countBugReportsForDate(dateStr)
    const filename     = `bugs_${userRole}_${dateStr}_${countToday + 1}.md`
    const relativePath = `${version}/${filename}`

    const id = await insertBugReport({
      user_email:     userEmail,
      user_role:      userRole,
      route:          body.route,
      message:        body.message,
      priority:       body.priority,
      screenshot_key: body.screenshotKey ?? null,
      markdown_file:  relativePath,
      ip_address:     ip,
      platform,
      browser:        parseBrowser(ua).browser,
      os,
      screen:         body.screen,
    })

    if (!id) return NextResponse.json({ error: 'Failed to save bug report' }, { status: 500 })

    // Write markdown file (dev only — BUG_LOG_DIR env var must be set)
    // Final path: {BUG_LOG_DIR}/{version}/bugs_{role}_{date}_{N}.md
    const dir = process.env.BUG_LOG_DIR
    if (dir) {
      try {
        const versionDir = path.join(dir, version)
        await mkdir(versionDir, { recursive: true })
        await writeFile(path.join(versionDir, filename), markdown, 'utf8')
      } catch (e) {
        console.error('[bugs] failed to write markdown file', e)
      }
    }

    // Telegram notification (best-effort)
    try {
      const tgMsg = tplBugReport({
        priority:      body.priority,
        sgtTime,
        platform,
        os,
        userEmail,
        userRole,
        route:         body.route,
        message:       body.message,
        screenshotUrl: screenshotUrl || undefined,
      })
      await sendBugTelegram(tgMsg)
    } catch (e) {
      console.error('[bugs] telegram failed', e)
    }

    return NextResponse.json({ ok: true, id })
  } catch (e) {
    console.error('[bugs] POST error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .maybeSingle() as { data: { role: string } | null; error: unknown }

    if (profile?.role !== 'scheduler' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const bugs = await getBugReports()
    return NextResponse.json(bugs)
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
