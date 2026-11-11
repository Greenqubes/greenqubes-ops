import { canManageJobFiles, canDeleteJobFile } from './job-file-permissions'
import type { GallerySource } from '@/lib/utils/gallery'
import type { Role } from '@/lib/supabase/types'

/**
 * Who may Delete for everyone from the job Gallery (Nic, 2026-11-11; spec
 * 2026-11-11 Part 3). ONE function, used by the gallery's tick boxes and by
 * the server routes that actually delete, so the two can never disagree.
 *
 * It follows the job PAGE, which is stricter than the database in places
 * (builder check, 2026-11-11): production is view-only on the Files folders,
 * designers are view-only on the production / signed DO / completion photos,
 * and a sales or coordinator who doesn't share an Ongoing job has the Files
 * locked. Chat items are new: the person who sent it, schedulers and admin
 * (WhatsApp's "group admins"), and never once the job is completed.
 *
 * Delete for ME is not decided here — anyone may hide anything they can see.
 */
export type DeleteForEveryoneInput = {
  /** The EFFECTIVE role (a plain admin reads 'scheduler'). */
  role: Role
  /** The REAL admin flag. */
  isAdmin: boolean
  viewerId: string
  source: GallerySource
  /** The files row's kind; null for voice notes. */
  fileKind: string | null
  /** Who sent or uploaded it. */
  byId: string | null
  jobStatus: string | null
  completedAt: string | null
  /** Completion files on the job other than this one. */
  otherCompletionFiles: number
  /** pendingLocks(...).files, as the job page computes it. */
  filesLocked: boolean
  /** designBriefEditable({ status, readOnly: formReadOnly }), as the page passes it. */
  designBriefEditable: boolean
  now?: number
}

export function canDeleteForEveryone(i: DeleteForEveryoneInput): boolean {
  switch (i.source) {
    case 'chat':
    case 'voice':
      return i.jobStatus !== 'completed'
        && ((!!i.byId && i.byId === i.viewerId) || i.role === 'scheduler' || i.isAdmin)
    case 'files':
      return canManageJobFiles(i.role, i.jobStatus).allowed && i.role !== 'production' && !i.filesLocked
    case 'design_brief':
      return i.designBriefEditable && i.role !== 'installer' && canManageJobFiles(i.role, i.jobStatus).allowed
    case 'production':
    case 'completion':
    case 'do':
      return i.role !== 'designer' && canDeleteJobFile({
        role: i.role, jobStatus: i.jobStatus, completedAt: i.completedAt, fileKind: i.fileKind,
        otherCompletionFiles: i.otherCompletionFiles, now: i.now,
      }).allowed
  }
}
