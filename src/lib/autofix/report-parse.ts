// What the cloud fixer may report back (POST /api/autofix/report).
//
// The cloud is an outside caller as far as the app is concerned: everything it
// sends is checked here before anything is written. A fix must name a
// claude/autofix-* branch, a full commit sha and a Vercel preview — nothing
// else can ever be offered to Nic as "ready to try".

export const VERDICTS = ['fix', 'wish', 'junk', 'noise', 'already_fixed', 'known', 'unclear', 'needs_session'] as const
export type Verdict = typeof VERDICTS[number]

export type ItemStatus =
  | 'new' | 'fixing' | 'awaiting_nic' | 'going_live' | 'live'
  | 'retry' | 'dropped' | 'closed' | 'needs_session'

export type ReportRef =
  | { kind: 'bug'; bugReportId: string }
  | { kind: 'crash'; signature: string }
  | { kind: 'item'; itemId: string }

export type ReportFix = { branch: string; headSha: string; previewUrl: string }

export type ReportItem = {
  ref:           ReportRef
  verdict:       Verdict
  severity?:     'major' | 'minor'
  title:         string
  summary:       string
  reason:        string
  whatsNewLine?: string
  fix?:          ReportFix
}

export type Report = { runId: string; items: ReportItem[] }

export const BRANCH_RE = /^claude\/autofix-[a-z0-9._-]+$/

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const str = (x: unknown, max: number, required = true): x is string =>
  typeof x === 'string' && x.length <= max && (!required || x.trim().length > 0)

function parseRef(r: unknown): ReportRef | null {
  if (!isObj(r)) return null
  if (r.kind === 'bug'   && str(r.bugReportId, 64)) return { kind: 'bug', bugReportId: r.bugReportId }
  if (r.kind === 'crash' && str(r.signature, 400)) return { kind: 'crash', signature: r.signature }
  if (r.kind === 'item'  && str(r.itemId, 64))      return { kind: 'item', itemId: r.itemId }
  return null
}

function parseFix(f: unknown): ReportFix | string {
  if (!isObj(f)) return 'fix must be an object'
  if (typeof f.branch !== 'string' || !BRANCH_RE.test(f.branch) || f.branch.includes('..')) {
    return 'fix.branch must be claude/autofix-<lowercase-slug>'
  }
  if (typeof f.headSha !== 'string' || !/^[0-9a-f]{40}$/.test(f.headSha)) return 'fix.headSha must be a 40-character sha'
  if (typeof f.previewUrl !== 'string') return 'fix.previewUrl missing'
  let url: URL
  try { url = new URL(f.previewUrl) } catch { return 'fix.previewUrl is not a URL' }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app')) return 'fix.previewUrl must be an https *.vercel.app link'
  return { branch: f.branch, headSha: f.headSha, previewUrl: f.previewUrl }
}

export function parseReport(body: unknown): { ok: true; report: Report } | { ok: false; error: string } {
  if (!isObj(body)) return { ok: false, error: 'body must be an object' }
  if (!str(body.runId, 64)) return { ok: false, error: 'runId missing' }
  if (!Array.isArray(body.items) || body.items.length > 200) return { ok: false, error: 'items must be an array (max 200)' }

  const items: ReportItem[] = []
  for (const [i, raw] of body.items.entries()) {
    const at = `items[${i}]`
    if (!isObj(raw)) return { ok: false, error: `${at} must be an object` }
    const ref = parseRef(raw.ref)
    if (!ref) return { ok: false, error: `${at}.ref invalid` }
    if (typeof raw.verdict !== 'string' || !(VERDICTS as readonly string[]).includes(raw.verdict)) {
      return { ok: false, error: `${at}.verdict invalid` }
    }
    const verdict = raw.verdict as Verdict
    if (!str(raw.title, 120))           return { ok: false, error: `${at}.title missing or over 120 characters` }
    if (!str(raw.summary, 2000, false)) return { ok: false, error: `${at}.summary must be text` }
    if (!str(raw.reason, 1000, false))  return { ok: false, error: `${at}.reason must be text` }
    if (raw.severity !== undefined && raw.severity !== 'major' && raw.severity !== 'minor') {
      return { ok: false, error: `${at}.severity must be major or minor` }
    }
    if (raw.whatsNewLine !== undefined && !str(raw.whatsNewLine, 200)) {
      return { ok: false, error: `${at}.whatsNewLine must be text up to 200 characters` }
    }

    const item: ReportItem = {
      ref, verdict,
      title:   raw.title,
      summary: raw.summary,
      reason:  raw.reason,
      ...(raw.severity ? { severity: raw.severity as 'major' | 'minor' } : {}),
      ...(raw.whatsNewLine ? { whatsNewLine: raw.whatsNewLine as string } : {}),
    }

    if (raw.fix !== undefined) {
      if (verdict !== 'fix') return { ok: false, error: `${at}.fix is only allowed with verdict fix` }
      const fix = parseFix(raw.fix)
      if (typeof fix === 'string') return { ok: false, error: `${at}.${fix}` }
      item.fix = fix
    }
    if (verdict === 'fix') {
      if (!item.fix)          return { ok: false, error: `${at}: a fix needs its branch, sha and preview` }
      if (!item.severity)     return { ok: false, error: `${at}: a fix needs a severity` }
      if (!item.whatsNewLine) return { ok: false, error: `${at}: a fix needs a What's new line` }
    }
    items.push(item)
  }
  return { ok: true, report: { runId: body.runId, items } }
}

/**
 * Whether a report may overwrite an existing item. Never one that is waiting
 * for Nic, on its way live, live, or dropped by him — a daytime run can see
 * repeats of those crashes, and overwriting them stranded fixes that had
 * already reached production (final review, 2026-11-04). An item ref is only
 * for the retries the run was handed.
 */
export function reportMayUpdate(refKind: ReportRef['kind'], status: ItemStatus): boolean {
  if (refKind === 'item') return status === 'retry'
  return !['awaiting_nic', 'going_live', 'live', 'dropped'].includes(status)
}

export function statusForVerdict(v: Verdict, hasFix: boolean): ItemStatus {
  switch (v) {
    case 'fix':           return hasFix ? 'awaiting_nic' : 'needs_session'
    case 'unclear':
    case 'needs_session': return 'needs_session'
    default:              return 'closed' // wish, junk, noise, known, already_fixed
  }
}
