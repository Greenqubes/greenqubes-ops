import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getDesignLoad } from '@/lib/supabase/queries/design-load'
import { computeUrgency, daysBetween } from '@/lib/utils/design-urgency'
import { impliedComplexityFromDays } from '@/lib/utils/design-rating-trust'

// Admin gate — identical to src/app/api/admin/health/route.ts.
async function guardAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { role: string } | null; error: unknown }
  return profile?.role === 'admin'
}

// Design due dates are SG-business dates — same SGT-today convention used by
// design-score.ts's sgtTodayISO() and DesignLoadShell's todaySGT(). Duplicated
// locally rather than imported: no shared lib module for it exists yet.
function sgtTodayISO(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
}

export type ScoreRow = {
  id:          string
  jobId:       string
  jobTitle:    string
  createdAt:   string
  trigger:     string
  model:       string
  complexity:  number
  proposedDue: string | null
  reason:      string
  confidence:  'ok' | 'low'
}

export type Summary = {
  urgencyCounts:  Record<1 | 2 | 3 | 4 | 5, number>
  loadPerDesigner: Array<{ name: string; count: number }>
  accuracy:        Array<{ jobTitle: string; estimatedDays: number; actualDays: number }>
  ratingAccuracy:  Array<{ jobTitle: string; aiComplexity: number | null; ratedComplexity: number }>
  perDesigner:     Array<{ name: string; avgDeviation: number; flaggedRecent: string }>
  flagged:         Array<{ jobId: string; jobTitle: string; designerName: string; rating: number; aiComplexity: number | null; daysTaken: number }>
  activity:        { last30dCalls: number; haiku: number; sonnet: number }
}

type ScoreDbRow = {
  id: string; job_id: string; trigger_kind: string; model: string
  complexity: number; proposed_due: string | null; reason: string
  confidence: 'ok' | 'low'; created_at: string
}

// A "completed design job" — the pool every summary card (except urgency/load,
// which come from getDesignLoad's OPEN jobs) draws from.
type CompletedJobRow = {
  id:                        string
  project_title:             string | null
  design_completed_at:       string | null
  design_completed_by:       string | null
  design_complexity:         number | null
  design_rated_complexity:   number | null
  design_rating_suspect:     boolean
  design_rating_resolution:  'kept' | 'discarded' | null
}

// Same semantics as the design-complete route: fractional days from the
// EARLIEST job_designers.assigned_at across the whole design team on that
// job, to design_completed_at.
function daysTakenFor(job: CompletedJobRow, assignedAtByJob: Map<string, string>): number {
  const assignedAt = assignedAtByJob.get(job.id)
  if (!assignedAt || !job.design_completed_at) return 0
  return (new Date(job.design_completed_at).getTime() - new Date(assignedAt).getTime()) / 86_400_000
}

export async function GET(_req: NextRequest) {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Whole body wrapped: this is a diagnostic tool, so ANY read failure
  // (including getDesignLoad()'s own throw-on-error) must come back as this
  // route's own 500 JSON shape, never a silent empty-array fallback and
  // never a framework-level 500 — an admin reading "0 flagged jobs" needs to
  // be able to trust that it means zero, not "the query blew up".
  try {
    const db = createServiceClient()

    // ── Latest 200 scores (feed) ────────────────────────────────────────────
    const { data: scoreRows, error: scoresErr } = await db
      .from('design_scores')
      .select('id, job_id, trigger_kind, model, complexity, proposed_due, reason, confidence, created_at')
      .order('created_at', { ascending: false })
      .limit(200) as { data: ScoreDbRow[] | null; error: unknown }
    if (scoresErr) throw scoresErr
    const scores = scoreRows ?? []

    // ── Completed design jobs (accuracy / ratingAccuracy / perDesigner / flagged) ──
    const { data: completedRows, error: completedErr } = await db
      .from('jobs')
      .select('id, project_title, design_completed_at, design_completed_by, design_complexity, design_rated_complexity, design_rating_suspect, design_rating_resolution')
      .not('design_completed_at', 'is', null) as { data: CompletedJobRow[] | null; error: unknown }
    if (completedErr) throw completedErr
    const completedJobs = completedRows ?? []

    // ── Job titles — union of score job ids + completed job ids. Completed
    // rows already carry their own title, so only fetch the remainder. ────────
    const titleMap = new Map<string, string>()
    for (const j of completedJobs) titleMap.set(j.id, j.project_title ?? '')
    const missingTitleIds = [...new Set(scores.map(s => s.job_id))].filter(id => !titleMap.has(id))
    if (missingTitleIds.length > 0) {
      const { data: titleRows, error: titleErr } = await db
        .from('jobs')
        .select('id, project_title')
        .in('id', missingTitleIds) as { data: Array<{ id: string; project_title: string | null }> | null; error: unknown }
      if (titleErr) throw titleErr
      for (const t of titleRows ?? []) titleMap.set(t.id, t.project_title ?? '')
    }

    // ── Earliest job_designers.assigned_at per completed job ────────────────
    const completedJobIds = completedJobs.map(j => j.id)
    const assignedAtByJob = new Map<string, string>()
    if (completedJobIds.length > 0) {
      const { data: assignRows, error: assignErr } = await db
        .from('job_designers')
        .select('job_id, assigned_at')
        .in('job_id', completedJobIds) as { data: Array<{ job_id: string; assigned_at: string }> | null; error: unknown }
      if (assignErr) throw assignErr
      for (const r of assignRows ?? []) {
        const cur = assignedAtByJob.get(r.job_id)
        if (!cur || r.assigned_at < cur) assignedAtByJob.set(r.job_id, r.assigned_at)
      }
    }

    // ── Designer names for design_completed_by — one users lookup (NEVER
    // embed users on jobs). ─────────────────────────────────────────────────
    const completedByIds = [...new Set(
      completedJobs.map(j => j.design_completed_by).filter((id): id is string => !!id),
    )]
    const nameById = new Map<string, string>()
    if (completedByIds.length > 0) {
      const { data: userRows, error: userErr } = await db
        .from('users')
        .select('id, name')
        .in('id', completedByIds) as { data: Array<{ id: string; name: string }> | null; error: unknown }
      if (userErr) throw userErr
      for (const u of userRows ?? []) nameById.set(u.id, u.name)
    }

    // ── Turnaround accuracy: estimated = assigned → the job's LAST
    // proposed_due-bearing score; actual = assigned → design_completed_at. ──
    const jobsWithAssign = completedJobs.filter(j => assignedAtByJob.has(j.id))
    const accuracy: Summary['accuracy'] = []
    if (jobsWithAssign.length > 0) {
      const ids = jobsWithAssign.map(j => j.id)
      const { data: dueScores, error: dueErr } = await db
        .from('design_scores')
        .select('job_id, proposed_due, created_at')
        .in('job_id', ids)
        .not('proposed_due', 'is', null)
        .order('created_at', { ascending: false }) as { data: Array<{ job_id: string; proposed_due: string | null; created_at: string }> | null; error: unknown }
      if (dueErr) throw dueErr
      const lastDueByJob = new Map<string, string>()
      for (const row of dueScores ?? []) {
        if (!lastDueByJob.has(row.job_id) && row.proposed_due) lastDueByJob.set(row.job_id, row.proposed_due)
      }
      for (const job of jobsWithAssign) {
        const proposedDue = lastDueByJob.get(job.id)
        if (!proposedDue) continue
        const assignedAt = assignedAtByJob.get(job.id)!
        accuracy.push({
          jobTitle:      titleMap.get(job.id) ?? '',
          estimatedDays: daysBetween(assignedAt, proposedDue),
          actualDays:    daysBetween(assignedAt, job.design_completed_at!),
        })
      }
    }

    // ── Rating accuracy: BOTH design_complexity and a TRUSTED rating present.
    // Trust rule mirrors design-score.ts's history-teaching check exactly. ──
    const ratingAccuracy: Summary['ratingAccuracy'] = completedJobs
      .filter(j =>
        j.design_complexity !== null && j.design_rated_complexity !== null &&
        (j.design_rating_suspect === false || j.design_rating_resolution === 'kept'),
      )
      .map(j => ({
        jobTitle:        titleMap.get(j.id) ?? '',
        aiComplexity:    j.design_complexity,
        ratedComplexity: j.design_rated_complexity!,
      }))

    // ── Per completing-designer deviation over their last 10 rated jobs ─────
    const ratedByDesigner = new Map<string, CompletedJobRow[]>()
    for (const j of completedJobs) {
      if (j.design_rated_complexity === null || !j.design_completed_by) continue
      const list = ratedByDesigner.get(j.design_completed_by) ?? []
      list.push(j)
      ratedByDesigner.set(j.design_completed_by, list)
    }
    const perDesigner: Summary['perDesigner'] = []
    for (const [designerId, jobs] of ratedByDesigner) {
      const last10 = [...jobs]
        .sort((a, b) => (b.design_completed_at ?? '').localeCompare(a.design_completed_at ?? ''))
        .slice(0, 10)
      const deviations = last10.map(j => {
        const implied = j.design_complexity ?? impliedComplexityFromDays(daysTakenFor(j, assignedAtByJob))
        return Math.abs(j.design_rated_complexity! - implied)
      })
      const avgDeviation = deviations.length > 0
        ? Math.round((deviations.reduce((a, b) => a + b, 0) / deviations.length) * 10) / 10
        : 0
      const flaggedCount = last10.filter(j => j.design_rating_suspect).length
      perDesigner.push({
        name:          nameById.get(designerId) ?? '',
        avgDeviation,
        flaggedRecent: `${flaggedCount} of last ${last10.length}`,
      })
    }

    // ── Flagged strip: suspect + unresolved ──────────────────────────────────
    const flagged: Summary['flagged'] = completedJobs
      .filter(j => j.design_rating_suspect === true && j.design_rating_resolution === null)
      .map(j => ({
        jobId:        j.id,
        jobTitle:     titleMap.get(j.id) ?? '',
        designerName: j.design_completed_by ? (nameById.get(j.design_completed_by) ?? '') : '',
        rating:       j.design_rated_complexity ?? 0,
        aiComplexity: j.design_complexity,
        daysTaken:    Math.round(daysTakenFor(j, assignedAtByJob) * 10) / 10,
      }))

    // ── Activity: design_scores in the last 30 days, grouped by model ───────
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const { data: recentScoreRows, error: recentErr } = await db
      .from('design_scores')
      .select('model')
      .gte('created_at', since) as { data: Array<{ model: string }> | null; error: unknown }
    if (recentErr) throw recentErr
    const recentScores = recentScoreRows ?? []
    const activity: Summary['activity'] = {
      last30dCalls: recentScores.length,
      haiku:        recentScores.filter(r => r.model.toLowerCase().includes('haiku')).length,
      sonnet:       recentScores.filter(r => r.model.toLowerCase().includes('sonnet')).length,
    }

    // ── Urgency counts + load-per-designer — reuse getDesignLoad() over OPEN
    // jobs, same inputs the board itself uses (DesignLoadShell.tsx).
    // getDesignLoad() already throws on its own query error — caught below. ─
    const loadData     = await getDesignLoad()
    const todayISO      = sgtTodayISO()
    const maxOpenCount  = Math.max(0, ...loadData.designers.map(d => d.jobs.length))
    const urgencyCounts: Summary['urgencyCounts'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    const loadPerDesigner: Summary['loadPerDesigner'] = []
    for (const designer of loadData.designers) {
      loadPerDesigner.push({ name: designer.name, count: designer.jobs.length })
      const openCount = designer.jobs.length
      for (const job of designer.jobs) {
        const daysToDue = job.dueDate ? daysBetween(todayISO, job.dueDate) : null
        const level = computeUrgency({ complexity: job.complexity, daysToDue, openCount, maxOpenCount })
        if (level !== 0) urgencyCounts[level]++
      }
    }

    const scoreRowsOut: ScoreRow[] = scores.map(s => ({
      id:          s.id,
      jobId:       s.job_id,
      jobTitle:    titleMap.get(s.job_id) ?? '',
      createdAt:   s.created_at,
      trigger:     s.trigger_kind,
      model:       s.model,
      complexity:  s.complexity,
      proposedDue: s.proposed_due,
      reason:      s.reason,
      confidence:  s.confidence,
    }))

    const summary: Summary = {
      urgencyCounts, loadPerDesigner, accuracy, ratingAccuracy, perDesigner, flagged, activity,
    }

    return NextResponse.json({ scores: scoreRowsOut, summary })
  } catch (err) {
    console.error('[design-scores GET] failed', err)
    return NextResponse.json({ error: 'Failed to load AI scores' }, { status: 500 })
  }
}

// Keep/Discard on a flagged rating — sets design_rating_resolution. Keep
// admits the rating to learning (design-score.ts's trust check), Discard
// drops it; untouched rows stay excluded from learning either way.
export async function PATCH(req: NextRequest) {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({})) as { jobId?: unknown; resolution?: unknown }
  const { jobId, resolution } = body
  if (typeof jobId !== 'string' || (resolution !== 'kept' && resolution !== 'discarded')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const db = createServiceClient()
  const { error } = await db
    .from('jobs')
    .update({ design_rating_resolution: resolution } as never)
    .eq('id', jobId)
  if (error) {
    console.error('[design-scores PATCH] update failed', jobId, error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
