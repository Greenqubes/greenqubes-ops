import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { classifyPath } from '@/lib/auth/middleware-scope'

// This file MUST live in src/ — with the app under src/, Next.js ignores a middleware.ts
// at the repo root. It sat at the root (and silently never ran) until 2026-08-31.

export async function middleware(request: NextRequest) {
  const scope = classifyPath(request.nextUrl.pathname)
  if (scope === 'skip') return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refreshes the auth token — or clears a dead session. Required by @supabase/ssr
  // (server components cannot write cookies, so this is the only place a refreshed
  // token gets saved). Must run before any redirect decision.
  const { data: { user } } = await supabase.auth.getUser()

  // A redirect is a NEW response object: copy the cookies Supabase just set or cleared
  // onto it, otherwise a refreshed (or cleared) session never reaches the browser.
  function redirectTo(pathname: string, params?: Record<string, string>) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value)
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  // Signed-in users don't need the login page
  if (scope === 'login') {
    return user ? redirectTo('/') : supabaseResponse
  }

  // Everything else needs a signed-in user
  if (!user) return redirectTo('/login')

  // Soft-deleted users are signed out
  const { data: profile } = await supabase
    .from('users')
    .select('deleted_at')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (profile?.deleted_at) {
    await supabase.auth.signOut()
    return redirectTo('/login', { error: 'account_removed' })
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|presentation\.html|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
