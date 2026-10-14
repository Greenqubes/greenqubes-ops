/**
 * Standalone validation of all registered tour scripts (no test framework).
 * Run: npx tsx src/features/tour/steps/scripts.test.ts
 * Checks every script: non-empty, unique ids, closes with the shared outro,
 * and every i18n key exists in BOTH en and zh (zh is Partial — a missing
 * zh key silently falls back to English, which we don't want for the tour).
 */
import { TOUR_SCRIPTS } from './index'
import { bellStep, outroSteps } from './common'
import { en } from '../../../lib/i18n/en'
import { zh } from '../../../lib/i18n/zh'
import { bn } from '../../../lib/i18n/bn'

let failures = 0
function assert(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); failures++ }
}

// the shared steps must themselves be sound
assert('bell step targets the bell', bellStep.targets?.[0] === 'bell')
assert('outro is account → telegram → done',
  outroSteps.map(s => s.id).join(',') === 'account,telegram,done')

const entries = Object.entries(TOUR_SCRIPTS)
assert('at least one script registered', entries.length > 0)

for (const [role, steps] of entries) {
  if (!steps) continue
  assert(`${role}: non-empty`, steps.length > 0)
  const ids = steps.map(s => s.id)
  assert(`${role}: unique step ids`, new Set(ids).size === ids.length)
  assert(`${role}: ends with the shared outro`,
    ids.slice(-3).join(',') === 'account,telegram,done')
  for (const s of steps) {
    assert(`${role}/${s.id}: en has ${s.titleKey}`, s.titleKey in en)
    assert(`${role}/${s.id}: en has ${s.bodyKey}`, s.bodyKey in en)
    assert(`${role}/${s.id}: zh has ${s.titleKey}`, s.titleKey in zh)
    assert(`${role}/${s.id}: zh has ${s.bodyKey}`, s.bodyKey in zh)
    assert(`${role}/${s.id}: bn has ${s.titleKey}`, s.titleKey in bn)
    assert(`${role}/${s.id}: bn has ${s.bodyKey}`, s.bodyKey in bn)
  }
}

const CHROME_KEYS = ['tourWelcomeTitle', 'tourWelcomeBody', 'tourLangTitle', 'tourLangBody',
  'tourStart', 'tourSkip', 'tourNext', 'tourBack', 'tourFinish', 'tourExit', 'tourMenuLabel'] as const
for (const k of CHROME_KEYS) {
  assert(`chrome ${k} in en`, k in en)
  assert(`chrome ${k} in zh`, k in zh)
  assert(`chrome ${k} in bn`, k in bn)
}

// Job stages: Drafts and Ongoing became ONE "Jobs" tab with a switch (Nic,
// 2026-10-14), so the tour shows that one tab — a step pointing at the old
// Drafts or Ongoing menu entries would spotlight nothing.
for (const role of ['sales', 'coordinator'] as const) {
  const steps = TOUR_SCRIPTS[role] ?? []
  assert(`${role}: no separate drafts step`, !steps.some(st => st.id === 'drafts'))
  const jobs = steps.find(st => st.id === 'jobs')
  assert(`${role}: one Jobs step on the Jobs tab`, !!jobs && (jobs.targets ?? []).includes('nav-job-list'))
}

if (failures) { console.error(`\n${failures} check(s) FAILED`); process.exit(1) }
console.log('\nAll script checks passed')
