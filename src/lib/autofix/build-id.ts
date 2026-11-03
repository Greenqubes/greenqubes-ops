import { createHash } from 'node:crypto'

export const PROD_URL = 'https://greenqubes-ops.vercel.app'
export const REPO     = 'Greenqubes/greenqubes-ops'

/**
 * The 12-character build stamp for a commit — exactly what next.config.ts
 * bakes into NEXT_PUBLIC_BUILD_ID and /api/version reports, so a merge commit
 * can be matched to the build production is serving.
 */
export function buildIdOf(sha: string): string {
  return createHash('sha256').update(sha).digest('hex').slice(0, 12)
}

/**
 * Vercel's own clock, from a production response's x-vercel-id
 * (`sin1::sin1::hq4b7-1793724495272-07c74ba24485` → 1793724495272). CLAUDE.md's
 * release-time rule: never this machine's clock, always the deployment's.
 */
export function epochFromVercelId(header: string | null): number | null {
  if (!header) return null
  const last = header.split('::').at(-1) ?? ''
  const m = last.match(/-(\d{13})-[^-]*$/)
  return m ? Number(m[1]) : null
}
