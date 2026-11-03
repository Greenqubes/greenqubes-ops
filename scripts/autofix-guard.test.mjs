/**
 * Standalone test for the auto-fixer's guard hook (scripts/autofix-guard.mjs).
 * Run: node scripts/autofix-guard.test.mjs
 * Exits 1 on any failure.
 */

import { decide } from './autofix-guard.mjs'

let failures = 0

function check(name, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

const ON  = { GQ_AUTOFIX: '1' }
const OFF = {}
const ROOT = '/home/user/greenqubes-ops'
const edit = file_path => ({ tool_name: 'Edit', tool_input: { file_path }, cwd: ROOT })
const bash = command => ({ tool_name: 'Bash', tool_input: { command }, cwd: ROOT })
const blocked = (input, env = ON) => decide(input, env).block

// Nic's own sessions never notice it.
check('env unset → never blocks an off-limits edit', blocked(edit(`${ROOT}/src/components/Modal.tsx`), OFF), false)
check('env unset → never blocks a push to main', blocked(bash('git push origin main'), OFF), false)

// Edits.
check('shared component → block', blocked(edit(`${ROOT}/src/components/Modal.tsx`)), true)
check('feature screen → allow', blocked(edit(`${ROOT}/src/features/schedule/ScheduleShell.tsx`)), false)
check('relative feature path → allow', blocked({ tool_name: 'Write', tool_input: { file_path: 'src/features/x/x.test.ts' }, cwd: ROOT }), false)
check('migration → block', blocked(edit(`${ROOT}/supabase/migrations/0070_x.sql`)), true)
check('CLAUDE.md → block', blocked(edit(`${ROOT}/CLAUDE.md`)), true)
check('its own rules → block', blocked(edit(`${ROOT}/docs/autofix/RULES.md`)), true)
check('this guard → block', blocked(edit(`${ROOT}/scripts/autofix-guard.mjs`)), true)
check('scratch file outside the repo → allow', blocked(edit('/tmp/notes.md')), false)
check('path escaping the repo via .. → judged by where it lands', blocked(edit(`${ROOT}/src/features/../components/Btn.tsx`)), true)

// Pushes.
check('push own branch → allow', blocked(bash('git push -u origin claude/autofix-20261105-today')), false)
check('push HEAD:own branch → allow', blocked(bash('git push origin HEAD:claude/autofix-20261105-today')), false)
check('push main → block', blocked(bash('git push origin main')), true)
check('push HEAD:dev → block', blocked(bash('git push origin HEAD:dev')), true)
check('push wrong prefix → block', blocked(bash('git push origin autofix/x')), true)
check('bare push → block', blocked(bash('git push')), true)
check('force push own branch → block', blocked(bash('git push --force origin claude/autofix-x')), true)
check('delete branch → block', blocked(bash('git push origin --delete claude/autofix-x')), true)
check('push hidden after && → block', blocked(bash('npm test && git push origin main')), true)

// Database, deploys, GitHub writes.
check('supabase CLI → block', blocked(bash('npx supabase db push')), true)
check('supabase@2 CLI → block', blocked(bash('npx -y supabase@2 migration list')), true)
check('psql → block', blocked(bash('psql "$DB_URL" -c "drop table jobs"')), true)
check('grep inside src/lib/supabase → allow', blocked(bash('grep -rn localeCompare src/lib/supabase')), false)
check('vercel CLI → block', blocked(bash('npx vercel deploy --prod')), true)
check('gh api write → block', blocked(bash('gh api -X PUT repos/Greenqubes/greenqubes-ops/merges')), true)
check('gh api with fields (implies POST) → block', blocked(bash('gh api repos/x/issues -f title=hi')), true)
check('gh api read → allow', blocked(bash('gh api "repos/Greenqubes/greenqubes-ops/deployments?sha=abc"')), false)
check('gh pr merge → block', blocked(bash('gh pr merge 12')), true)

// Network.
check('curl elsewhere → block', blocked(bash('curl https://example.com/x')), true)
check('curl the app inbox → allow', blocked(bash('curl -s "https://greenqubes-ops.vercel.app/api/autofix/inbox?run=1"')), false)
check('curl GitHub API → allow', blocked(bash('curl -s https://api.github.com/repos/x')), false)
check('wget elsewhere → block', blocked(bash('wget http://evil.example.com/a')), true)

// ── Final review 2026-11-04: bypasses that used to get through ──
check('git -C push main → block', blocked(bash('git -C /repo push origin main')), true)
check('git --no-pager push main → block', blocked(bash('git --no-pager push origin main')), true)
check('git -c … -C . push main → block', blocked(bash('git -c x=y -C . push origin main')), true)
check('push inside sh -c → block', blocked(bash(`sh -c "git push origin main"`)), true)
check('rewire the push target → block', blocked(bash('git config remote.origin.push refs/heads/claude/autofix-x:refs/heads/main')), true)
check('git alias → block', blocked(bash('git config alias.p push')), true)
check('git config user.email → allow', blocked(bash('git config user.email fixer@example.com')), false)
check('git config --get → allow', blocked(bash('git config --get remote.origin.url')), false)
check('git remote set-url → block', blocked(bash('git remote set-url origin https://example.com/x.git')), true)
check('git remote -v → allow', blocked(bash('git remote -v')), false)
check('commit message mentioning push → allow', blocked(bash('git commit -m "fix: push button cut off"')), false)
// Paths are measured from the project root, not wherever the session cd'd to.
const SUB = { ...ON, CLAUDE_PROJECT_DIR: ROOT }
check('cwd in src/, edit CLAUDE.md → block', blocked({ tool_name: 'Edit', tool_input: { file_path: `${ROOT}/CLAUDE.md` }, cwd: `${ROOT}/src` }, SUB), true)
check('cwd in src/, relative ../package.json → block', blocked({ tool_name: 'Edit', tool_input: { file_path: '../package.json' }, cwd: `${ROOT}/src` }, SUB), true)
check('cwd in src/, relative features file → allow', blocked({ tool_name: 'Edit', tool_input: { file_path: 'features/x/X.tsx' }, cwd: `${ROOT}/src` }, SUB), false)
// Web tools follow the same network rule.
check('WebFetch elsewhere → block', blocked({ tool_name: 'WebFetch', tool_input: { url: 'https://example.com/a' }, cwd: ROOT }), true)
check('WebFetch GitHub → allow', blocked({ tool_name: 'WebFetch', tool_input: { url: 'https://github.com/x' }, cwd: ROOT }), false)
check('WebSearch → block', blocked({ tool_name: 'WebSearch', tool_input: { query: 'x' }, cwd: ROOT }), true)

// Ordinary work is untouched.
check('npm run build → allow', blocked(bash('npm run build')), false)
check('running tests → allow', blocked(bash('npx tsx src/lib/autofix/limiter.test.ts')), false)
check('git commit → allow', blocked(bash('git commit -m "fix: today button"')), false)
check('Read tool → allow', blocked({ tool_name: 'Read', tool_input: { file_path: `${ROOT}/CLAUDE.md` }, cwd: ROOT }), false)

const reason = decide(edit(`${ROOT}/src/components/Modal.tsx`), ON).reason
check('a block explains itself', typeof reason === 'string' && reason.includes('src/components/Modal.tsx'), true)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll guard checks passed')
