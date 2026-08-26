import { createHmac, timingSafeEqual } from 'crypto'

// Signed Telegram deep-link tokens: `https://t.me/<bot>?start=<token>`.
// The token is the user's uuid (base64url, 22 chars) + an HMAC signature
// (15 bytes base64url, 20 chars) keyed on TELEGRAM_BOT_TOKEN — nothing is
// stored in the DB, and the token survives only as long as the bot token does.
// Telegram /start payloads allow A-Za-z0-9_- up to 64 chars; 42 fits.

const UUID_B64_LEN = 22
const SIG_B64_LEN  = 20

function secret(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null
}

function sign(payload: string, key: string): string {
  return createHmac('sha256', key).update(payload).digest().subarray(0, 15).toString('base64url')
}

function uuidToB64(uuid: string): string | null {
  const hex = uuid.replace(/-/g, '').toLowerCase()
  if (!/^[0-9a-f]{32}$/.test(hex)) return null
  return Buffer.from(hex, 'hex').toString('base64url')
}

function b64ToUuid(b64: string): string | null {
  let hex: string
  try {
    hex = Buffer.from(b64, 'base64url').toString('hex')
  } catch {
    return null
  }
  if (hex.length !== 32) return null
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createLinkToken(userId: string): string | null {
  const key = secret()
  if (!key) return null
  const payload = uuidToB64(userId)
  if (!payload) return null
  return payload + sign(payload, key)
}

export function verifyLinkToken(token: string): string | null {
  const key = secret()
  if (!key) return null
  if (token.length !== UUID_B64_LEN + SIG_B64_LEN) return null
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null
  const payload  = token.slice(0, UUID_B64_LEN)
  const given    = Buffer.from(token.slice(UUID_B64_LEN))
  const expected = Buffer.from(sign(payload, key))
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return b64ToUuid(payload)
}
