/**
 * The side panel's job row (My Jobs panel), Nic's pick A, 2026-11-10: the
 * client moves up beside the date, then the title, then one slim line for the
 * address and one for the description. The scheduler needs the address to
 * arrange jobs; sales wants the description.
 *
 * Pure so its test runs standalone.
 */

/** Text squeezed onto one line — descriptions are often typed over several
 *  lines. Nothing (null) when there is nothing to show, so the row can leave
 *  the line out instead of drawing an empty one. */
export function oneLine(text: string | null | undefined): string | null {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  return s || null
}

/** "Mon 9 Nov · Fossil". When the job has no title the title line already
 *  falls back to the client, so the client is not printed twice. */
export function panelRowHead(dateLabel: string, job: { project_title: string | null; client: string }): string {
  const client = oneLine(job.client)
  return job.project_title && client ? `${dateLabel} · ${client}` : dateLabel
}
