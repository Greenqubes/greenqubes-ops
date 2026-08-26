/**
 * Standalone test for the Telegram link-token signer (no test framework in this repo).
 * Run: npx tsx src/lib/telegram/link-token.test.ts
 * Exits 1 on any failure.
 */

process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token-123:ABCdef'

import { createLinkToken, verifyLinkToken } from './link-token'

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

const USER_ID = '3f2b8c1e-9a4d-4e7f-b2a1-6c5d8e9f0a1b'

// 1. Round-trip: create → verify returns the same user id
{
  const token = createLinkToken(USER_ID)
  check('token created', typeof token, 'string')
  check('round-trip returns user id', verifyLinkToken(token!), USER_ID)
}

// 2. Token fits Telegram's /start payload rules (A-Za-z0-9_- only, max 64 chars)
{
  const token = createLinkToken(USER_ID)!
  check('token length ≤ 64', token.length <= 64, true)
  check('token charset is base64url', /^[A-Za-z0-9_-]+$/.test(token), true)
}

// 3. Tampered token is rejected
{
  const token = createLinkToken(USER_ID)!
  const flipped = (token[0] === 'A' ? 'B' : 'A') + token.slice(1)
  check('tampered payload rejected', verifyLinkToken(flipped), null)
  const badSig = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A')
  check('tampered signature rejected', verifyLinkToken(badSig), null)
}

// 4. Garbage inputs are rejected, never throw
{
  check('empty string rejected', verifyLinkToken(''), null)
  check('short token rejected', verifyLinkToken('abc'), null)
  check('overlong token rejected', verifyLinkToken('A'.repeat(100)), null)
  check('non-base64url rejected', verifyLinkToken('!'.repeat(42)), null)
}

// 5. Invalid uuid input to create is rejected
{
  check('non-uuid create rejected', createLinkToken('not-a-uuid'), null)
  check('empty create rejected', createLinkToken(''), null)
}

// 6. Two different users get different tokens
{
  const other = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
  check('tokens differ per user', createLinkToken(USER_ID) !== createLinkToken(other), true)
  check('other user round-trips', verifyLinkToken(createLinkToken(other)!), other)
}

// 7. Uppercase uuid normalises to the canonical lowercase form
{
  const token = createLinkToken(USER_ID.toUpperCase())
  check('uppercase uuid accepted', verifyLinkToken(token!), USER_ID)
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nAll link-token tests passed')
