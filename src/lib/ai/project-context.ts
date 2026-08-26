// Pure module — builds the stable project-context strings for the chat route
// (assistant upgrade Phase 4). No Supabase/Next imports so the standalone test
// runs under plain tsx. These strings sit inside the prompt-cache prefix: they
// must be DETERMINISTIC for a given project state (same input → byte-identical
// output), so repeat turns inside a project hit the cache.

export interface ProjectFileMeta { name: string; mime: string }

/** Second (cached) system block for a chat inside a project. */
export function projectSystemBlock(name: string, instructions: string | null): string {
  const parts = [
    `This conversation is inside the user's project "${name}". Chats in a project share the project's instructions and reference files below — treat them as standing context for every answer in this conversation.`,
  ]
  const trimmed = instructions?.trim()
  if (trimmed) {
    parts.push(`Project instructions from the user — follow them in every answer:\n${trimmed}`)
  }
  return parts.join('\n\n')
}

/** Leading text for the project-files blocks at the front of the first user
 *  message. Empty string when the project has no files. */
export function projectFilesLeadText(files: readonly ProjectFileMeta[]): string {
  if (files.length === 0) return ''
  const items = files.map((f, i) =>
    `${i + 1}. "${f.name}" (${f.mime === 'application/pdf' ? 'pdf' : 'image'})`)
  return `Project reference files, shared with every chat in this project:\n${items.join('\n')}`
}
