/**
 * Pure rules for the schedule job card — no React, no DOM, so the card and
 * its tests lean on the same logic.
 *
 * From Nic's two sketches and annotated card, 2026-09-15.
 */

export type CardAssignee = {
  users?:            { id: string; name: string } | null
  is_suggestion?:    boolean
  is_sub_installer?: boolean
}

/**
 * Split a job's crew into the two lines the card shows: **Driver** and
 * **Support Crew**.
 *
 * `is_sub_installer` lives on `job_assignees`, not on the person — it is a
 * fact about THIS job. The same installer drives one job and supports
 * another, so the card must read the flag per row rather than look the
 * person up.
 *
 * Suggestions are dropped here as well as in the query. A suggestion is a
 * tentative sales pick that an installer must never see as confirmed work
 * (the rule behind migration 0037), and this card is fed from more than one
 * query — so the guard belongs where the names are turned into pills, not
 * only upstream.
 *
 * Names come back WHOLE. The old compact row used `name.split(' ')[0]`,
 * which renders "Xiao Yi" as "Xiao" and collapses both "Ali B" and
 * "Ali Ramjan" to "Ali" — two different people, identical on the card.
 */
export function splitCrew(assignees: CardAssignee[]): { drivers: string[]; support: string[] } {
  const drivers: string[] = []
  const support: string[] = []

  for (const row of assignees ?? []) {
    if (row?.is_suggestion) continue
    const name = row?.users?.name
    if (!name) continue
    ;(row.is_sub_installer ? support : drivers).push(name)
  }

  return { drivers, support }
}
