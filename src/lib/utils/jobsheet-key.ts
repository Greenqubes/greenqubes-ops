import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * The secret in the old jobsheet's private link (spec 2026-11-11 Part 2).
 * Stored in app_settings under SHEET_KEY_SETTING; Admin → Settings makes,
 * shows and changes it. The link has no login, so this key is the whole gate.
 */
export const SHEET_KEY_SETTING = 'jobsheet_link_key'

/** 32 random bytes, base64url — 43 characters, safe in a URL as-is. */
export function newSheetKey(): string {
  return randomBytes(32).toString('base64url')
}

/** Constant-time comparison; false for anything that isn't a non-empty string
 *  or when no key has been made yet. */
export function keysMatch(given: unknown, stored: string | null): boolean {
  if (typeof given !== 'string' || given.length === 0 || !stored) return false
  const a = Buffer.from(given), b = Buffer.from(stored)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function sheetLink(appUrl: string, key: string): string {
  return `${appUrl}/api/sheet/jobs?key=${key}`
}
