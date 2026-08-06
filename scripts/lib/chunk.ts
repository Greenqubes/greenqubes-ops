/**
 * Paragraph-aware chunker for vault notes.
 * Extracted from obsidian-sync.ts so it can be tested without running the sync.
 * Line endings are normalised first: CRLF checkouts (git autocrlf on Windows)
 * must chunk identically to LF checkouts, or different machines write a
 * different number of chunks for the same file and stale rows pile up.
 */

export const CHUNK_CHARS = 2000 // ≈ 500 tokens

export function chunkText(text: string): string[] {
  const normalised = text.replace(/\r\n/g, '\n')
  const paras = normalised.split(/\n\n+/)
  const chunks: string[] = []
  let cur = ''

  for (const p of paras) {
    if (cur.length + p.length > CHUNK_CHARS && cur.length > 0) {
      chunks.push(cur.trim())
      cur = ''
    }
    cur += (cur ? '\n\n' : '') + p
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks.length ? chunks : [normalised.slice(0, CHUNK_CHARS).trim()]
}
