/**
 * Supabase stores the browser session in cookies named `sb-<project-ref>-auth-token`
 * (split into `.0`, `.1`, … chunks when large). The one-time PKCE login code lives in
 * `sb-<project-ref>-auth-token-code-verifier` and must never be treated as a session.
 */
export function isSessionCookieName(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token') && !name.includes('-code-verifier')
}
