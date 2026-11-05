import type { NextRequest } from 'next/server'
import { secretOk } from './telegram-auth'

/**
 * The cloud fixer's key to its two app routes. Accepted as a bearer token or
 * an x-autofix-secret header (whichever the cloud's network secret attaches).
 * Fails closed: with AUTOFIX_SECRET unset, nothing gets in.
 */
export function autofixSecretOk(req: NextRequest): boolean {
  const expected = process.env.AUTOFIX_SECRET
  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  return secretOk(bearer, expected) || secretOk(req.headers.get('x-autofix-secret'), expected)
}

/** Vercel cron calls carry `Authorization: Bearer <CRON_SECRET>`. Fails closed. */
export function cronSecretOk(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  return secretOk(bearer, process.env.CRON_SECRET)
}
