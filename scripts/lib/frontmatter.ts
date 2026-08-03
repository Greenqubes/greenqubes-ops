/**
 * Frontmatter parser for Obsidian vault notes.
 * Extracted from obsidian-sync.ts so it can be tested without running the sync.
 */

export interface Frontmatter {
  visibility: string[]
  tags: string[]
}

export const FM_DEFAULT: Frontmatter = { visibility: ['public-internal'], tags: [] }

const unquote = (s: string): string => s.trim().replace(/^['"]|['"]$/g, '')

const parseInlineList = (s: string): string[] => {
  const t = s.trim()
  const src = t.startsWith('[') ? t.slice(1, -1) : t
  return src.split(',').map(unquote).filter(Boolean)
}

/**
 * Reads a key whose value is either an inline list (`key: [a, b]`) or a
 * multi-line YAML list (`key:` followed by `  - a` lines — the format
 * Obsidian's properties editor writes). Returns null if the key is absent
 * or has no items, so callers fall back to defaults.
 */
function readListKey(yaml: string, key: string): string[] | null {
  const lines = yaml.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(new RegExp(`^${key}:\\s*(.*)$`))
    if (!m) continue

    const inline = m[1].trim()
    if (inline) return parseInlineList(inline)

    const items: string[] = []
    for (let j = i + 1; j < lines.length; j++) {
      const item = lines[j].match(/^\s+-\s*(.+)$/)
      if (!item) break
      items.push(unquote(item[1]))
    }
    return items.length ? items : null
  }
  return null
}

export function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { fm: FM_DEFAULT, body: raw }

  const yaml = match[1]
  const body = raw.slice(match[0].length)

  const vis = readListKey(yaml, 'visibility')
  const tag = readListKey(yaml, 'tags')

  return {
    fm: {
      visibility: vis ?? FM_DEFAULT.visibility,
      tags:       tag ?? FM_DEFAULT.tags,
    },
    body,
  }
}
