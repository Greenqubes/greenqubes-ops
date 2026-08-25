import { searchKnowledge } from './retrieve'
import { isIsoDate, validateRange } from './tool-schemas'
import {
  getScheduleRange, findJobs, getJobSnapshot, getTeamWorkload, checkInstallerClashes,
} from '@/lib/supabase/queries/assistant-tools'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export interface ToolOutcome { content: string; isError: boolean }

const ok  = (data: unknown): ToolOutcome => ({ content: JSON.stringify(data), isError: false })
const bad = (msg: string):   ToolOutcome => ({ content: msg, isError: true })

/** Execute one client-tool call. Never throws — failures come back as
 *  is_error tool_results so the model can recover (spec). */
export async function executeTool(name: string, input: unknown): Promise<ToolOutcome> {
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
      default:
        return bad(`Unknown tool: ${name}`)
    }
  } catch (err) {
    return bad(`Tool failed: ${err instanceof Error ? err.message : 'unknown error'}`)
  }
}
