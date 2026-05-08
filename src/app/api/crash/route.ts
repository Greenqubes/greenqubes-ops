import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { writeFile, mkdir }          from 'fs/promises'
import path                          from 'path'

type CrashPayload = {
  route:           string
  errorMessage:    string
  stackTrace?:     string
  componentStack?: string
  userEmail?:      string
  digest?:         string
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

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json() as CrashPayload
    const ua       = req.headers.get('user-agent') ?? ''
    const markdown = buildMarkdown(body, ua)
    const db       = createServiceClient()

    await db.from('crash_logs').insert({
      route:           body.route        || '/',
      error_message:   body.errorMessage || 'Unknown error',
      stack_trace:     body.stackTrace   ?? null,
      component_stack: body.componentStack ?? null,
      user_email:      body.userEmail    ?? null,
      user_agent:      ua                || null,
      markdown_body:   markdown,
    })

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
