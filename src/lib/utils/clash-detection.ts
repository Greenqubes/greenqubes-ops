import type { FCFSJob } from '@/lib/supabase/queries/fcfs'

// Clash grading (approved in the FCFS mockup review, 2026-06-05):
//   hard — strict + strict, both with a fixed start time: must resolve
//   soft — one side flexible, OR a strict pair where a job has no fixed
//          start (whole-day "floater") — same rule as the push-time check
//   flexible + flexible — no clash at all
export type ClashSeverity = 'hard' | 'soft'

export interface InstallerClash {
  installerId:        string
  installerName:      string
  date:               string
  severity:           ClashSeverity
  /** True when either side of the overlap is only a sales suggestion. */
  involvesSuggestion: boolean
  /** Earlier FCFS rank — has priority. */
  jobA:               FCFSJob
  jobB:               FCFSJob
}

const hhmm = (t: string | null) => t?.slice(0, 5) ?? null

// Same semantics as the push-time clash check: a job with no start time is a
// whole-day floater and overlaps everything that day; open-ended ranges
// overlap anything from their start onwards.
export function timesOverlap(
  s1: string | null, e1: string | null,
  s2: string | null, e2: string | null,
): boolean {
  const [a, b, c, d] = [hhmm(s1), hhmm(e1), hhmm(s2), hhmm(e2)]
  if (!a || !c) return true
  if (b && d)   return a < d && c < b
  if (b)        return c >= a && c < b
  if (d)        return a >= c && a < d
  return a === c
}

function severityOf(a: FCFSJob, b: FCFSJob): ClashSeverity | null {
  const aStrict = a.punctuality === 'strict'
  const bStrict = b.punctuality === 'strict'
  if (!aStrict && !bStrict) return null
  if (aStrict && bStrict) {
    const bothFixed = !!hhmm(a.time_start) && !!hhmm(b.time_start)
    return bothFixed ? 'hard' : 'soft'
  }
  return 'soft'
}

// Suggestions are included — a tentative pick must not double-book someone —
// but flagged so the board can render them as unconfirmed rather than clashing.
// Sub-installers are excluded; they work under their lead's booking.
export function detectClashes(jobs: FCFSJob[]): InstallerClash[] {
  const clashes: InstallerClash[] = []

  for (let i = 0; i < jobs.length; i++) {
    for (let j = i + 1; j < jobs.length; j++) {
      const a = jobs[i]
      const b = jobs[j]
      if (a.date !== b.date) continue
      if (!timesOverlap(a.time_start, a.time_end, b.time_start, b.time_end)) continue

      const severity = severityOf(a, b)
      if (!severity) continue

      const aPeople = a.assignees.filter(x => !x.is_sub_installer)
      const bPeople = b.assignees.filter(x => !x.is_sub_installer)

      for (const person of aPeople) {
        const shared = bPeople.find(x => x.user_id === person.user_id)
        if (!shared) continue
        const first = a.fcfs_rank <= b.fcfs_rank ? a : b
        clashes.push({
          installerId:        person.user_id,
          installerName:      person.name,
          date:               a.date,
          severity,
          involvesSuggestion: person.is_suggestion || shared.is_suggestion,
          jobA:               first,
          jobB:               first === a ? b : a,
        })
      }
    }
  }

  return clashes
}

/** Clashes where the installer is formally booked on both sides. */
export function confirmedClashes(clashes: InstallerClash[]): InstallerClash[] {
  return clashes.filter(c => !c.involvesSuggestion)
}

/** All clashes touching one installer (suggestions included — panel warning). */
export function clashesForInstaller(clashes: InstallerClash[], installerId: string): InstallerClash[] {
  return clashes.filter(c => c.installerId === installerId)
}
