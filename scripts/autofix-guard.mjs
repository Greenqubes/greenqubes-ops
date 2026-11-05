// @ts-check
// PreToolUse guard for the UNATTENDED auto-fixer (Claude Code in Anthropic's
// cloud). Registered in .claude/settings.json, so it also runs in everyone's
// local sessions — where it does nothing: unless GQ_AUTOFIX=1 (set only in the
// fixer's cloud environment) it exits 0 before reading anything.
//
// In the cloud it blocks, before they happen:
//  - edits outside the limiter's allowed area (src/lib/autofix/path-rules.mjs —
//    the same rules the app re-checks on GitHub's diff before Nic sees a fix)
//  - any push except to the fixer's own claude/autofix-* branches, and any
//    force / delete push
//  - the database CLIs, the Vercel CLI, GitHub writes through gh
//  - network calls to anywhere but the app's own routes and GitHub
// Exit 2 = blocked (the reason goes to Claude on stderr).
//
// Nic, 2026-11-04: "i dont want the agent make unescessary changes which breaks
// other component." The tracked .claude/settings.local.json pre-approves
// `git push *` / `npx supabase *` for Nic's own sessions; in the cloud this
// guard is what stands in front of those.

import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { isAllowedPath } from '../src/lib/autofix/path-rules.mjs'

const ALLOWED_HOSTS = ['greenqubes-ops.vercel.app', 'api.github.com', 'github.com']
const OWN_PUSH = /^git\s+push\s+(?:(?:-u|--set-upstream)\s+)?origin\s+(?:HEAD:)?(?:refs\/heads\/)?claude\/autofix-[a-z0-9._-]+$/

/** @param {string} p */
const slash = p => p.replace(/\\/g, '/')

/**
 * Repo-relative path, or null when the file is outside the repo (scratch
 * files in /tmp are fine). A relative path is resolved from where the session
 * is (`cwd`), then measured from the PROJECT ROOT — after a `cd src`, an edit
 * to ../CLAUDE.md is still CLAUDE.md (final review, 2026-11-04).
 * @param {string} file @param {string} cwd @param {string} projectRoot
 */
function repoRelative(file, cwd, projectRoot) {
  const f = slash(file)
  const base = slash(cwd).replace(/\/+$/, '')
  const root = slash(projectRoot).replace(/\/+$/, '')
  const isAbs = f.startsWith('/') || /^[a-zA-Z]:\//.test(f)
  const abs = path.posix.normalize(isAbs ? f : `${base}/${f}`)
  const same = (a, b) => (/^[a-zA-Z]:/.test(a) ? a.toLowerCase() === b.toLowerCase() : a === b)
  if (!same(abs.slice(0, root.length + 1), `${root}/`)) return null
  return abs.slice(root.length + 1)
}

/** Host allowed for network access? */
function hostAllowed(/** @type {string} */ url) {
  try { return ALLOWED_HOSTS.includes(new URL(url).hostname) } catch { return false }
}

// git options that take a value, before the subcommand (`git -C dir push`).
const GIT_OPTS_WITH_VALUE = ['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix']

/**
 * Judge a `git …` command by its real subcommand, whatever global options
 * come first. Global options before `push` are refused outright — the fixer
 * never needs them, and they are how a push to main slipped through.
 * @param {string[]} rest tokens after "git"
 * @returns {string | null}
 */
function judgeGit(rest) {
  let i = 0
  let hadGlobal = false
  while (i < rest.length && rest[i].startsWith('-')) {
    hadGlobal = true
    i += GIT_OPTS_WITH_VALUE.includes(rest[i]) ? 2 : 1
  }
  const sub = rest[i]
  const args = rest.slice(i + 1)
  const shown = `git ${rest.join(' ')}`
  if (sub === 'push') {
    if (hadGlobal) return `only plain pushes to your own claude/autofix-* branch are allowed: "${shown}"`
    return OWN_PUSH.test(`git push ${args.join(' ')}`.trim())
      ? null
      : `only pushes to your own claude/autofix-* branch are allowed (no force, no delete): "${shown}"`
  }
  if (sub === 'config') {
    // Reads, and setting who the commits are by, only. Everything else
    // (remote.*.push, url.*.insteadOf, alias.*) can turn an allowed push into
    // a push to main.
    const read = args.some(a => ['--get', '--get-all', '--get-regexp', '--list', '-l'].includes(a))
    const key = args.find(a => !a.startsWith('-'))
    if (read || key === 'user.name' || key === 'user.email') return null
    return `changing git settings is off-limits: "${shown}"`
  }
  if (sub === 'remote') {
    const action = args.find(a => !a.startsWith('-'))
    if (!action || ['show', 'get-url'].includes(action)) return null
    return `changing git remotes is off-limits: "${shown}"`
  }
  return null
}

/** @param {string} s */
function tokens(s) {
  return (s.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(t => t.replace(/^["']|["']$/g, ''))
}

/** First real command word, skipping env assignments and npx/pnpm/yarn wrappers. */
function commandOf(/** @type {string[]} */ t) {
  let i = 0
  while (i < t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[i])) i++
  if (['npx', 'pnpx', 'bunx'].includes(t[i])) {
    i++
    while (i < t.length && t[i].startsWith('-')) i++
  } else if ((t[i] === 'pnpm' || t[i] === 'yarn') && (t[i + 1] === 'dlx' || t[i + 1] === 'exec')) {
    i += 2
  } else if (t[i] === 'npm' && t[i + 1] === 'exec') {
    i += 2
    while (i < t.length && t[i].startsWith('-')) i++
  }
  return { cmd: (t[i] ?? '').replace(/@.*$/, ''), rest: t.slice(i + 1) }
}

/** @param {string} segment @returns {string | null} reason to block */
function judgeSegment(segment) {
  const s = segment.trim()
  if (!s) return null

  const { cmd, rest } = commandOf(tokens(s))
  if (cmd === 'git' || cmd.endsWith('/git')) return judgeGit(rest)
  // A git push wrapped in something else (sh -c "…", xargs, env …) is never
  // the fixer's own plain push.
  if (/\bgit\b[^;&|]*\bpush\b/.test(s)) return `pushes must be a plain "git push origin claude/autofix-…": "${s}"`

  if (cmd === 'supabase' || cmd === 'psql') return 'the database is off-limits to the auto-fixer'
  if (cmd === 'vercel') return 'deploying is off-limits — the app puts a fix live only when Nic says so'
  if (cmd === 'gh') {
    if (rest[0] !== 'api') return `only read-only "gh api" calls are allowed: "${s}"`
    const writes = rest.some((t, k) =>
      ['-f', '-F', '--field', '--raw-field', '--input'].includes(t) ||
      ((t === '-X' || t === '--method') && (rest[k + 1] ?? '').toUpperCase() !== 'GET') ||
      /^-X(?!GET$)\S+/i.test(t) || /^--method=(?!GET$)/i.test(t))
    return writes ? `GitHub writes are off-limits: "${s}"` : null
  }
  if (cmd === 'curl' || cmd === 'wget' || /\b(curl|wget)\b/.test(s)) {
    const urls = s.match(/https?:\/\/[^\s"'<>]+/g) ?? []
    if (urls.length === 0) return 'network calls need a literal https URL to the app or GitHub'
    for (const u of urls) {
      let host = ''
      try { host = new URL(u).hostname } catch { return `not a URL: ${u}` }
      if (!ALLOWED_HOSTS.includes(host)) return `network calls may only go to the app or GitHub, not ${host}`
    }
  }
  return null
}

/**
 * @param {{ tool_name?: string, tool_input?: Record<string, unknown>, cwd?: string }} input
 * @param {Record<string, string | undefined>} env
 * @returns {{ block: boolean, reason?: string }}
 */
export function decide(input, env) {
  if (env.GQ_AUTOFIX !== '1') return { block: false }
  const tool = input.tool_name ?? ''
  const ti = input.tool_input ?? {}
  const cwd = input.cwd ?? process.cwd()
  const projectRoot = env.CLAUDE_PROJECT_DIR || cwd

  if (tool === 'WebSearch') return { block: true, reason: 'web search is off-limits to the overnight fixer' }
  if (tool === 'WebFetch') {
    return hostAllowed(String(ti.url ?? ''))
      ? { block: false }
      : { block: true, reason: 'network calls may only go to the app or GitHub' }
  }

  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const file = String(ti.file_path ?? ti.notebook_path ?? '')
    const rel = repoRelative(file, cwd, projectRoot)
    if (rel === null) return { block: false }
    return isAllowedPath(rel)
      ? { block: false }
      : { block: true, reason: `${rel} is off-limits to the overnight fixer — if the fix needs it, report needs_session` }
  }

  if (tool === 'Bash') {
    const command = String(ti.command ?? '')
    for (const segment of command.split(/&&|\|\||;|\||\n/)) {
      const reason = judgeSegment(segment)
      if (reason) return { block: true, reason }
    }
  }
  return { block: false }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  if (process.env.GQ_AUTOFIX !== '1') process.exit(0)
  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', chunk => { raw += chunk })
  process.stdin.on('end', () => {
    let input = {}
    try { input = JSON.parse(raw) } catch { /* nothing to judge */ }
    const verdict = decide(input, process.env)
    if (verdict.block) {
      process.stderr.write(`Blocked by the auto-fixer guard: ${verdict.reason}\n`)
      process.exit(2)
    }
    process.exit(0)
  })
}
