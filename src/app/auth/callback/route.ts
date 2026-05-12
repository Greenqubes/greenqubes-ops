import { createClient }        from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse }        from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && session) {
      const email  = session.user.email?.toLowerCase()
      const authId = session.user.id

      if (email) {
        // Link auth_id to any pre-provisioned row that matches this email.
        // Uses service role client because RLS does not allow users to update their own auth_id.
        const db = createServiceClient()
        const { error: linkError } = await db
          .from('users')
          .update({ auth_id: authId })
          .eq('email', email)
          .is('auth_id', null)
        if (linkError) console.error('[auth/callback] auth_id link failed:', linkError.message)
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
