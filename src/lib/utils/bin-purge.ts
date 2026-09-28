/**
 * Emptying one bin entry, in the only safe order: CLAIM the row first (delete
 * it and get its R2 keys back in one step), THEN delete the files.
 *
 * The first version deleted files first and the row last. A restore landing
 * in between brought the job back with every file already gone, and a row
 * delete that failed after the files went left an entry that could still be
 * restored — broken. Claim-first means the worst case is an orphaned object
 * in storage, never a job pointing at missing files. (Final review, 2026-09-28.)
 *
 * Pure orchestration so the order can be tested without a database.
 */
export async function purgeClaimed(
  claim: () => Promise<string[] | null>,
  deleteKey: (key: string) => Promise<void>,
): Promise<{ filesDeleted: number; filesFailed: number } | null> {
  const keys = await claim()
  if (keys === null) return null
  let filesDeleted = 0, filesFailed = 0
  for (const k of keys) {
    try { await deleteKey(k); filesDeleted++ } catch { filesFailed++ }
  }
  return { filesDeleted, filesFailed }
}
