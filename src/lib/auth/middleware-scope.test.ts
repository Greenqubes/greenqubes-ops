/**
 * Standalone test for the middleware path classifier (no test framework in this repo).
 * Run: npx tsx src/lib/auth/middleware-scope.test.ts
 * Exits 1 on any failure.
 */

import { classifyPath } from './middleware-scope'

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

console.log('skip — the middleware must not touch these (they guard themselves or are public)')
check('cron route',                      classifyPath('/api/cron/monday-digest'),           'skip')
check('overdue cron (not under /cron/)', classifyPath('/api/notifications/overdue'),        'skip')
check('signed digest promote link',      classifyPath('/api/digest/promote/abc'),           'skip')
check('telegram webhook',                classifyPath('/api/telegram/webhook'),             'skip')
check('crash reporter',                  classifyPath('/api/crash'),                        'skip')
check('any other API route',             classifyPath('/api/jobs/1/messages'),              'skip')
check('external installer page',         classifyPath('/ext/some-token'),                   'skip')
check('external installer API',          classifyPath('/api/ext/some-token/respond'),       'skip')
check('OAuth callback',                  classifyPath('/auth/callback'),                    'skip')
check('static mockups',                  classifyPath('/mockups/workflow-v2/index.html'),   'skip')

console.log('login — the sign-in page itself')
check('login page',                      classifyPath('/login'),                            'login')

console.log('page — everything else needs a signed-in user')
check('home',                            classifyPath('/'),                                 'page')
check('schedule',                        classifyPath('/schedule'),                         'page')
check('admin',                           classifyPath('/admin'),                            'page')
check('job form',                        classifyPath('/jobs/123'),                         'page')
check('unknown page',                    classifyPath('/this-page-does-not-exist'),         'page')
check('prefix lookalike: /extra',        classifyPath('/extra'),                            'page')
check('prefix lookalike: /apiary',       classifyPath('/apiary'),                           'page')
check('prefix lookalike: /loginx',       classifyPath('/loginx'),                           'page')
check('prefix lookalike: /authors',      classifyPath('/authors'),                          'page')

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nall passed')
