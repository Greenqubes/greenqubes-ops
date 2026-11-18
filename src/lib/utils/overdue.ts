// The one "overdue" rule: the schedule card + date strip (red), the bell's
// overdue list and the 9am/6pm overdue Telegram all ask it. Pure; tested in
// overdue.test.ts.
//
// Nic, 2026-11-18: a multi-day job is still in progress until its LAST day,
// so it goes red only after that — every check used to compare today with the
// START date, which made day 2 of a 3-day install red.

/** A job's last day: its End Date when that is later than its start. */
export function lastDayOf(date: string, dateEnd: string | null | undefined): string {
  return dateEnd && dateEnd > date ? dateEnd : date
}

/**
 * Overdue = still scheduled (not completed) and past its last day. On the
 * last day itself it is overdue once its end time has passed — but only when
 * the caller gives the clock (`nowMins`, minutes since midnight Singapore
 * time): the bell and the Telegram do; the schedule card waits for the next
 * day, as it always has. No end time means not until the next day.
 */
export function isOverdue(
  job: { status: string; date: string | null; date_end?: string | null; time_end?: string | null },
  today: string,
  nowMins?: number,
): boolean {
  if (job.status !== 'scheduled' || !job.date) return false
  const last = lastDayOf(job.date, job.date_end)
  if (last < today) return true
  if (last > today || nowMins === undefined || !job.time_end) return false
  const [h, m] = job.time_end.split(':').map(Number)
  return nowMins >= h * 60 + m
}
