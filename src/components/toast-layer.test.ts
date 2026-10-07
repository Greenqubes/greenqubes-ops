/**
 * Standalone test: toasts must render above every overlay in the app.
 * Run: npx tsx src/components/toast-layer.test.ts
 * Exits 1 on any failure.
 *
 * The bug (final review of the DO scanner, 2026-10-07): the toast stack sat at
 * z-50 while every modal, drawer and the scanner sit at z-[59]…z-[81] — so an
 * error raised inside one ("Upload failed — storage 503") was drawn underneath
 * it and the person saw nothing at all. This reads every component's classes,
 * so a new overlay added above the toasts fails here, not on someone's phone.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const toastSrc = readFileSync(join(__dirname, 'Toast.tsx'), 'utf8')
const toastZ = Number(toastSrc.match(/aria-live="polite"[\s\S]*?z-\[(\d+)\]/)?.[1] ?? 0)

let highest = 0, where = ''
for (const f of walk(join(__dirname, '..'))) {
  if (f.endsWith('Toast.tsx')) continue
  for (const m of readFileSync(f, 'utf8').matchAll(/\bz-\[(\d+)\]/g)) {
    const z = Number(m[1])
    if (z > highest) { highest = z; where = f }
  }
}

check(`toast layer (${toastZ}) is above the highest overlay (${highest}, ${where.split(/[\\/]src[\\/]/).pop()})`, toastZ > highest, true)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
