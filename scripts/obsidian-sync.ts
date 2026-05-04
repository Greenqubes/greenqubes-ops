/**
 * Nightly Obsidian vault → Supabase sync.
 * Run: npm run obsidian-sync
 * In CI/GitHub Actions set env vars as secrets instead of --env-file.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { embed } from '../src/lib/ai/embed'
import type { Database } from '../src/lib/supabase/types'

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH

if (!VAULT_PATH) {
  console.error('[obsidian-sync] OBSIDIAN_VAULT_PATH not set in .env.local')
  process.exit(1)
}

const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Frontmatter ────────────────────────────────────────────────────────────────

interface Frontmatter {
  visibility: string[]
  tags: string[]
}

const FM_DEFAULT: Frontmatter = { visibility: ['public-internal'], tags: [] }

function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { fm: FM_DEFAULT, body: raw }

  const yaml = match[1]
  const body = raw.slice(match[0].length)

  const parseList = (s: string): string[] => {
    const t = s.trim()
    const src = t.startsWith('[') ? t.slice(1, -1) : t
    return src.split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  }

  const vis = yaml.match(/^visibility:\s*(.+)$/m)
  const tag = yaml.match(/^tags:\s*(.+)$/m)

  return {
    fm: {
      visibility: vis ? parseList(vis[1]) : FM_DEFAULT.visibility,
      tags:       tag ? parseList(tag[1]) : FM_DEFAULT.tags,
    },
    body,
  }
}

// ── Chunker ────────────────────────────────────────────────────────────────────

const CHUNK_CHARS = 2000 // ≈ 500 tokens

function chunkText(text: string): string[] {
  const paras = text.split(/\n\n+/)
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
  return chunks.length ? chunks : [text.slice(0, CHUNK_CHARS).trim()]
}

// ── Vault walker ───────────────────────────────────────────────────────────────

function walkVault(dir: string): string[] {
  const result: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) result.push(...walkVault(full))
    else if (e.name.endsWith('.md')) result.push(full)
  }
  return result
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const vaultPath = VAULT_PATH as string  // guarded by process.exit above
  console.log(`[obsidian-sync] vault: ${vaultPath}`)
  const files = walkVault(vaultPath)
  console.log(`[obsidian-sync] ${files.length} .md files found`)

  const seen = new Set<string>()
  let upserted = 0
  let failed = 0

  for (const filePath of files) {
    const sourcePath = path.relative(vaultPath, filePath).replace(/\\/g, '/')
    seen.add(sourcePath)

    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { fm, body } = parseFrontmatter(raw)
      const chunks = chunkText(body)

      for (let i = 0; i < chunks.length; i++) {
        const vector = await embed(chunks[i])
        const { error } = await db.from('kb_chunks').upsert(
          {
            source_path: sourcePath,
            chunk_index: i,
            content:     chunks[i],
            embedding:   JSON.stringify(vector),
            tags:        fm.tags.length ? fm.tags : null,
            visibility:  fm.visibility,
          },
          { onConflict: 'source_path,chunk_index' },
        )
        if (error) throw error
        upserted++
      }
      console.log(`  ✓ ${sourcePath} (${chunks.length} chunk${chunks.length !== 1 ? 's' : ''})`)
    } catch (err) {
      console.error(`  ✗ ${sourcePath}:`, (err as Error).message)
      failed++
    }
  }

  // Remove chunks whose source file was deleted from the vault
  const { data: existing } = await db.from('kb_chunks').select('id, source_path')
  const staleIds = (existing ?? []).filter(r => !seen.has(r.source_path)).map(r => r.id)
  if (staleIds.length) {
    await db.from('kb_chunks').delete().in('id', staleIds)
    console.log(`[obsidian-sync] removed ${staleIds.length} stale chunk${staleIds.length !== 1 ? 's' : ''}`)
  }

  console.log(`[obsidian-sync] done — ${upserted} upserted, ${failed} error${failed !== 1 ? 's' : ''}`)
  if (failed) process.exit(1)
}

main().catch(err => {
  console.error('[obsidian-sync] fatal:', (err as Error).message)
  process.exit(1)
})
