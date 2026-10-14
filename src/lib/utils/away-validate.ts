// Request validation for the away routes — shared by POST and PATCH. Its own
// file because a Next.js route.ts may only export HTTP handlers and config.

export const ISO_RE  = /^\d{4}-\d{2}-\d{2}$/
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export type TripBody = {
  user_ids?: string[]; title?: string; business?: string | null; location?: string | null
  start_date?: string; start_time?: string; end_date?: string; end_time?: string; note?: string | null
}

/** Null when valid; otherwise the message to show. */
export function validateTrip(b: TripBody): string | null {
  if (!Array.isArray(b.user_ids) || b.user_ids.length === 0) return 'Pick at least one person'
  if (!b.title || !b.title.trim()) return 'Add a title'
  if (!ISO_RE.test(b.start_date ?? '') || !ISO_RE.test(b.end_date ?? '')) return 'Invalid date'
  if (!TIME_RE.test(b.start_time ?? '') || !TIME_RE.test(b.end_time ?? '')) return 'Invalid time'
  const start = `${b.start_date} ${b.start_time}`
  const end   = `${b.end_date} ${b.end_time}`
  if (end <= start) return 'The end must be after the start'
  return null
}

/** Trim; empty becomes null. */
export const cleanText = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)
