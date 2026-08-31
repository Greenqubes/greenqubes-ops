import { cookies }             from 'next/headers'
import { createClient }        from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isSessionCookieName } from '@/lib/auth/session-cookies'
import { NextResponse }        from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    // Supabase/Google sent us back without a code — record what they sent instead.
    console.error('[auth/callback] no code in callback URL', {
      error:             searchParams.get('error'),
      error_code:        searchParams.get('error_code'),
      error_description: searchParams.get('error_description'),
    })
  }

  if (code) {
    // A stale session cookie (an old login whose refresh key is dead) makes the Supabase
    // client try — and fail — to refresh it in the background while the code exchange
    // runs; that failure wipes the one-time code-verifier cookie mid-flight and the
    // login bounces with ?error=auth. The exchange never needs the old session: drop it
    // first so the client starts clean (the deletions also reach the browser).
    const cookieStore = await cookies()
    for (const { name } of cookieStore.getAll()) {
      if (isSessionCookieName(name)) cookieStore.delete(name)
    }

    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !session) {
      // Was the one-time PKCE code-verifier cookie still on the request when we got here?
      const cookieHeader = request.headers.get('cookie') ?? ''
      const verifier = /auth-token-code-verifier=([^;]*)/.exec(cookieHeader)?.[1]
      console.error('[auth/callback] code exchange failed:', {
        name:            error?.name,
        message:         error?.message,
        code:            error && 'code' in error ? (error as { code?: string }).code : undefined,
        verifierCookie:  verifier === undefined ? 'absent' : `${verifier.length} chars`,
      })
    }

    if (!error && session) {
      const email  = session.user.email?.toLowerCase()
      const authId = session.user.id
      const db = createServiceClient()

      // Check if user has been soft-deleted
      const { data: user, error: lookupError } = await db
        .from('users')
        .select('deleted_at')
        .eq('auth_id', authId)
        .maybeSingle()

      if (!lookupError && user !== null && user.deleted_at !== null) {
        // User is soft-deleted; sign them out and redirect
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=account_removed`)
      }

      if (email) {
        // Link auth_id to any pre-provisioned row that matches this email.
        // Uses service role client because RLS does not allow users to update their own auth_id.
        // Only link if the row is not deleted.
        const { error: linkError } = await db
          .from('users')
          .update({ auth_id: authId })
          .eq('email', email)
          .is('auth_id', null)
          .is('deleted_at', null)
        if (linkError) console.error('[auth/callback] auth_id link failed:', linkError.message)
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
