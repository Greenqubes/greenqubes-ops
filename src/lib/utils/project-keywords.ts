// The + Add job picker seeds its suggestions from the project's own words:
// tokens of name + client, ranked by how many appear in each candidate job.

const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'by', 'with'])

export function extractKeywords(name: string, client: string): string[] {
  const out: string[] = []
  for (const raw of `${name} ${client}`.toLowerCase().split(/[^a-z0-9一-鿿]+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue
    if (!out.includes(raw)) out.push(raw)
  }
  return out
}

export function scoreJob(
  job: { project_title: string | null; client: string },
  keywords: string[],
): number {
  const hay = `${job.project_title ?? ''} ${job.client}`.toLowerCase()
  let score = 0
  for (const k of keywords) if (hay.includes(k)) score++
  return score
}
