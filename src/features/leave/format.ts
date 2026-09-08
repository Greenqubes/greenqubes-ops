// Date labels for the Leave tab.
//
// A static month table, NOT toLocaleDateString — the /schedule hydration
// error (#418) traces to locale calls differing between server and browser,
// and the standing rule is that day/month names are always English in every
// UI language anyway. No Date object either: parsing 'YYYY-MM-DD' by hand
// avoids the timezone shift a `new Date(iso)` introduces.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** '2026-09-10' -> '10 Sep 2026' */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** '2026-09-10' -> '10 Sep' — for lists where the year is obvious. */
export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  if (!m || !d) return iso
  return `${d} ${MONTHS[m - 1]}`
}

/** Today as 'YYYY-MM-DD' in the viewer's own timezone (the team is all SGT). */
export function todayISO(): string {
  const now = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
