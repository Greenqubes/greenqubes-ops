import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { withoutBuildIdOnMissingColumn } from '@/lib/autofix/fail-soft'
import { writeFile, mkdir }          from 'fs/promises'
import path                          from 'path'

type CrashPayload = {
  route:           string
  errorMessage:    string
  stackTrace?:     string
  componentStack?: string
  userEmail?:      string  // ignored — the session decides who crashed
  digest?:         string
  buildId?:        string
}

function buildMarkdown(p: CrashPayload, ua: string): string {
  const sgt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const ts  = sgt.toISOString().replace('T', ' ').slice(0, 16) + ' SGT'

  const lines = [
    `# Crash — ${ts}`,
    '',
    `**Route:** ${p.route}`,
    `**User:** ${p.userEmail ?? 'unknown'}`,
    `**UA:** ${ua.slice(0, 120)}`,
  ]

  if (p.buildId) {
    lines.push(`**Build:** \`${p.buildId}\``)
  }

  if (p.digest) {
    lines.push(`**Digest:** \`${p.digest}\``)
  }

  lines.push('', '## Error', p.errorMessage)

  if (p.stackTrace) {
    lines.push('', '## Stack', '```', p.stackTrace.slice(0, 3000), '```')
  }
  if (p.componentStack) {
    lines.push('', '## Component stack', '```', p.componentStack.slice(0, 1500), '```')
  }

  return lines.join('\n')
}

// Who was looking at the screen when it crashed — read from their session,
// never from the request body (anyone can type an email into a request).
// Nic, 2026-11-04: "add which user that encounter that crash too so i know
// which desk its from." A crash while signed out stays anonymous, and a
// failed lookup never stops the crash being logged.
async function whoCrashed(db: ReturnType<typeof createServiceClient>): Promise<{ id: string | null; email: string | null }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { id: null, email: null }
    const { data } = await db.from('users').select('id, email').eq('auth_id', user.id).maybeSingle()
    const row = data as { id: string; email: string | null } | null
    return { id: row?.id ?? null, email: row?.email ?? user.email ?? null }
  } catch {
    return { id: null, email: null }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json() as CrashPayload
    const ua       = req.headers.get('user-agent') ?? ''
    const db       = createServiceClient()
    const who      = await whoCrashed(db)
    const markdown = buildMarkdown({ ...body, userEmail: who.email ?? undefined }, ua)
    // Which copy of the app crashed — the same stamp /api/version reports.
    const buildId  = typeof body.buildId === 'string' && /^([0-9a-f]{12}|dev)$/.test(body.buildId) ? body.buildId : null

    const { error } = await withoutBuildIdOnMissingColumn({
      route:           body.route        || '/',
      error_message:   body.errorMessage || 'Unknown error',
      stack_trace:     body.stackTrace   ?? null,
      component_stack: body.componentStack ?? null,
      user_id:         who.id,
      user_email:      who.email,
      user_agent:      ua                || null,
      markdown_body:   markdown,
      build_id:        buildId,
    }, async row => db.from('crash_logs').insert(row as never))
    if (error) console.error('[crash] insert failed', error)

    // Dev only: write .md file when CRASH_LOG_DIR is set
    const dir = process.env.CRASH_LOG_DIR
    if (dir) {
      const name = `crash-${new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')}.txt`
      await mkdir(dir, { recursive: true })
      await writeFile(path.join(dir, name), markdown, 'utf8')
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
