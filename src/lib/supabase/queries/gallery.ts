import type { createServiceClient } from '@/lib/supabase/service'
import { mediaKindOf } from '@/lib/utils/gallery'

/**
 * Server side of the job Gallery (spec 2026-11-11 Part 3). Every function
 * takes the SERVICE client: callers have already asked the caller's own
 * session whether they can see the job (callerCanSeeJob), and decide with
 * canDeleteForEveryone (src/lib/storage/gallery-delete.ts).
 */

type Svc = ReturnType<typeof createServiceClient>

export type DeleteJobContext = {
  status: string
  completed_at: string | null
  created_by: string | null
  sales_poc_id: string | null
  coordinatorIds: string[]
  /** The job's storage folder (jobs/<r2_folder>/…); null on jobs from before 0042. */
  r2_folder: string | null
}

/** What the delete rule needs to know about the job. null = no such job. */
export async function loadDeleteContext(svc: Svc, jobId: string): Promise<DeleteJobContext | null> {
  const { data } = await svc.from('jobs')
    .select('status, completed_at, created_by, sales_poc_id, r2_folder, job_coordinators(user_id)')
    .eq('id', jobId)
    .maybeSingle() as {
      data: { status: string; completed_at: string | null; created_by: string | null; sales_poc_id: string | null
        r2_folder: string | null; job_coordinators: Array<{ user_id: string }> } | null
      error: unknown
    }
  if (!data) return null
  return {
    status: data.status, completed_at: data.completed_at, created_by: data.created_by,
    sales_poc_id: data.sales_poc_id, coordinatorIds: (data.job_coordinators ?? []).map(c => c.user_id),
    r2_folder: data.r2_folder,
  }
}

/** The grey "Photo deleted by <name>" line a chat item leaves behind when it
 *  is deleted for everyone. Best effort: the item is already gone, so a
 *  failure here is logged, never thrown into the caller's success. */
export async function recordChatDeletion(svc: Svc, input: {
  jobId: string; itemName: string | null; isVoice: boolean; itemTs: string; deletedBy: string; deletedByName: string
}): Promise<void> {
  const kind = input.isVoice ? 'voice' : (() => {
    const k = mediaKindOf(input.itemName ?? '')
    return k === 'image' ? 'photo' : k === 'video' ? 'video' : 'file'
  })()
  const { error } = await svc.from('chat_deletions' as never).insert({
    job_id: input.jobId, item_kind: kind, item_ts: input.itemTs,
    deleted_by: input.deletedBy, deleted_by_name: input.deletedByName,
  } as never)
  if (error) console.error('[gallery] chat deletion line failed', input.jobId, error)
}
