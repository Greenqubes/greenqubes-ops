/**
 * Installer "All Jobs" (Nic, 2026-11-10): every confirmed job in the company
 * for a day, look-only, so a last-minute move by the scheduler doesn't catch
 * an installer out.
 *
 * Installers see the work, not the money: a card carries exactly the fields
 * in ALL_JOBS_CARD_KEYS and nothing else. toAllJobsCard builds it field by
 * field — never spread a database row into it.
 *
 * Pure so its test runs standalone. Dates are plain 'YYYY-MM-DD' strings and
 * all date maths is done in UTC, so the server's timezone can't shift a day.
 */
import { noDriverYet, type Crew } from './installer-crew'
import type { Punctuality } from '@/lib/supabase/types'

/** What the server reads from `jobs` — `client` only to fall back to when a
 *  job has no title; it is not put on the card. */
export type AllJobsRow = {
  id: string; date: string; date_end: string | null; time_start: string | null; time_end: string | null
  project_title: string | null; client: string; location: string; punctuality: Punctuality
}

export type AllJobsCard = {
  id: string; date: string; date_end: string | null; time_start: string | null; time_end: string | null
  title: string; location: string; punctuality: Punctuality
  crew: Crew
  /** The installer looking is on this job — outlined, and it opens. */
  mine: boolean
  /** No driver and no outside contractor — same as the driver board's Unassigned. */
  noDriver: boolean
}

export const ALL_JOBS_CARD_KEYS = [
  'id', 'date', 'date_end', 'time_start', 'time_end', 'title', 'location', 'punctuality', 'crew', 'mine', 'noDriver',
] as const satisfies readonly (keyof AllJobsCard)[]

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function toUtc(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const fromUtc = (dt: Date) => dt.toISOString().slice(0, 10)

/** The day in the URL, or today when it is missing or not a real date. The
 *  result goes into a database filter, so anything else is refused here. */
export function parseDay(param: string | string[] | undefined, today: string): string {
  if (typeof param !== 'string' || !ISO_DAY.test(param)) return today
  return fromUtc(toUtc(param)) === param ? param : today
}

export function jobCoversDay(job: { date: string; date_end: string | null }, day: string): boolean {
  return job.date <= day && day <= (job.date_end ?? job.date)
}

export function shiftDay(day: string, days: number): string {
  const dt = toUtc(day)
  dt.setUTCDate(dt.getUTCDate() + days)
  return fromUtc(dt)
}

/** Monday to Sunday of the week the day falls in. */
export function weekOf(day: string): string[] {
  const back = (toUtc(day).getUTCDay() + 6) % 7   // Mon=0 … Sun=6
  const monday = shiftDay(day, -back)
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i))
}

export function toAllJobsCard(row: AllJobsRow, crew: Crew): AllJobsCard {
  const everyone = [...crew.drivers, ...crew.support, ...crew.externals]
  return {
    id:          row.id,
    date:        row.date,
    date_end:    row.date_end,
    time_start:  row.time_start,
    time_end:    row.time_end,
    title:       row.project_title || row.client || 'Untitled job',
    location:    row.location,
    punctuality: row.punctuality,
    crew,
    mine:        everyone.some(p => p.you),
    noDriver:    noDriverYet(crew),
  }
}

/** By start time; jobs with no time go last (the same as My Jobs). */
export function sortAllJobs(cards: AllJobsCard[]): AllJobsCard[] {
  return [...cards].sort((a, b) =>
    a.time_start === b.time_start ? 0
    : a.time_start === null ? 1
    : b.time_start === null ? -1
    : a.time_start < b.time_start ? -1 : 1)
}
