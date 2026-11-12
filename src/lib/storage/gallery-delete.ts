import { canManageJobFiles, canDeleteJobFile } from './job-file-permissions'
import { stageOf } from '@/lib/utils/job-stage'
import { canEditAtStage, pendingLocks, type StageJob4Rules } from '@/lib/utils/job-stage-rules'
import { designBriefEditable } from '@/lib/utils/job-form-rules'
import { isReadOnlyOfficeRole } from '@/lib/auth/capabilities'
import type { GallerySource } from '@/lib/utils/gallery'
import type { Role } from '@/lib/supabase/types'

/** The two page gates the delete rule needs, worked out exactly as
 *  JobDetailShell does (readOnly = completed; formReadOnly adds the read-only
 *  role and the Ongoing lock) — so the server can ask the same questions the
 *  page answered without a page. */
export function pageFileGates(input: {
  role: Role; isAdmin: boolean; viewerId: string; job: StageJob4Rules
}): { filesLocked: boolean; designBriefEditable: boolean } {
  const { role, isAdmin, viewerId, job } = input
  const stage = stageOf(job.status)
  const lock = pendingLocks({
    stage, canEdit: canEditAtStage({ id: viewerId, role, isAdmin }, job), isDesigner: role === 'designer',
  })
  const formReadOnly = stage === 'completed' || isReadOnlyOfficeRole(role) || lock.form
  return { filesLocked: lock.files, designBriefEditable: designBriefEditable({ status: job.status, readOnly: formReadOnly }) }
}

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
 * (WhatsApp's "group admins"), and never once the job is completed. The
 * sender's own right lasts 24 hours from sending (Nic, 2026-11-12); after
 * that they only get Delete for me. Schedulers and admin keep it.
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
  /** When the item was sent or uploaded (files.ts / messages.ts). */
  sentAt: string | null
  now?: number
}

/** How long the sender may Delete for everyone (Nic, 2026-11-12). */
export const OWN_DELETE_WINDOW_MS = 24 * 60 * 60 * 1000

function withinOwnWindow(sentAt: string | null, now: number): boolean {
  const sent = sentAt ? Date.parse(sentAt) : NaN
  return Number.isFinite(sent) && now - sent < OWN_DELETE_WINDOW_MS
}

export function canDeleteForEveryone(i: DeleteForEveryoneInput): boolean {
  switch (i.source) {
    case 'chat':
    case 'voice':
      return i.jobStatus !== 'completed'
        && (i.role === 'scheduler' || i.isAdmin
          || (!!i.byId && i.byId === i.viewerId && withinOwnWindow(i.sentAt, i.now ?? Date.now())))
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

/** Which of a ticked batch may really be deleted for everyone. Each item's
 *  own rule (`allowed`) looks at the job as it is NOW, so on a completed job
 *  ticking every completion photo would pass item by item and leave none
 *  (final review C1): at most completionCount − 1 completion photos go; the
 *  rest are only hidden for the person. Keeps the given order. */
export function everyoneBatch(
  items: Array<{ key: string; fileKind: string | null; allowed: boolean }>,
  completionCount: number,
  jobCompleted: boolean,
): Set<string> {
  const out = new Set<string>()
  let completionLeft = jobCompleted ? Math.max(0, completionCount - 1) : Infinity
  for (const it of items) {
    if (!it.allowed) continue
    if (it.fileKind === 'completion') {
      if (completionLeft <= 0) continue
      completionLeft--
    }
    out.add(it.key)
  }
  return out
}

/** A voice note's stored key must sit in THIS job's voice folder
 *  (jobs/<r2_folder or job id>/voice/…), with no "..". voice_url is free text
 *  sent by the browser, so without this a message could name any stored file
 *  — and signing or deleting it would act on that file (final review I9). */
export function voiceKeyBelongsToJob(key: string, r2Folder: string | null, jobId: string): boolean {
  if (key.includes('..') || key.includes('\\')) return false
  return [r2Folder, jobId].filter((x): x is string => !!x)
    .some(folder => key.startsWith(`jobs/${folder}/voice/`) && key.length > `jobs/${folder}/voice/`.length)
}
