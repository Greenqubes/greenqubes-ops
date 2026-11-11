import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@/lib/supabase/server'

// Admin → Settings → Old jobsheet → Copy script (final review #12): the Apps
// Script Nic pastes into the sheet, served from the app so setting it up never
// needs access to the private GitHub repo. The file ships with this route via
// next.config.ts outputFileTracingIncludes. Real admin role only.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: profile } = await supabase.from('users').select('role')
    .eq('auth_id', user.id).maybeSingle() as { data: { role: string } | null; error: unknown }
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const text = await readFile(join(process.cwd(), 'scripts', 'google-sheet', 'jobsheet-sync.gs'), 'utf8')
    return new NextResponse(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Script not found' }, { status: 500 })
  }
}
