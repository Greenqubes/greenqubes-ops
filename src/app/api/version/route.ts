import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

/**
 * Which build the server is running right now.
 *
 * A tab compares this with the build baked into its own bundle
 * (NEXT_PUBLIC_BUILD_ID) and refreshes itself when they differ, so nobody has
 * to be told to reload after a deploy (Nic, 2026-09-10).
 *
 * Hashed, so it says "same or different" and nothing else — the commit id of
 * a private repo has no business being public. next.config.ts hashes the same
 * value the same way at build time.
 */

// Never cached: a cached answer is a tab that never learns it is stale.
export const dynamic = 'force-dynamic'

export function GET() {
  const commit  = process.env.VERCEL_GIT_COMMIT_SHA
  const version = commit ? createHash('sha256').update(commit).digest('hex').slice(0, 12) : 'dev'

  return NextResponse.json({ version }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
