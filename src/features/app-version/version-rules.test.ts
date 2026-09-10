/**
 * Standalone test for the auto-refresh decision (no test framework).
 * Run: npx tsx src/features/app-version/version-rules.test.ts
 * Exits 1 on any failure.
 */

import { versionAction, IDLE_SECONDS } from './version-rules'

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

// Someone sitting on the current build, looking at the screen, nothing typed.
const base = {
  current:        'abc123',
  latest:         'abc123',
  hasUnsavedWork: false,
  visible:        true,
  idleSeconds:    0,
}

// ── Nothing to do ───────────────────────────────────────────────────────
check('same build → nothing', versionAction(base), 'none')
check('check failed → nothing', versionAction({ ...base, latest: null }), 'none')

// The loop guard: an unstamped build can never match the server, so it must
// never reload — otherwise every tab refreshes forever.
check('no stamp on this build → nothing', versionAction({ ...base, current: 'dev', latest: 'abc123' }), 'none')
check('empty stamp → nothing', versionAction({ ...base, current: '', latest: 'abc123' }), 'none')
check('server reports no stamp → nothing', versionAction({ ...base, latest: 'dev' }), 'none')

// ── A newer build is out ────────────────────────────────────────────────
const newer = { ...base, latest: 'def456' }

check('background tab → refresh silently', versionAction({ ...newer, visible: false }), 'reload')
check('watching, mid-tap → wait, ask again shortly', versionAction({ ...newer, idleSeconds: 0 }), 'wait')
check('watching, just under the idle line → still waiting',
  versionAction({ ...newer, idleSeconds: IDLE_SECONDS - 1 }), 'wait')
check('watching, gone still → refresh', versionAction({ ...newer, idleSeconds: IDLE_SECONDS }), 'reload')
check('watching, long idle → refresh', versionAction({ ...newer, idleSeconds: 600 }), 'reload')

// ── Unsaved work always wins ────────────────────────────────────────────
// Nobody loses a half-typed job form to a deploy, whatever else is true.
check('unsaved + idle → bar, not a refresh',
  versionAction({ ...newer, hasUnsavedWork: true, idleSeconds: 600 }), 'banner')
check('unsaved + background tab → bar, still not a refresh',
  versionAction({ ...newer, hasUnsavedWork: true, visible: false }), 'banner')
check('unsaved + mid-tap → bar', versionAction({ ...newer, hasUnsavedWork: true }), 'banner')
// Once the work is saved the bar's reason is gone, and a still moment
// refreshes on its own — which is why most people never tap the bar.
check('saved, then still → refresh',
  versionAction({ ...newer, hasUnsavedWork: false, idleSeconds: IDLE_SECONDS }), 'reload')

console.log(failures === 0 ? '\nAll version-rule checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
