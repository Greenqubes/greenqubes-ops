/**
 * Standalone test for the frontmatter parser (no test framework in this repo).
 * Run: npx tsx scripts/lib/frontmatter.test.ts
 * Exits 1 on any failure.
 */

import { parseFrontmatter } from './frontmatter'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

// 1. Inline list format (the original convention)
{
  const { fm } = parseFrontmatter(`---\nvisibility: [role:sales, role:scheduler]\ntags: [supplier, costing]\n---\nbody`)
  check('inline visibility', fm.visibility, ['role:sales', 'role:scheduler'])
  check('inline tags', fm.tags, ['supplier', 'costing'])
}

// 2. Multi-line YAML list — the format Obsidian's properties editor writes.
//    This is what the supplier files in the vault use today.
{
  const raw = `---\nvisibility:\n  - role:sales\n  - role:scheduler\ntags:\n  - supplier\n  - costing\n  - dama\n---\n# DAMA\nbody text`
  const { fm, body } = parseFrontmatter(raw)
  check('multi-line visibility', fm.visibility, ['role:sales', 'role:scheduler'])
  check('multi-line tags', fm.tags, ['supplier', 'costing', 'dama'])
  check('multi-line body preserved', body, '# DAMA\nbody text')
}

// 3. Multi-line with CRLF line endings (files edited on Windows)
{
  const raw = `---\r\nvisibility:\r\n  - role:sales\r\n---\r\nbody`
  const { fm } = parseFrontmatter(raw)
  check('multi-line visibility (CRLF)', fm.visibility, ['role:sales'])
}

// 4. No frontmatter at all → safe defaults
{
  const { fm, body } = parseFrontmatter('# Just a note\ncontent')
  check('no frontmatter visibility default', fm.visibility, ['public-internal'])
  check('no frontmatter tags default', fm.tags, [])
  check('no frontmatter body untouched', body, '# Just a note\ncontent')
}

// 5. Frontmatter present but no visibility key → default
{
  const { fm } = parseFrontmatter(`---\ntags: [misc]\n---\nbody`)
  check('missing visibility key default', fm.visibility, ['public-internal'])
}

// 6. Quoted items in either format
{
  const inline = parseFrontmatter(`---\nvisibility: ["role:sales", 'role:scheduler']\n---\nx`)
  check('inline quoted items', inline.fm.visibility, ['role:sales', 'role:scheduler'])
  const multi = parseFrontmatter(`---\nvisibility:\n  - "role:sales"\n---\nx`)
  check('multi-line quoted items', multi.fm.visibility, ['role:sales'])
}

// 7. Empty visibility value (key present, no items) → default, matching old behaviour
{
  const { fm } = parseFrontmatter(`---\nvisibility:\ntags: [x]\n---\nbody`)
  check('empty visibility value default', fm.visibility, ['public-internal'])
}

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
