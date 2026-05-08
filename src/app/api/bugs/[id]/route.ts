import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'
import { markBugFixed, getBugMarkdownFile } from '@/lib/supabase/queries/bugs'
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

    if (profile?.role !== 'scheduler') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Move markdown file to bugs_fixed/ subfolder if BUG_LOG_DIR is set
    const dir = process.env.BUG_LOG_DIR
    if (dir) {
      const filename = await getBugMarkdownFile(id)
      if (filename) {
        try {
          const fixedDir = path.join(dir, 'bugs_fixed')
          await mkdir(fixedDir, { recursive: true })
          await rename(path.join(dir, filename), path.join(fixedDir, filename))
        } catch { /* file may not exist in all environments */ }
      }
    }

    await markBugFixed(id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
