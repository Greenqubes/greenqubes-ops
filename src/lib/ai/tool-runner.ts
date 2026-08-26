import { searchKnowledge } from './retrieve'
import { isIsoDate, validateRange, JOB_BUCKETS, type JobBucket } from './tool-schemas'
import {
  getScheduleRange, findJobs, getJobSnapshot, getTeamWorkload, checkInstallerClashes,
} from '@/lib/supabase/queries/assistant-tools'
import { createPendingJobFromChat } from '@/lib/supabase/queries/assistant-create-job'
import type { ChatAttachment } from './attachments'
import type { Role } from '@/lib/supabase/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Mirrors the app's job-creation rights (Duplicate route pattern). The
// effective role is what preview-as shows, so a previewing admin is gated
// like the previewed role; RLS on the user-scoped insert is the backstop.
const CREATE_JOB_ROLES = new Set<Role>(['sales', 'scheduler', 'coordinator', 'admin'])

/** Per-request context for tool execution: who is asking (effective role) and
 *  the validated attachments of the current conversation, keyed by id. */
export interface ToolContext {
  userId:      string
  role:        Role
  attachments: ReadonlyMap<string, ChatAttachment>
}

export interface ToolOutcome {
  content: string
  isError: boolean
  jobCreated?: { id: string; title: string | null }
}

const ok  = (data: unknown): ToolOutcome => ({ content: JSON.stringify(data), isError: false })
const bad = (msg: string):   ToolOutcome => ({ content: msg, isError: true })

/** Execute one client-tool call. Never throws — failures come back as
 *  is_error tool_results so the model can recover (spec). */
export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const args = (input ?? {}) as Record<string, unknown>
  try {
    switch (name) {
      case 'search_knowledge': {
        const query = typeof args.query === 'string' ? args.query.trim() : ''
        if (!query) return bad('query is required')
        const hits = await searchKnowledge(query)
        if (hits.length === 0) return ok({ results: [], note: 'No knowledge-base match — try different wording, or say you could not find it.' })
        return ok({ results: hits.map(h => ({ source: h.source_path, content: h.content })) })
      }
      case 'get_schedule': {
        if (!isIsoDate(args.start_date) || !isIsoDate(args.end_date)) return bad('start_date and end_date must be YYYY-MM-DD')
        const rangeErr = validateRange(args.start_date, args.end_date)
        if (rangeErr) return bad(rangeErr)
        const status = args.status
        if (status !== undefined && status !== 'scheduled' && status !== 'pending' && status !== 'completed') {
          return bad('status must be scheduled, pending or completed')
        }
        return ok(await getScheduleRange(args.start_date, args.end_date, status))
      }
      case 'find_jobs': {
        const query = typeof args.query === 'string' ? args.query.trim() : ''
        if (!query) return bad('query is required')
        return ok({ jobs: await findJobs(query) })
      }
      case 'get_job': {
        if (typeof args.job_id !== 'string' || !UUID_RE.test(args.job_id)) return bad('job_id must be a job uuid from get_schedule or find_jobs')
        const job = await getJobSnapshot(args.job_id)
        if (!job) return ok({ found: false, note: 'No such job, or the asking user is not allowed to see it.' })
        return ok({ found: true, job })
      }
      case 'get_team_workload': {
        if (!isIsoDate(args.start_date) || !isIsoDate(args.end_date)) return bad('start_date and end_date must be YYYY-MM-DD')
        const rangeErr = validateRange(args.start_date, args.end_date)
        if (rangeErr) return bad(rangeErr)
        return ok({ installers: await getTeamWorkload(args.start_date, args.end_date) })
      }
      case 'check_clashes': {
        const nameArg = typeof args.installer_name === 'string' ? args.installer_name : ''
        if (!nameArg.trim()) return bad('installer_name is required')
        if (!isIsoDate(args.date)) return bad('date must be YYYY-MM-DD')
        const ts = typeof args.time_start === 'string' && HHMM_RE.test(args.time_start) ? args.time_start : null
        const te = typeof args.time_end   === 'string' && HHMM_RE.test(args.time_end)   ? args.time_end   : null
        return ok(await checkInstallerClashes(nameArg, args.date, ts, te))
      }
      case 'create_pending_job': {
        // Not an error: an ok() refusal stops the model retrying and lets it
        // relay the message politely.
        if (!CREATE_JOB_ROLES.has(ctx.role)) {
          return ok({
            created: false,
            refusal: 'Only sales, scheduler, coordinator and admin accounts can create jobs. Tell the user their role cannot create jobs — you can still answer questions about the attachments.',
          })
        }
        const client = typeof args.client === 'string' ? args.client.trim() : ''
        if (!client) return bad('client is required')
        if (!isIsoDate(args.date)) return bad('date must be YYYY-MM-DD')
        const dateEnd = args.date_end === undefined || args.date_end === null
          ? null : (isIsoDate(args.date_end) ? args.date_end : undefined)
        if (dateEnd === undefined) return bad('date_end must be YYYY-MM-DD')
        if (dateEnd && dateEnd < args.date) return bad('date_end is before date')
        const timeOf = (v: unknown) => v === undefined || v === null
          ? null : (typeof v === 'string' && HHMM_RE.test(v) ? v : undefined)
        const ts = timeOf(args.time_start)
        const te = timeOf(args.time_end)
        if (ts === undefined || te === undefined) return bad('times must be HH:MM (24h)')
        const str = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null

        const unknownIds: string[] = []
        const files: { key: string; name: string; bucket: JobBucket }[] = []
        for (const raw of Array.isArray(args.files) ? args.files as Array<Record<string, unknown>> : []) {
          const id = typeof raw.id === 'string' ? raw.id : ''
          const bucket = typeof raw.bucket === 'string' && (JOB_BUCKETS as readonly string[]).includes(raw.bucket)
            ? raw.bucket as JobBucket : 'OTHERS'
          const att = ctx.attachments.get(id)
          if (!att) { unknownIds.push(id || '(missing id)'); continue }
          files.push({ key: att.key, name: att.name, bucket })
        }

        const title  = str(args.project_title)
        const result = await createPendingJobFromChat({
          project_title: title,
          client,
          location:      str(args.location),
          date:          args.date,
          date_end:      dateEnd,
          time_start:    ts,
          time_end:      te,
          description:   str(args.description),
          notes:         str(args.notes),
          production_instructions: str(args.production_instructions),
          files,
        }, ctx.userId)
        if (!result) return bad('The job could not be saved — the save was rejected.')

        return {
          ...ok({
            created:       true,
            job_id:        result.jobId,
            project_title: title,
            files_filed:   result.filed,
            files_skipped: result.skipped + unknownIds.length,
            ...(unknownIds.length ? { unknown_file_ids: unknownIds } : {}),
            note: 'Saved as a pending job. Tell the user it is on the Pending tab, ready to review and Push to Schedule.',
          }),
          jobCreated: { id: result.jobId, title },
        }
      }
      default:
        return bad(`Unknown tool: ${name}`)
    }
  } catch (err) {
    return bad(`Tool failed: ${err instanceof Error ? err.message : 'unknown error'}`)
  }
}
