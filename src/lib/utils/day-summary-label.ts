/** The date part of a 6pm-summary change line. A job moved back to Ongoing
 *  has no date by the time the summary runs (spec 2026-10-09). */
export function changeDateLabel(date: string | null, format: (iso: string) => string): string {
  return date ? format(date) : 'Postponed, date to be confirmed'
}
