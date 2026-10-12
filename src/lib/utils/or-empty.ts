// Run a list read that only feeds a WARNING or a notice, and on any failure
// return an empty list instead of throwing. The Away feature is warning-only:
// if its table is missing or a read fails, the schedule, the job form and the
// Push-to-Schedule check must still work (review I3). The failure is logged
// with its label so it shows in Vercel logs rather than vanishing.

export async function orEmpty<T>(
  read: () => Promise<T[]>,
  label: string,
  log: (msg: string) => void = (m) => console.error(m),
): Promise<T[]> {
  try {
    return await read()
  } catch (err) {
    log(`${label} read failed — showing none: ${err instanceof Error ? err.message : String(err)}`)
    return []
  }
}
