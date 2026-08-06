/**
 * Nightly Obsidian vault → Supabase sync.
 * Run: npm run obsidian-sync
 * In CI/GitHub Actions set env vars as secrets instead of --env-file.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { embed } from '../src/lib/ai/embed'
import { parseFrontmatter } from './lib/frontmatter'
import { chunkText } from './lib/chunk'
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
        const vector = await embed(`File: ${sourcePath}\n\n${chunks[i]}`)
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
      // A file that shrank to fewer chunks leaves orphaned higher-index rows —
      // the upsert never touches them, so clear them explicitly.
      const { error: trimError } = await db
        .from('kb_chunks')
        .delete()
        .eq('source_path', sourcePath)
        .gte('chunk_index', chunks.length)
      if (trimError) throw trimError
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

  await db.from('events').insert({ kind: 'obsidian_sync', actor_id: null, target_id: null, target_table: null, payload: null, visibility: [] })

  if (failed) process.exit(1)
}

main().catch(err => {
  console.error('[obsidian-sync] fatal:', (err as Error).message)
  process.exit(1)
})
