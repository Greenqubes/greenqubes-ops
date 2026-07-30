import { NextRequest, NextResponse } from 'next/server'
import { getContactByToken, getContactJobs } from '@/lib/supabase/queries/external'

// PUBLIC route — no session. The unguessable token is the identity.
// 404 = token never existed, 410 = contact was deleted (link invalidated).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const check = await getContactByToken(token)
  if (check.state === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (check.state === 'deleted')   return NextResponse.json({ error: 'invalid' },   { status: 410 })

  const jobs = await getContactJobs(check.contact.id)
  return NextResponse.json({ contact: { name: check.contact.name }, jobs })
}
