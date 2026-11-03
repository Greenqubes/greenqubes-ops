// @ts-check
// Where the unattended auto-fixer may change code — and how much.
//
// Plain JS on purpose: the same rules run in two places. The app checks a
// pushed fix with them before Nic is ever offered it (limiter.ts), and the
// guard hook (scripts/autofix-guard.mjs) blocks the edit inside Claude's cloud
// before it is made. One file, so the two can never disagree.
//
// Nic, 2026-11-04: "i dont want the agent make unescessary changes which breaks
// other component. just fix enough to get it working again." Feature screens
// only; shared building blocks, server routes, sign-in, data access, settings
// and the app's own plumbing are session work.

export const MAX_FILES = 3
export const MAX_LINES = 60
// Tests are encouraged but capped: an uncapped "test" file that the page then
// imports would carry any amount of code past the limit (final review).
export const MAX_TEST_LINES = 200

const ALLOWED_PREFIXES = ['src/features/', 'src/app/']

// Wording fixes. bn.ts is frozen (boss decision, 2026-08-03).
const ALLOWED_FILES = ['src/lib/i18n/en.ts', 'src/lib/i18n/zh.ts']

const FORBIDDEN_PREFIXES = [
  'src/app/api/',              // server routes — they carry the permission checks
  'src/app/auth/',             // sign-in callback
  'src/app/(auth)/',           // sign-in pages
  'src/app/admin/',            // admin screens — the page holds the admin-only redirect
  'src/app/ext/',              // no-login contractor pages
  'src/features/changelog/',   // What's new — on every screen
  'src/features/app-version/', // auto-refresh — on every screen
  'src/features/tour/',        // guided tour — overlays every screen
]

/** Forward slashes, no leading "./". */
export function normalisePath(/** @type {string} */ p) {
  return p.replace(/\\/g, '/').replace(/^\.\//, '')
}

export function isTestFile(/** @type {string} */ p) {
  return /\.test\.(ts|tsx|mjs)$/.test(normalisePath(p))
}

export function isAllowedPath(/** @type {string} */ p) {
  const f = normalisePath(p)
  if (f.split('/').includes('..')) return false
  if (ALLOWED_FILES.includes(f)) return true
  if (!ALLOWED_PREFIXES.some(x => f.startsWith(x))) return false
  if (FORBIDDEN_PREFIXES.some(x => f.startsWith(x))) return false
  // Files directly in src/app/ — the root layout, globals.css, the error
  // pages — shape every screen, so they are shared building blocks too.
  if (f.startsWith('src/app/') && f.split('/').length === 3) return false
  return true
}
