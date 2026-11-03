// GitHub REST calls for the auto-fixer — measuring a fix, putting it live,
// tidying its branch. All on GITHUB_AUTOFIX_TOKEN: a fine-grained token Nic
// creates for this one repo (contents read/write, deployments read). Without
// it nothing here runs, and no fix can be offered or put live.

import { REPO } from './build-id'
import type { ChangedFile } from './limiter'

const API = 'https://api.github.com'
const BRANCH_PREFIX = 'claude/autofix-'

export function githubConfigured(): boolean {
  return !!process.env.GITHUB_AUTOFIX_TOKEN
}

async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}/repos/${REPO}${path}`, {
    ...init,
    headers: {
      Accept:                 'application/vnd.github+json',
      Authorization:          `Bearer ${process.env.GITHUB_AUTOFIX_TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent':           'greenqubes-autofix',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  })
}

/** Files changed on `head` relative to `base` — what the limiter measures. */
export async function compareFiles(base: string, head: string): Promise<ChangedFile[] | null> {
  if (!githubConfigured()) return null
  const res = await gh(`/compare/${base}...${head}`)
  if (!res.ok) { console.error('[autofix] compare failed', res.status); return null }
  const body = await res.json() as { files?: ChangedFile[] }
  return (body.files ?? []).map(f => ({
    filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions,
    ...(f.previous_filename ? { previous_filename: f.previous_filename } : {}),
  }))
}

export async function branchHeadSha(branch: string): Promise<string | null> {
  if (!githubConfigured()) return null
  const res = await gh(`/git/ref/heads/${branch}`)
  if (!res.ok) return null
  const body = await res.json() as { object?: { sha?: string } }
  return body.object?.sha ?? null
}

export type MergeResult =
  | { result: 'merged'; sha: string }
  | { result: 'nothing' }
  | { result: 'conflict' }
  | { result: 'error'; detail: string }

/** POST /merges — 201 merged, 204 nothing to merge, 409 conflict. */
export async function mergeInto(base: string, head: string, message: string): Promise<MergeResult> {
  if (!githubConfigured()) return { result: 'error', detail: 'GitHub key not set up' }
  const res = await gh('/merges', { method: 'POST', body: JSON.stringify({ base, head, commit_message: message }) })
  if (res.status === 201) return { result: 'merged', sha: ((await res.json()) as { sha: string }).sha }
  if (res.status === 204) return { result: 'nothing' }
  if (res.status === 409) return { result: 'conflict' }
  return { result: 'error', detail: `GitHub answered ${res.status}` }
}

/** Only ever deletes the fixer's own branches. */
export async function deleteBranch(branch: string): Promise<boolean> {
  if (!githubConfigured() || !branch.startsWith(BRANCH_PREFIX)) return false
  const res = await gh(`/git/refs/heads/${branch}`, { method: 'DELETE' })
  return res.status === 204 || res.status === 422 // 422: already gone
}

/**
 * Vercel reports each deployment to GitHub. For a merge commit on main this
 * says whether production built: success, failure, or still pending.
 */
export async function productionDeployState(sha: string): Promise<'success' | 'failure' | 'pending' | 'unknown'> {
  if (!githubConfigured()) return 'unknown'
  const res = await gh(`/deployments?sha=${sha}&per_page=20`)
  if (!res.ok) return 'unknown'
  const deployments = await res.json() as { id: number; environment: string }[]
  const prod = deployments.find(d => d.environment.toLowerCase().startsWith('production'))
  if (!prod) return 'pending'
  const sres = await gh(`/deployments/${prod.id}/statuses?per_page=1`)
  if (!sres.ok) return 'unknown'
  const [latest] = await sres.json() as { state: string }[]
  if (!latest) return 'pending'
  if (latest.state === 'success') return 'success'
  if (latest.state === 'failure' || latest.state === 'error') return 'failure'
  return 'pending'
}
