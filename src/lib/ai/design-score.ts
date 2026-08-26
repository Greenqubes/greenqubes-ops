import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { logApiUsage } from '@/lib/supabase/queries/admin'
import { getObjectBase64 } from '@/lib/storage/r2'

const HAIKU  = 'claude-haiku-4-5-20251001'
// Same model id the assistant chat route's main call uses — see
// src/app/api/assistant/chat/route.ts:323 (`model: 'claude-sonnet-5'`).
const SONNET = 'claude-sonnet-5'

export function pickModel(hasAttachments: boolean): string {
  return hasAttachments ? SONNET : HAIKU
}

// Draft numbers 2026-08-18 — Nic's team will re-rate; keep the format stable.
export const BASELINE_TABLE = `BASELINE complexity guide (1 = <1h prep work, 2 = 1-3h layout,
3 = half-full day real design, 4 = 1-3 day drawing package, 5 = 3+ days / revisions expected):
1 - simple decal/sticker prep; resize or adapt existing artwork
2 - poster/standee/single-panel graphic; window/frosted/floor graphics; acrylic sign from supplied vector
3 - backlit lightbox graphic; multi-panel hoarding wrap; in-store campaign change-out;
    3D acrylic/metal lettering with mockup; simple carpentry drawing; mall landlord submission set
4 - full store campaign package; LED illuminated signage with construction drawings;
    custom mixed-material display fixture
5 - booth / pop-up / exhibition set with full package
Bump one level when: no vector files supplied; landlord/BCA submission required;
photo-real mockups wanted; client known for many revision rounds; site measurement needed.`

export interface PromptInput {
  briefText:       string
  installDate:     string | null
  todayISO:        string
  attachmentNames: string[]
  history:         Array<{ brief: string; complexity: number | null; daysTaken: number }>
}

export type ScoreTrigger = 'brief_change' | 'assign' | 'date_change' | 'nightly'

// Kept ≤200 chars per the brief — a long historical brief shouldn't dominate the prompt.
function excerpt(text: string): string {
  return text.length > 200 ? `${text.slice(0, 200)}…` : text
}

export function buildScorePrompt(input: PromptInput): string {
  const { briefText, installDate, todayISO, attachmentNames, history } = input

  const historyBlock = history.length > 0
    ? history
        .map(h => `- "${excerpt(h.brief)}" — complexity ${h.complexity != null ? h.complexity : 'unrated'}, took ${h.daysTaken.toFixed(1)} day(s)`)
        .join('\n')
    : '(no completed jobs with a recorded brief yet)'

  const attachmentsBlock = attachmentNames.length > 0
    ? attachmentNames.join(', ')
    : '(none)'

  return `Today: ${todayISO}
Install date: ${installDate ?? 'not set'}

BRIEF:
${briefText}

ATTACHMENTS (named here for context; up to 3 readable PDF/image files are attached
separately as content blocks — any remaining files are named here only):
${attachmentsBlock}

${BASELINE_TABLE}

PAST JOBS (brief excerpt, this shop's actual complexity rating, actual days taken):
${historyBlock}

Respond with ONLY a JSON object, no other text, no markdown fences:
{"complexity": 1-5, "proposed_due": "YYYY-MM-DD", "reason": "<one line>", "confidence": "ok"|"low"}

Rules:
- complexity: rate 1-5 using the BASELINE guide above, adjusted by how the past jobs' actual
  complexity and time taken compare to their briefs.
- proposed_due: must leave realistic production lead time before the install date above.
- confidence: "low" when the brief text does not narrow down what a broad/generic attachment
  shows (e.g. a large mixed set of reference photos with no scope described); otherwise "ok".
- reason: one line explaining the complexity rating.`
}

type TrustedHistoryJob = {
  id:                       string
  design_brief:             string | null
  design_completed_at:      string | null
  design_complexity:        number | null
  design_rated_complexity:  number | null
  design_rating_suspect:    boolean
  design_rating_resolution: 'kept' | 'discarded' | null
}

type MediaType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

// The `files` table (migration 0001) has no content-type/size columns, so the
// only signal available for "pdf/image" classification is the stored
// filename's extension. Size is enforced by getObjectBase64's maxBytes arg.
function mediaTypeFromName(name: string): MediaType | null {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':          return 'application/pdf'
    case 'jpg':
    case 'jpeg':         return 'image/jpeg'
    case 'png':          return 'image/png'
    case 'gif':          return 'image/gif'
    case 'webp':         return 'image/webp'
    default:             return null
  }
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
const MAX_READABLE_FILES   = 3

function extractJSON(text: string): unknown {
  const first = text.indexOf('{')
  const last  = text.lastIndexOf('}')
  if (first === -1 || last === -1 || last < first) {
    throw new Error('no JSON object found in model response')
  }
  return JSON.parse(text.slice(first, last + 1))
}

// Fires after a brief/date change, a designer assignment, a brief-file
// upload (rescore), or the nightly sweep (Task 9). Never throws — a failure
// here must never break the caller's own request; the job simply stays
// unscored until the next trigger or the nightly sweep picks it up.
export async function scoreDesignJob(jobId: string, trigger: ScoreTrigger): Promise<void> {
  try {
    const db = createServiceClient()

    type JobRow = {
      design_brief:        string | null
      design_due_manual:   boolean
      design_due_date:     string | null
      date:                string
      design_completed_at: string | null
    }
    const { data: job } = await db
      .from('jobs')
      .select('design_brief, design_due_manual, design_due_date, date, design_completed_at')
      .eq('id', jobId)
      .maybeSingle() as { data: JobRow | null; error: unknown }

    if (!job) return
    if (!job.design_brief || !job.design_brief.trim()) return
    if (job.design_completed_at) return

    const { data: designerRows } = await db
      .from('job_designers')
      .select('user_id')
      .eq('job_id', jobId) as { data: { user_id: string }[] | null; error: unknown }
    if (!designerRows || designerRows.length === 0) return

    // ── Attachments ──────────────────────────────────────────────────────
    type FileRow = { id: string; r2_key: string; name: string | null }
    const { data: fileRows } = await db
      .from('files')
      .select('id, r2_key, name')
      .eq('job_id', jobId)
      .eq('kind', 'design_brief') as { data: FileRow[] | null; error: unknown }
    const files = fileRows ?? []

    const attachmentNames = files.map(f => f.name ?? f.r2_key.split('/').pop() ?? f.r2_key)

    const contentBlocks: Anthropic.ContentBlockParam[] = []
    let readableCount = 0
    for (const f of files) {
      if (readableCount >= MAX_READABLE_FILES) break
      const displayName = f.name ?? f.r2_key.split('/').pop() ?? f.r2_key
      const mediaType    = mediaTypeFromName(displayName)
      if (!mediaType) continue

      const b64 = await getObjectBase64(f.r2_key, MAX_ATTACHMENT_BYTES)
      if (!b64) continue // missing, empty, or over the size cap — name-only via attachmentNames

      if (mediaType === 'application/pdf') {
        contentBlocks.push({ type: 'document', source: { type: 'base64', media_type: mediaType, data: b64 } })
      } else {
        contentBlocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } })
      }
      readableCount++
    }

    // ── History (teaching examples) ─────────────────────────────────────
    const { data: historyJobs } = await db
      .from('jobs')
      .select('id, design_brief, design_completed_at, design_complexity, design_rated_complexity, design_rating_suspect, design_rating_resolution')
      .not('design_completed_at', 'is', null)
      .not('design_brief', 'is', null)
      .order('design_completed_at', { ascending: false })
      .limit(5) as { data: TrustedHistoryJob[] | null; error: unknown }

    const history: PromptInput['history'] = []
    for (const hj of historyJobs ?? []) {
      if (!hj.design_completed_at) continue
      const { data: assigns } = await db
        .from('job_designers')
        .select('assigned_at')
        .eq('job_id', hj.id)
        .order('assigned_at', { ascending: true })
        .limit(1) as { data: { assigned_at: string }[] | null; error: unknown }
      const earliest = assigns?.[0]?.assigned_at
      if (!earliest) continue

      const daysTaken = (new Date(hj.design_completed_at).getTime() - new Date(earliest).getTime()) / 86_400_000
      // Trust check (spec): a quarantined rating never teaches the model.
      const trusted   = hj.design_rating_suspect === false || hj.design_rating_resolution === 'kept'
      const complexity = trusted ? hj.design_rated_complexity : hj.design_complexity

      history.push({ brief: hj.design_brief ?? '', complexity, daysTaken })
    }

    // ── Model call ───────────────────────────────────────────────────────
    const hasAttachments = contentBlocks.length > 0
    const model = pickModel(hasAttachments)
    const prompt = buildScorePrompt({
      briefText:       job.design_brief,
      installDate:     job.date ?? null,
      todayISO:        new Date().toISOString().slice(0, 10),
      attachmentNames,
      history,
    })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model,
      max_tokens: 400,
      messages: [{
        role:    'user',
        content: [...contentBlocks, { type: 'text', text: prompt }],
      }],
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    const tokensIn  = message.usage.input_tokens
    const tokensOut = message.usage.output_tokens
    // Haiku 4.5: ~$0.80/M in, ~$4/M out (see src/app/api/ai/suggest/route.ts).
    // Sonnet: ~$3/M in, ~$15/M out.
    const cost = model === SONNET
      ? (tokensIn / 1_000_000) * 3    + (tokensOut / 1_000_000) * 15
      : (tokensIn / 1_000_000) * 0.80 + (tokensOut / 1_000_000) * 4

    void logApiUsage({
      service:        'anthropic',
      endpoint:       'design-score',
      job_id:         jobId,
      tokens_in:      tokensIn,
      tokens_out:     tokensOut,
      estimated_cost: cost,
    })

    // ── Parse ────────────────────────────────────────────────────────────
    let parsed: { complexity?: unknown; proposed_due?: unknown; reason?: unknown; confidence?: unknown }
    try {
      parsed = extractJSON(text) as typeof parsed
    } catch (err) {
      console.error(`scoreDesignJob(${jobId}): failed to parse model response as JSON`, err, text)
      return
    }

    const complexity = typeof parsed.complexity === 'number'
      ? Math.min(5, Math.max(1, Math.round(parsed.complexity)))
      : null
    if (complexity === null) {
      console.error(`scoreDesignJob(${jobId}): model response missing a valid "complexity" field`, parsed)
      return
    }
    const proposedDue = typeof parsed.proposed_due === 'string' ? parsed.proposed_due : null
    const reason       = typeof parsed.reason === 'string' ? parsed.reason : ''
    const confidence: 'ok' | 'low' = parsed.confidence === 'low' ? 'low' : 'ok'

    // ── Write jobs + design_scores ──────────────────────────────────────
    const jobUpdates: Record<string, unknown> = {
      design_complexity:   complexity,
      design_confidence:   confidence,
      design_score_reason: reason,
      design_scored_at:    new Date().toISOString(),
    }
    // Never overwrite a manually-set due date (spec, Task 6/7).
    if (job.design_due_manual === false && proposedDue) {
      jobUpdates.design_due_date = proposedDue
    }

    await db.from('jobs').update(jobUpdates as never).eq('id', jobId)

    await db.from('design_scores').insert({
      job_id:       jobId,
      trigger_kind: trigger,
      model,
      complexity,
      proposed_due: proposedDue,
      reason,
      confidence,
    } as never)
  } catch (err) {
    console.error(`scoreDesignJob(${jobId}) failed:`, err)
  }
}
