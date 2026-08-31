/**
 * Decides what the middleware does with a request path.
 *
 * - `skip`  — no auth work at all. API routes check the login themselves (and crons,
 *             webhooks and the signed digest link have no login to check); external
 *             installer links are public by design; the OAuth callback must not be
 *             touched (a session refresh there can wipe the one-time login code);
 *             the historical mockups are static files.
 * - `login` — the sign-in page: refresh cookies, and bounce already-signed-in users home.
 * - `page`  — everything else: requires a signed-in, non-removed user.
 */
export type MiddlewareScope = 'skip' | 'login' | 'page'

const SKIP_PREFIXES = ['/api/', '/ext/', '/auth/', '/mockups/']

export function classifyPath(pathname: string): MiddlewareScope {
  if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return 'skip'
  if (pathname === '/login') return 'login'
  return 'page'
}
