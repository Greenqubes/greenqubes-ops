// What may be uploaded, and how big. Pure and dependency-free so it can be
// tested standalone — r2.ts builds an S3 client at module load, which a test
// has no business doing.
//
// History worth keeping (Nic, 2026-09-14): completion photos rejected video
// even though the file picker offered video files and the file list already
// had a video icon ready to draw. The UI was built for video; only this gate
// was never updated. The upload failed with a bare 400 that the page turned
// into "Save failed — try again", so the real reason never reached anyone.

import type { FileKind } from '@/lib/supabase/types'

/** Completion clips are walkthroughs of finished work, not films — and they
 *  are uploaded from site on mobile data. 100MB is roughly 90 seconds at a
 *  phone's normal quality (Nic's call, 2026-09-14). */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024

/** Kinds that hold a picture of the work. `completion` also takes video. */
export function isImageKind(kind: FileKind): boolean {
  return kind === 'photo' || kind === 'completion'
}

export function isVideoType(contentType: string): boolean {
  return contentType.startsWith('video/')
}

/** photo → image only · completion → image or video · voice → audio ·
 *  everything else (do, attachment, production_instructions, …) → anything. */
export function validateContentType(kind: FileKind, contentType: string): boolean {
  if (kind === 'completion') return contentType.startsWith('image/') || isVideoType(contentType)
  if (isImageKind(kind))     return contentType.startsWith('image/')
  if (kind === 'voice')      return contentType.startsWith('audio/')
  return true
}

export type UploadCheck =
  | { ok: true }
  | { ok: false; reason: 'type' }
  | { ok: false; reason: 'size'; limitBytes: number }

/**
 * The whole gate in one call. `bytes` is optional because the server only
 * learns the real size when the object lands; the browser checks it up front
 * so nobody uploads for two minutes before being told no.
 */
export function checkUpload(kind: FileKind, contentType: string, bytes?: number): UploadCheck {
  if (!validateContentType(kind, contentType)) return { ok: false, reason: 'type' }
  if (isVideoType(contentType) && bytes !== undefined && bytes > MAX_VIDEO_BYTES) {
    return { ok: false, reason: 'size', limitBytes: MAX_VIDEO_BYTES }
  }
  return { ok: true }
}

/** Human-readable megabytes for an error message — 100MB, not 104857600. */
export function bytesToMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024))
}
