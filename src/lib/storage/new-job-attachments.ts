/**
 * Holding area for files attached on the New Job form, before the job exists.
 *
 * Nic, 2026-09-15. A job's attachments normally live under that job's folder
 * and carry a `files` row pointing at it — neither of which exists until the
 * job is saved, which is why the New Job form used to say "Save the job first".
 *
 * So an upload made before saving goes to the person's own holding area, and
 * is COPIED onto the job the moment it is created. Nic's reasoning for this
 * over holding files in the browser: if the draft is discarded, the file goes
 * with it — abandoned uploads are swept by a cron, exactly as the assistant's
 * chat scratch already is.
 */

/** Everything in the holding area lives under here. */
export const NEW_JOB_PREFIX = 'new-job/'

/** One person's holding area. Always ends in a slash — see ownsNewJobScratchKey. */
export function newJobScratchPrefix(userId: string): string {
  return `${NEW_JOB_PREFIX}${userId}/`
}

/**
 * Whether this key is a file THIS person put in the holding area.
 *
 * Load-bearing, not a formality. The key arrives in the request body, so
 * without this check a caller could name any object in the bucket and have it
 * copied onto their brand-new job — a file from a job they cannot open, or
 * another person's upload. The same guard the assistant's chat attachments
 * use on their own prefix.
 *
 * Deliberately strict: the key must start with this exact person's folder,
 * name something inside it, and contain no traversal. A key that merely
 * mentions the prefix somewhere, or belongs to an id that starts the same way,
 * is refused.
 */
export function ownsNewJobScratchKey(userId: string, key: string): boolean {
  if (!userId || !key) return false
  if (key.includes('..')) return false

  const prefix = newJobScratchPrefix(userId)
  if (!key.startsWith(prefix)) return false

  // Something must actually follow the folder, and it must be a single
  // filename rather than a deeper path we never create.
  const rest = key.slice(prefix.length)
  return rest.length > 0 && !rest.includes('/')
}
