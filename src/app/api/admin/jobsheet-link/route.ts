import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSheetKey, setSheetKey } from '@/lib/supabase/queries/jobsheet'
import { newSheetKey, sheetLink } from '@/lib/utils/jobsheet-key'

// Admin → Settings → Old jobsheet (spec 2026-11-11 Part 2). Shows the private
// link the Google Sheet's script reads, and makes a new one (the old one dies
// at once). Real admin role only — the link reveals job and client details.
// Always points at production: previews share the database, and Google can't
// reach a preview anyway (Vercel SSO).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

/** The admin's own user id, or null. Real role, like every admin route. */
async function guardAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string; role: string } | null; error: unknown }
  return profile?.role === 'admin' ? profile.id : null
}

export async function GET() {
  if (!(await guardAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const key = await getSheetKey(createServiceClient())
  return NextResponse.json({ link: key ? sheetLink(APP_URL, key) : null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST() {
  const adminId = await guardAdmin()
  if (!adminId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const key = newSheetKey()
  await setSheetKey(createServiceClient(), key, adminId)
  return NextResponse.json({ link: sheetLink(APP_URL, key) }, { headers: { 'Cache-Control': 'no-store' } })
}
