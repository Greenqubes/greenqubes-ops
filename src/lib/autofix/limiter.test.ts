/**
 * Standalone test for the auto-fixer's limiter — "just fix enough to get it
 * working again" (Nic, 2026-11-04). No test framework.
 * Run: npx tsx src/lib/autofix/limiter.test.ts
 * Exits 1 on any failure.
 */

import { checkLimits, type ChangedFile } from './limiter'

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

const mod = (filename: string, additions = 1, deletions = 0): ChangedFile =>
  ({ filename, status: 'modified', additions, deletions })

// One small change to a feature screen is exactly what the fixer is for.
const one = checkLimits([mod('src/features/schedule/ScheduleShell.tsx', 10, 5)])
check('one feature file, 15 lines → ok', one.ok, true)
check('one feature file counts 1 file', one.files, 1)
check('one feature file counts 15 lines', one.lines, 15)

// The limits themselves: 3 files, 60 lines.
check('3 files, 60 lines → ok', checkLimits([
  mod('src/features/a/A.tsx', 20), mod('src/features/b/B.tsx', 20), mod('src/features/c/C.tsx', 10, 10),
]).ok, true)
check('4 files → not ok', checkLimits([
  mod('src/features/a/A.tsx'), mod('src/features/b/B.tsx'), mod('src/features/c/C.tsx'), mod('src/features/d/D.tsx'),
]).ok, false)
check('61 lines → not ok', checkLimits([mod('src/features/a/A.tsx', 31, 30)]).ok, false)
check('61 lines names the limit', checkLimits([mod('src/features/a/A.tsx', 31, 30)]).violations,
  ['changes 61 lines (the limit is 60)'])
check('4 files names the limit', checkLimits([
  mod('src/features/a/A.tsx'), mod('src/features/b/B.tsx'), mod('src/features/c/C.tsx'), mod('src/features/d/D.tsx'),
]).violations, ['changes 4 files (the limit is 3)'])

// New code is session work; a new test beside the fix is welcome and free.
check('added non-test file → violation', checkLimits([
  { filename: 'src/features/x/new.ts', status: 'added', additions: 5, deletions: 0 },
]).violations, ['adds a new file src/features/x/new.ts'])
const withTest = checkLimits([
  mod('src/features/x/X.tsx', 4),
  { filename: 'src/features/x/x.test.ts', status: 'added', additions: 80, deletions: 0 },
])
check('added test file → ok', withTest.ok, true)
check('test file not counted in files', withTest.files, 1)
check('test file not counted in lines', withTest.lines, 4)

// Off-limits ground — each named in the violation.
for (const f of [
  'src/components/Modal.tsx',
  'src/app/api/jobs/route.ts',
  'src/app/auth/callback/route.ts',
  'src/app/layout.tsx',
  'src/lib/utils/x.ts',
  'src/middleware.ts',
  'supabase/migrations/0070_x.sql',
  'package.json',
  'CLAUDE.md',
  '.claude/settings.json',
  'src/features/changelog/ChangelogModal.tsx',
  'src/features/app-version/VersionWatcher.tsx',
  'src/features/tour/TourOverlay.tsx',
  'src/lib/i18n/bn.ts',
]) {
  check(`${f} → off-limits`, checkLimits([mod(f)]).violations, [`changes ${f}, which is off-limits`])
}

// Allowed ground.
check('route page → ok', checkLimits([mod('src/app/schedule/page.tsx')]).ok, true)
check('nested route page → ok', checkLimits([mod('src/app/jobs/[id]/page.tsx')]).ok, true)
check('en.ts wording → ok', checkLimits([mod('src/lib/i18n/en.ts')]).ok, true)
check('zh.ts wording → ok', checkLimits([mod('src/lib/i18n/zh.ts')]).ok, true)
check('windows-style path is normalised', checkLimits([mod('src\\features\\a\\A.tsx')]).ok, true)

// Removing or renaming files is beyond a minimal fix.
check('removed feature file → violation', checkLimits([
  { filename: 'src/features/x/X.tsx', status: 'removed', additions: 0, deletions: 9 },
]).violations, ['removes src/features/x/X.tsx'])
check('renamed feature file → violation', checkLimits([
  { filename: 'src/features/x/Y.tsx', status: 'renamed', additions: 0, deletions: 0, previous_filename: 'src/features/x/X.tsx' },
]).violations, ['renames src/features/x/X.tsx to src/features/x/Y.tsx'])

// A test file in off-limits ground is still off-limits.
check('test file under src/lib/utils → violation', checkLimits([
  mod('src/features/x/X.tsx'),
  { filename: 'src/lib/utils/x.test.ts', status: 'added', additions: 3, deletions: 0 },
]).ok, false)

// Deleting a test to make the suite pass is the opposite of a fix.
check('removed test file → violation', checkLimits([
  mod('src/features/x/X.tsx'),
  { filename: 'src/features/x/x.test.ts', status: 'removed', additions: 0, deletions: 40 },
]).violations, ['removes src/features/x/x.test.ts'])

// Nothing changed is not a fix — and neither is a change to tests alone.
check('empty diff → violation', checkLimits([]).violations, ['changes nothing'])
check('tests only → violation', checkLimits([
  { filename: 'src/features/x/x.test.ts', status: 'modified', additions: 2, deletions: 1 },
]).violations, ['changes nothing'])

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll limiter checks passed')
