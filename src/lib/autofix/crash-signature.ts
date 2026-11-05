// Crash grouping for the auto-fixer, and the "which desk" label for the
// Crashes tab (Nic, 2026-11-04: "so i know which desk its from").
//
// The Crashes tab held 40 rows on 2026-11-04 but only 7 problems — one of them
// 24 times. A signature strips what varies between copies of the same fault
// (job ids, chunk numbers, deploy ids) so repeats collapse into one item and
// are fixed, or closed, once.

export type CrashRow = {
  id:              string
  occurred_at:     string
  route:           string
  error_message:   string
  stack_trace:     string | null
  component_stack: string | null
  user_agent:      string | null
  build_id?:       string | null
  user_email?:     string | null
}

export type CrashGroup = {
  signature: string
  count:     number
  firstSeen: string
  lastSeen:  string
  routes:    string[]
  buildIds:  string[]
  phones:    number
  pcs:       number
  sample: {
    route:          string
    errorMessage:   string
    stackTrace:     string | null
    componentStack: string | null
  }
  rowIds: string[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function normaliseRoute(route: string): string {
  const path = route.split(/[?#]/)[0]
  return path
    .split('/')
    .map(seg => (UUID.test(seg) ? ':id' : /^\d+$/.test(seg) ? ':n' : seg))
    .join('/')
}

function normaliseMessage(message: string): string {
  return message
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/https?:\/\/[^\s)]+/g, ':url')
    .replace(/chunk \d+/gi, 'chunk :n')
    .replace(/\b[0-9a-f]{8,}\b/gi, ':hex')
    .replace(/\b\d{3,}\b/g, ':n')
    .slice(0, 200)
}

export function crashSignature(errorMessage: string, route: string): string {
  return `${normaliseMessage(errorMessage)} @ ${normaliseRoute(route)}`
}

export function groupCrashes(rows: CrashRow[]): CrashGroup[] {
  const groups = new Map<string, { group: CrashGroup; newest: CrashRow }>()
  for (const r of rows) {
    const signature = crashSignature(r.error_message, r.route)
    const device = deviceOf(r.user_agent)
    const g = groups.get(signature)
    if (!g) {
      groups.set(signature, {
        newest: r,
        group: {
          signature,
          count:     1,
          firstSeen: r.occurred_at,
          lastSeen:  r.occurred_at,
          routes:    [normaliseRoute(r.route)],
          buildIds:  r.build_id ? [r.build_id] : [],
          phones:    device === 'Phone' || device === 'Tablet' ? 1 : 0,
          pcs:       device === 'PC' ? 1 : 0,
          sample:    sampleOf(r),
          rowIds:    [r.id],
        },
      })
      continue
    }
    const x = g.group
    x.count += 1
    if (r.occurred_at < x.firstSeen) x.firstSeen = r.occurred_at
    if (r.occurred_at > x.lastSeen)  x.lastSeen = r.occurred_at
    const route = normaliseRoute(r.route)
    if (!x.routes.includes(route)) x.routes.push(route)
    if (r.build_id && !x.buildIds.includes(r.build_id)) x.buildIds.push(r.build_id)
    if (device === 'Phone' || device === 'Tablet') x.phones += 1
    if (device === 'PC') x.pcs += 1
    x.rowIds.push(r.id)
    if (r.occurred_at > g.newest.occurred_at) {
      g.newest = r
      x.sample = sampleOf(r)
    }
  }
  return [...groups.values()].map(g => g.group).sort((a, b) => b.count - a.count)
}

function sampleOf(r: CrashRow): CrashGroup['sample'] {
  return {
    route:          r.route,
    errorMessage:   r.error_message,
    stackTrace:     r.stack_trace,
    componentStack: r.component_stack,
  }
}

export function deviceOf(ua: string | null): 'Phone' | 'Tablet' | 'PC' | 'Unknown' {
  if (!ua) return 'Unknown'
  if (/iPad|Tablet/i.test(ua)) return 'Tablet'
  if (/iPhone|Mobile/i.test(ua)) return 'Phone'
  if (/Android/i.test(ua)) return 'Tablet' // Android without "Mobile" is a tablet
  return 'PC'
}

function browserOf(ua: string): string {
  const major = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0]
  if (/Edg\//.test(ua))     return `Edge ${major(/Edg\/([\d.]+)/) ?? ''}`.trim()
  if (/OPR\//.test(ua))     return 'Opera'
  if (/Chrome\//.test(ua))  return `Chrome ${major(/Chrome\/([\d.]+)/) ?? ''}`.trim()
  if (/Firefox\//.test(ua)) return `Firefox ${major(/Firefox\/([\d.]+)/) ?? ''}`.trim()
  if (/Safari\//.test(ua))  return `Safari ${major(/Version\/([\d.]+)/) ?? ''}`.trim()
  return 'Unknown browser'
}

function osOf(ua: string): string {
  if (/iPhone/.test(ua))     return 'iOS'
  if (/iPad/.test(ua))       return 'iPadOS'
  if (/Android/.test(ua))    return 'Android'
  if (/Windows/.test(ua))    return 'Windows'
  if (/Mac OS X/.test(ua))   return 'macOS'
  if (/Linux/.test(ua))      return 'Linux'
  return 'Unknown OS'
}

/** "PC · Chrome 141 · Windows" — what the Crashes tab shows beside a name. */
export function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device'
  return `${deviceOf(ua)} · ${browserOf(ua)} · ${osOf(ua)}`
}
