// Merge nested jobs' date spans into the "15/9/26 – 19/9/26, 23/9/26" lines
// shown on /projects cards (round 1) and folder headers (round 2). Pure
// string math on ISO dates — no Date locale calls (dates stay English).

export type Span  = { date: string; date_end: string | null }
export type Range = { start: string; end: string }

function nextDayISO(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export function mergeDateRanges(spans: Span[]): Range[] {
  const norm = spans
    .map(s => ({ start: s.date, end: s.date_end && s.date_end > s.date ? s.date_end : s.date }))
    .sort((a, b) => a.start.localeCompare(b.start))
  const out: Range[] = []
  for (const r of norm) {
    const last = out[out.length - 1]
    if (last && r.start <= nextDayISO(last.end)) {
      if (r.end > last.end) last.end = r.end
    } else {
      out.push({ ...r })
    }
  }
  return out
}

function dmy(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${Number(d)}/${Number(m)}/${y.slice(2)}`
}

export function formatRanges(ranges: Range[]): string {
  return ranges
    .map(r => (r.start === r.end ? dmy(r.start) : `${dmy(r.start)} – ${dmy(r.end)}`))
    .join(', ')
}
