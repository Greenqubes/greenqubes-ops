// Standalone test — run with: npx tsx src/features/job-detail/edit-clash-rules.test.ts
// Exits 1 on failure (repo convention — no test framework).
import { editClashActions } from './edit-clash-rules'

let failed = 0
function eq<T>(name: string, got: T, want: T) {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (ok) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name} (got ${JSON.stringify(got)})`) }
}

console.log('editClashActions — which buttons the edit-save clash pop-up offers')
// Unchanged behaviour, pinned first so the away change cannot move it.
eq('coordinator with a real clash → alert scheduler', editClashActions('coordinator', { clashes: 1, leave: 0 }), 'alert-scheduler')
eq('coordinator with leave → alert scheduler', editClashActions('coordinator', { clashes: 0, leave: 1 }), 'alert-scheduler')
eq('scheduler with a real clash → save anyway', editClashActions('scheduler', { clashes: 1, leave: 0 }), 'save-anyway')
// Review Focus #5: an away-only result is a warning, not something to escalate.
eq('coordinator, away only → save anyway', editClashActions('coordinator', { clashes: 0, leave: 0 }), 'save-anyway')
eq('sales, away only → save anyway', editClashActions('sales', { clashes: 0, leave: 0 }), 'save-anyway')

if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1) }
console.log('\nall passed')
