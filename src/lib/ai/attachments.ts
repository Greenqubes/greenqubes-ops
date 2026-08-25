// Pure module — attachment rules for the assistant chat (Phase 3). No
// Supabase/Next imports so the standalone test runs under plain tsx.
// Caps are sized under the Anthropic API limits: 5 MB per image (hard API
// limit), 32 MB per request (base64 inflates ~4/3, so 20 MB of files per
// message keeps a single-message request comfortably under it).

export const MAX_FILES_PER_MESSAGE = 5
export const MAX_IMAGE_BYTES   = 5 * 1024 * 1024
export const MAX_PDF_BYTES     = 15 * 1024 * 1024
export const MAX_MESSAGE_BYTES = 20 * 1024 * 1024

export const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
export const PDF_MIME = 'application/pdf'

export interface ChatAttachment {
  id:   string   // client-generated, unique within the conversation
  key:  string   // R2 scratch key: asst-chat/{userId}/{uuid}.{ext}
  name: string
  mime: string
  size: number
}

/** null = accepted; 'type' = unsupported mime (incl. HEIC — the Anthropic API
 *  rejects it); 'size' = over the per-file cap for its type. */
export function validateAttachment(_name: string, mime: string, size: number): 'type' | 'size' | null {
  if (mime === PDF_MIME) return size > MAX_PDF_BYTES ? 'size' : null
  if (IMAGE_MIMES.has(mime)) return size > MAX_IMAGE_BYTES ? 'size' : null
  return 'type'
}

/** A request may only reference the caller's own scratch objects. */
export function isOwnScratchKey(key: string, userId: string): boolean {
  return key.startsWith(`asst-chat/${userId}/`) && !key.includes('..')
}

/** Text appended to a user message so the model can reference attachments by
 *  id when calling create_pending_job. */
export function attachmentNote(atts: readonly ChatAttachment[]): string {
  if (atts.length === 0) return ''
  const items = atts.map(a => `${a.id} = "${a.name}" (${a.mime === PDF_MIME ? 'pdf' : 'image'})`)
  return `Attached files (reference by id in create_pending_job): ${items.join(', ')}`
}
