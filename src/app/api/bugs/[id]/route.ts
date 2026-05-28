import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { markBugFixed, getBugMarkdownFile, deleteBugReport } from '@/lib/supabase/queries/bugs'
import { rename, mkdir }             from 'fs/promises'
import path                          from 'path'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params

    // Move markdown file into {version}/fixed/ when marking fixed
    // markdown_file stores the relative path: "{version}/bugs_{role}_{date}_{N}.md"
    // becomes: "{version}/fixed/bugs_{role}_{date}_{N}.md"
    const dir = process.env.BUG_LOG_DIR
    if (dir) {
      const relativePath = await getBugMarkdownFile(id)
      if (relativePath) {
        try {
          const versionDir = path.dirname(relativePath)           // e.g. "pre-alpha"
          const filename   = path.basename(relativePath)          // e.g. "bugs_scheduler_..."
          const fixedDir   = path.join(dir, versionDir, 'fixed')
          await mkdir(fixedDir, { recursive: true })
          await rename(
            path.join(dir, versionDir, filename),
            path.join(fixedDir, filename),
          )
        } catch { /* file may not exist in all environments */ }
      }
    }

    await markBugFixed(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params
    await deleteBugReport(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
