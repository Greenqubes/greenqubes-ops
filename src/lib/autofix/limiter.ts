// Measures a fix the cloud pushed, before Nic is ever offered it.
//
// The cloud is told the same limits and a hook blocks it there too, but this
// is the check that counts: it runs in the app, on GitHub's own diff, so a
// fix that talked its way past the instructions still never reaches Nic.

import { MAX_FILES, MAX_LINES, isAllowedPath, isTestFile, normalisePath } from './path-rules.mjs'

/** One file from GitHub's compare API (`files[]`). */
export type ChangedFile = {
  filename:           string
  status:             string   // added | modified | removed | renamed | copied | changed | unchanged
  additions:          number
  deletions:          number
  previous_filename?: string
}

export type LimitCheck = {
  ok:         boolean
  files:      number   // non-test files changed
  lines:      number   // additions + deletions in those files
  violations: string[] // plain English — they reach Nic as "needs a session: …"
}

export function checkLimits(changed: ChangedFile[]): LimitCheck {
  const violations: string[] = []
  let files = 0
  let lines = 0

  for (const c of changed) {
    const f = normalisePath(c.filename)
    if (!isAllowedPath(f)) {
      violations.push(`changes ${f}, which is off-limits`)
      continue
    }
    if (c.status === 'renamed' && c.previous_filename && !isAllowedPath(c.previous_filename)) {
      violations.push(`changes ${normalisePath(c.previous_filename)}, which is off-limits`)
      continue
    }
    if (isTestFile(f)) {
      // Tests are free to add or adjust — but never to delete.
      if (c.status === 'removed') violations.push(`removes ${f}`)
      continue
    }
    if (c.status === 'added')        violations.push(`adds a new file ${f}`)
    else if (c.status === 'removed') violations.push(`removes ${f}`)
    else if (c.status === 'renamed') violations.push(`renames ${normalisePath(c.previous_filename ?? '?')} to ${f}`)
    files += 1
    lines += c.additions + c.deletions
  }

  if (files > MAX_FILES) violations.push(`changes ${files} files (the limit is ${MAX_FILES})`)
  if (lines > MAX_LINES) violations.push(`changes ${lines} lines (the limit is ${MAX_LINES})`)
  if (files === 0 && violations.length === 0) violations.push('changes nothing')

  return { ok: violations.length === 0, files, lines, violations }
}
