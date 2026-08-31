/**
 * Standalone test for the Supabase session-cookie name rule (no test framework in this repo).
 * Run: npx tsx src/lib/auth/session-cookies.test.ts
 * Exits 1 on any failure.
 */

import { isSessionCookieName } from './session-cookies'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

console.log('session cookie names (the ones a stale login leaves behind)')
check('plain session cookie',            isSessionCookieName('sb-abc123-auth-token'),      true)
check('first chunk of a big session',    isSessionCookieName('sb-abc123-auth-token.0'),    true)
check('later chunk',                     isSessionCookieName('sb-abc123-auth-token.12'),   true)

console.log('never the one-time login code (PKCE code verifier)')
check('code verifier',                   isSessionCookieName('sb-abc123-auth-token-code-verifier'),   false)
check('chunked code verifier',           isSessionCookieName('sb-abc123-auth-token-code-verifier.0'), false)

console.log('unrelated cookies are left alone')
check('theme cookie',                    isSessionCookieName('theme'),                     false)
check('app localStorage-style key',      isSessionCookieName('overdue-seen:42'),           false)
check('other sb- cookie',                isSessionCookieName('sb-abc123-something-else'),  false)
check('empty name',                      isSessionCookieName(''),                          false)

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nall passed')
