/** How an install-date edit should be treated by the design due-date logic
 *  (spec 2026-10-09). Only 'moved' shifts the due date; 'set' and 'cleared'
 *  leave it alone because there is no old date to measure from or to. */
export type DateChange = 'none' | 'set' | 'cleared' | 'moved'

export function designDateChange(
  oldDate: string | null,
  newDate: string | null | undefined,
): DateChange {
  if (newDate === undefined) return 'none'
  const next = newDate || null
  if (next === oldDate) return 'none'
  if (!oldDate) return 'set'
  if (!next)    return 'cleared'
  return 'moved'
}
