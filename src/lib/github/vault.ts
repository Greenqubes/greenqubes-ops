// src/lib/github/vault.ts

const VAULT_REPO  = process.env.GITHUB_VAULT_REPO!   // "Greenqubes/greenqubes-kb"
const VAULT_TOKEN = process.env.GITHUB_VAULT_TOKEN!

/**
 * Converts a topic string to a URL-safe slug.
 * e.g. "Armstrong Pricing Update May 2026" → "armstrong-pricing-update-may-2026"
 */
export function topicToSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

/**
 * Commits a new file to the vault GitHub repo via the Contents API.
 * filePath is relative to the vault root — e.g. "digest/2026-05-26-topic.md"
 * Throws if the GitHub API returns an error.
 */
export async function commitVaultFile(
  filePath: string,
  content: string,
  commitMessage: string,
): Promise<void> {
  if (!VAULT_REPO || !VAULT_TOKEN) {
    throw new Error('GITHUB_VAULT_REPO or GITHUB_VAULT_TOKEN not set')
  }

  const url = `https://api.github.com/repos/${VAULT_REPO}/contents/${filePath}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization':        `Bearer ${VAULT_TOKEN}`,
      'Content-Type':         'application/json',
      'Accept':               'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message: commitMessage,
      content: Buffer.from(content, 'utf-8').toString('base64'),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`GitHub API ${res.status}: ${JSON.stringify(err)}`)
  }
}
