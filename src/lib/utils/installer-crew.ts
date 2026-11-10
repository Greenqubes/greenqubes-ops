/**
 * Who is on a job, for the installer's Team box (Nic's pick B, 2026-11-07):
 * Driver, Support Crew and External rows of name pills.
 *
 * Installers cannot read their co-workers' crew rows (migration 0037) or the
 * outside contractors at all (0039/0040), so these rows are read on the
 * server with the service key and only the names produced here reach the
 * browser. Suggestions are dropped here as well as upstream: a tentative pick
 * must never look like confirmed work to an installer.
 *
 * Driver vs Support Crew follows the same per-row `is_sub_installer` rule as
 * `splitCrew` (job-card.ts) — a fact about THIS job, not the person.
 *
 * Pure so its test runs standalone.
 */

export type CrewSource = {
  job_assignees: Array<{ is_suggestion?: boolean; is_sub_installer?: boolean; users?: { id: string; name: string } | null }>
  job_external_contacts: Array<{ is_suggestion?: boolean; external_contacts?: { name: string } | null }>
}

/** `you` marks the person looking at the screen (a black pill). */
export type CrewPerson = { name: string; you: boolean }
export type Crew = { drivers: CrewPerson[]; support: CrewPerson[]; externals: CrewPerson[] }

export const EMPTY_CREW: Crew = { drivers: [], support: [], externals: [] }

export function crewOf(src: CrewSource, viewerId: string | null): Crew {
  const people = (src.job_assignees ?? []).flatMap(a =>
    !a || a.is_suggestion || !a.users?.name ? [] :
    [{ sub: !!a.is_sub_installer, p: { name: a.users.name, you: viewerId !== null && a.users.id === viewerId } }])

  return {
    drivers:   people.filter(x => !x.sub).map(x => x.p),
    support:   people.filter(x => x.sub).map(x => x.p),
    externals: (src.job_external_contacts ?? []).flatMap(e =>
      !e || e.is_suggestion || !e.external_contacts?.name ? [] : [{ name: e.external_contacts.name, you: false }]),
  }
}

/** Job ids in batches for an `.in()` filter. The ids travel in the request
 *  URL, and an admin previewing as installer can see every scheduled job —
 *  hundreds of ids in one URL would be refused. Duplicates are sent once. */
export function idBatches(ids: string[], size = 100): string[][] {
  const unique = [...new Set(ids)]
  const out: string[][] = []
  for (let i = 0; i < unique.length; i += size) out.push(unique.slice(i, i + size))
  return out
}

/** Same answer as the scheduler's driver board calling a job Unassigned
 *  (`primaryBand` in driver-board.ts): no driver and no outside contractor.
 *  Support crew alone does not count; a contractor alone does. */
export function noDriverYet(crew: Crew): boolean {
  return crew.drivers.length === 0 && crew.externals.length === 0
}
