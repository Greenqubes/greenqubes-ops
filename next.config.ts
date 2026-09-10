import type { NextConfig } from 'next'
import { createHash } from 'node:crypto'

// Stamp this build so a running tab can tell it has gone stale (the
// auto-refresh watcher). Hashed rather than raw: the browser only ever needs
// "same or different", and the commit id of a private repo is nobody's
// business. /api/version hashes the same value the same way at runtime.
// No stamp (local dev) means 'dev', which the watcher treats as "never
// reload" — see version-rules.ts.
const commit = process.env.VERCEL_GIT_COMMIT_SHA
const buildId = commit ? createHash('sha256').update(commit).digest('hex').slice(0, 12) : 'dev'

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.imagedelivery.net' },
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },
}

export default nextConfig
