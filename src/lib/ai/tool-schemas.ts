import type Anthropic from '@anthropic-ai/sdk'

// Pure module — no Supabase/Next imports, so the standalone test can run it
// under plain tsx. The executors that hit the DB live in tool-runner.ts.

/** Tool-execution rounds per question (spec). On the last round the model is
 *  told to answer with what it has and tool_choice is forced to none. */
export const MAX_TOOL_ROUNDS = 8

/** Tool name → SSE status key. The client maps keys to i18n labels and falls
 *  back to "Thinking…" for unknown keys, so adding tools later is safe. */
export const TOOL_STATUS_KEYS: Record<string, string> = {
  web_search:        'searching',
  search_knowledge:  'kb',
  get_schedule:      'schedule',
  find_jobs:         'jobs',
  get_job:           'job',
  get_team_workload: 'workload',
  check_clashes:     'clashes',
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function validateRange(start: string, end: string): string | null {
  if (end < start) return 'end_date is before start_date'
  const days = (Date.parse(end + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86_400_000
  if (days > 62) return 'date range is longer than 62 days — narrow it'
  return null
}

export const TOOL_DEFINITIONS: Anthropic.Messages.Tool[] = [
  {
    name: 'search_knowledge',
    description: 'Search the company knowledge base (SOPs, supplier pricelists, client notes, procedures, contacts). Results are filtered to what the asking user may see. If a search misses, retry once or twice with different wording before giving up.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What to look for, in plain words' } },
      required: ['query'],
    },
  },
  {
    name: 'get_schedule',
    description: 'List jobs between two dates (inclusive), newest-first within a day. Shows only what the asking user is allowed to see — an installer sees only jobs formally assigned to them. Max range 62 days.',
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        end_date:   { type: 'string', description: 'YYYY-MM-DD' },
        status:     { type: 'string', enum: ['scheduled', 'pending', 'completed'], description: 'Optional status filter; omit for all' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'find_jobs',
    description: 'Search jobs by free text against project title, client company and location. Returns up to 10 matches, newest first. Use get_job with a returned id for full details.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Title, client or location text' } },
      required: ['query'],
    },
  },
  {
    name: 'get_job',
    description: "One job's full details: status, dates/times, client, location, description, notes, production fields, team (installers, suggestions marked, sub-installers marked) and task list. Money figures are never included.",
    input_schema: {
      type: 'object',
      properties: { job_id: { type: 'string', description: 'Job id (uuid) from get_schedule or find_jobs' } },
      required: ['job_id'],
    },
  },
  {
    name: 'get_team_workload',
    description: "Every installer's bookings between two dates (inclusive) — who is on which job when, and who has nothing on. Use for questions like 'who is free on Friday?'. Max range 62 days.",
    input_schema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'YYYY-MM-DD' },
        end_date:   { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'check_clashes',
    description: 'Check whether an installer already has bookings overlapping a proposed date and time window. Give the installer by name. Omit times to check the whole day. A job with no start time is a whole-day booking and overlaps everything that day.',
    input_schema: {
      type: 'object',
      properties: {
        installer_name: { type: 'string', description: "Installer's name (or part of it)" },
        date:           { type: 'string', description: 'YYYY-MM-DD' },
        time_start:     { type: 'string', description: 'HH:MM 24h, optional' },
        time_end:       { type: 'string', description: 'HH:MM 24h, optional' },
      },
      required: ['installer_name', 'date'],
    },
  },
]
