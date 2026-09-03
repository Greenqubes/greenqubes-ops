/**
 * Freshness rule for cron rows on Admin → Health.
 * Each cron has its own longest normal gap (e.g. the twice-daily overdue cron
 * goes 15h overnight between the 6pm and 9am runs) — only a longer silence warns.
 */

export type CronFreshness =
  | { status: 'unknown'; detail: string }
  | { status: 'warn'; detail: string }
  | { status: 'ok'; lastRunISO: string }

export function cronFreshness(
  lastRunISO: string | null,
  nowISO: string,
  maxGapHours: number,
  expectation: string,
): CronFreshness {
  if (!lastRunISO) return { status: 'unknown', detail: 'No cron run recorded yet' }
  const hrs = Math.floor((new Date(nowISO).getTime() - new Date(lastRunISO).getTime()) / 3_600_000)
  if (hrs > maxGapHours) return { status: 'warn', detail: `Last run ${hrs}h ago (${expectation})` }
  return { status: 'ok', lastRunISO }
}
