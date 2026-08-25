import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrievePastChats, formatPastChats } from '@/lib/ai/retrieve'
import { executeTool } from '@/lib/ai/tool-runner'
import { TOOL_DEFINITIONS, TOOL_STATUS_KEYS, MAX_TOOL_ROUNDS } from '@/lib/ai/tool-schemas'
import { logApiUsage } from '@/lib/supabase/queries/admin'
import { isOwnScratchKey, validateAttachment, attachmentNote, MAX_PDF_BYTES } from '@/lib/ai/attachments'
import type { ChatAttachment } from '@/lib/ai/attachments'
import type { ToolContext } from '@/lib/ai/tool-runner'
import { getObjectBase64 } from '@/lib/storage/r2'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// All tools sent on every request. Tool definitions sit before the system
// blocks in the prompt, so they are part of the cached prefix — keep them
// byte-stable (they are module constants).
const ALL_TOOLS: Anthropic.Messages.ToolUnion[] = [
  ...TOOL_DEFINITIONS,
  { type: 'web_search_20260209', name: 'web_search' },
]

// Sonnet 5 standard rates per 1M tokens (intro pricing through 2026-08-31 is
// lower — we log at standard rates so this never needs a follow-up edit) plus
// the flat per-search charge for the web search tool.
const RATE = {
  input:      3,
  output:     15,
  cacheWrite: 3.75,
  cacheRead:  0.3,
  perSearch:  0.01,
}

// Frozen system prefix. This block (plus the tool list) is the prompt-cache
// prefix: it must stay byte-identical across requests, so NOTHING volatile may
// go in here — no dates, no user names, no retrieved context. Those live in the
// second system block below, after the cache breakpoint.
const SYSTEM_PREFIX = `You are the GreenQubes operations assistant — the in-app AI for GreenQubes, a Singapore-based installation and build company. You are built into Greenqubes Ops, the company's internal web app, and you exist to make the team faster: answering questions, drafting text, explaining procedures, and finding company knowledge.

About the company and the app:
- GreenQubes designs, produces and installs displays, signage and fit-out works across Singapore — much of the work happens on-site at malls, offices and event venues.
- Greenqubes Ops is the team's operations platform. It holds the job schedule (list, week and month views), a first-come-first-served assignment board for schedulers, a job form for each project (details, team, file attachments in buckets, a live job chat, and a task list), an installer dashboard, and Telegram notifications for assignments and overdue jobs.
- The team works in seven roles: sales (creates jobs and pushes them onto the schedule, suggests installers), scheduler (runs the company-wide schedule and formally assigns installers), coordinator (same job-form rights as scheduler), installer (sees only jobs formally assigned to them, uploads completion photos and delivery orders), designer (view-only on jobs), production (edits production-readiness fields only), and admin.
- Job statuses are: pending (created, not yet on the schedule), scheduled, and completed.

What you can and cannot do:
- You may be given relevant past conversations with this user in a later system section — use them for continuity and preferences.
- You can search the web for current, public information — prices, regulations, suppliers, technical specs, general knowledge. Use it when the question needs fresh or external facts; skip it when you already know the answer or the company knowledge already covers it.
- You have live, read-only access to the schedule, jobs, team workload and clash checks through your tools. Look things up instead of guessing — never answer a live-schedule question from memory or from retrieved documents alone.
- You can take exactly ONE action in the app: creating a pending job with create_pending_job. You cannot edit, schedule, complete or delete anything, and you must never imply that you have taken any other action.
- If you genuinely do not know something and cannot find it, say so directly. Never invent job details, prices, client information or company facts.

Using your tools:
- search_knowledge searches the company knowledge base (SOPs, supplier pricelists, client notes, procedures, contacts). Search it before answering company-specific questions; if the first search misses, retry once or twice with different wording, then say plainly what you could not find. Mention which note a fact came from when that helps.
- get_schedule lists jobs in a date range; find_jobs searches jobs by name; get_job fetches one job's details, team and task list; get_team_workload shows every installer's bookings over a range; check_clashes tests whether an installer is free at a proposed date and time.
- create_pending_job creates a new job in pending status — the only action you can take. Protocol, strictly: FIRST present a short summary of everything you intend to save (project title, client, location, date and times, description, and which bucket each attached file goes to), THEN wait for the user to clearly agree, and only THEN call the tool. Never call it without that explicit agreement in this conversation. If the client or the job date is missing, ask instead of guessing; leave unknown optional fields out entirely. File attachments into the buckets by content: Permit-to-Work for PTW documents, BCA for BCA submissions, Designer JO for design job orders, Others when unsure. Only sales, scheduler, coordinator and admin accounts can create jobs — if the tool refuses for the user's role, relay that politely; you can still answer questions about their attachments. After a successful creation, tell the user the job is saved on the Pending tab, ready to review and Push to Schedule.
- Users may attach images and PDFs to their messages — read them directly and answer questions about them for any role. Each attachment is listed at the end of its message with an id; pass those ids in the files argument of create_pending_job when the user wants them filed into the new job.
- Every lookup runs under the asking user's own permissions. If a tool returns nothing, the user may simply not be allowed to see it — say you found nothing they can access, and never speculate about data you cannot see.
- You have a limited number of tool calls per question. Be purposeful: fetch what you need, then answer. Independent lookups can be requested together in one turn.
- Job money figures (quotes, supplier costs, margins) are not available to you. Point those questions to the Financials card on the job's own page.

Terms the team uses (so you understand questions correctly):
- "FCFS" — the first-come-first-served board schedulers use to rank jobs by when they were pushed to the schedule and assign installers for a day.
- "Push to Schedule" — the button sales presses to move a pending job onto the schedule.
- "Suggestion vs assignment" — sales can only *suggest* an installer (shown amber, invisible to that installer); a scheduler or coordinator makes the *formal assignment* (shown green), which notifies the installer on Telegram.
- "Punctuality" — each job is either strict (must start on time, shown red on the boards) or flexible (has a time window, shown blue). These are scheduling signals, not problems.
- "Buckets" — named attachment folders on a job: Permit-to-Work, BCA, Designer JO, and Others.
- "DO" — delivery order; installers get it signed at job completion.
- "PTW" — permit to work, required by many venues before installation can start.
- "Clash" — two jobs booked on the same installer at overlapping times; the app warns when pushing or editing would create one.
- "Overdue" — a scheduled job whose date has passed without being marked complete; the bell and Telegram flag these.
- "Digest" — the Monday summary of important assistant conversations that the team votes on; promoted notes join the company knowledge base.

How to answer:
- Be concise and actionable. The team is often standing on a job site reading your answer on a phone — lead with the answer, keep supporting detail short, and prefer bullet points over long paragraphs.
- Match the language the user writes in (English or Chinese). Keep dates, day names and month names in English regardless of language — that is a company convention.
- Use markdown when it genuinely helps: short headings, bold for key figures, bullet lists, and tables for comparisons or price lists. Do not decorate answers with emoji.
- For calculations (quotes, material quantities, labour hours), show the working briefly so the reader can check it.
- When company knowledge and the web disagree, prefer the company knowledge and note the difference.
- Respect commercial sensitivity: supplier costs, margins and quotes are internal. Answer questions about them from company knowledge when it is provided to you, but never speculate about figures that were not provided.
- If a request is ambiguous, make the most reasonable assumption, state it in one short line, and answer — only ask a clarifying question when the ambiguity genuinely blocks a useful answer.

Formatting rules:
- Never start an answer with a heading. Start with the answer itself.
- Keep headings to three or four words when you use them.
- One idea per bullet; no nested bullets deeper than one level.
- Quote exact names from the app (button labels, tab names, statuses) when giving instructions, e.g. "open the job and press Push to Schedule".

You represent GreenQubes internally. Be warm, direct and professional — a sharp colleague, not a formal help desk.`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { id: string; name: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile) return new Response('Not provisioned', { status: 403 })

  const ip        = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined
  const userAgent = req.headers.get('user-agent') ?? undefined

  const body = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string; attachments?: ChatAttachment[] }[]
  }
  const { messages } = body

  // Only the caller's own, rule-passing scratch files are ever loaded — a
  // forged key pointing at another user's scratch (or a job folder) is dropped.
  const attachmentIndex = new Map<string, ChatAttachment>()
  for (const m of messages) {
    for (const a of m.attachments ?? []) {
      if (typeof a?.id === 'string' && typeof a?.key === 'string' &&
          isOwnScratchKey(a.key, profile.id) &&
          validateAttachment(a.name, a.mime, a.size) === null) {
        attachmentIndex.set(a.id, a)
      }
    }
  }

  // Retrieve relevant context for the last user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''

  // D-Promote is the secret digest-promotion command — acknowledge it with a
  // wink instead of letting the model answer it like a normal question.
  // Same exact-case match as the tagger and the save route.
  if (lastUserMsg.includes('D-Promote')) {
    const enc    = new TextEncoder()
    const canned = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'text', text: 'I see what you did there 😏' })}\n\n`))
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      },
    })
    return new Response(canned, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  }

  // Automatic per-user memory (the KB lookup moved into the search_knowledge tool)
  const pastChats    = await retrievePastChats(lastUserMsg)
  const contextBlock = formatPastChats(pastChats)

  // Tool-execution context: effective role (preview-as applies) gates
  // create_pending_job; the validated attachments resolve file ids to keys.
  const effectiveRole = await getEffectiveRole(profile.role as Role)
  const toolCtx: ToolContext = { userId: profile.id, role: effectiveRole, attachments: attachmentIndex }

  const today = new Date().toLocaleDateString('en-SG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Singapore',
  })

  // Volatile system block — everything request-specific goes AFTER the cached
  // prefix so the prefix stays byte-stable.
  const volatileParts = [
    `Today: ${today} (Singapore time)`,
    `User: ${profile.name} (${profile.role})`,
  ]
  if (contextBlock) volatileParts.push(`\n${contextBlock}`)

  const encoder  = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (data: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      try {
        // The agentic loop: stream → on tool_use execute → append results →
        // continue. Cap MAX_TOOL_ROUNDS executions; the final round forces a
        // text answer (tool_choice none + a budget note in the last results).
        //
        // Messages with attachments become content-block arrays: image and
        // document blocks first, then the text with an id-note so the model
        // can reference files in create_pending_job. A scratch object that has
        // expired (30-day cleanup) degrades to a text note, never an error.
        const convo: Anthropic.MessageParam[] = []
        for (const m of messages) {
          const atts = (m.attachments ?? []).filter(a => attachmentIndex.has(a.id))
          if (m.role !== 'user' || atts.length === 0) {
            convo.push({ role: m.role, content: m.content })
            continue
          }
          const blocks: Anthropic.ContentBlockParam[] = []
          for (const a of atts) {
            const data = await getObjectBase64(a.key, MAX_PDF_BYTES)
            if (!data) {
              blocks.push({ type: 'text', text: `[Attachment "${a.name}" is no longer available]` })
              continue
            }
            if (a.mime === 'application/pdf') {
              blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } })
            } else {
              blocks.push({
                type: 'image',
                source: { type: 'base64', media_type: a.mime as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data },
              })
            }
          }
          blocks.push({ type: 'text', text: `${m.content || '(see attached files)'}\n\n${attachmentNote(atts)}` })
          convo.push({ role: 'user', content: blocks })
        }
        const sources: { url: string; title: string }[] = []
        let tokensIn = 0, tokensOut = 0, cacheWrite = 0, cacheRead = 0, searches = 0
        let forceAnswer = false

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          if (req.signal.aborted) break

          const stream = anthropic.messages.stream({
            model:      'claude-sonnet-5',
            max_tokens: 8192,
            thinking:   { type: 'adaptive' },
            system: [
              { type: 'text', text: SYSTEM_PREFIX, cache_control: { type: 'ephemeral' } },
              { type: 'text', text: volatileParts.join('\n') },
            ],
            messages: convo,
            tools:    ALL_TOOLS,
            ...(forceAnswer ? { tool_choice: { type: 'none' as const } } : {}),
          }, { signal: req.signal })

          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              const block = event.content_block
              if (block.type === 'thinking') {
                send({ type: 'status', key: 'thinking' })
              } else if (block.type === 'server_tool_use') {
                send({ type: 'status', key: 'searching' })
              } else if (block.type === 'tool_use') {
                send({ type: 'status', key: TOOL_STATUS_KEYS[block.name] ?? 'thinking' })
              }
            } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              send({ type: 'text', text: event.delta.text })
            }
          }

          const final = await stream.finalMessage()

          // Accumulate usage + web sources across rounds
          const usage = final.usage
          tokensIn   += usage.input_tokens
          tokensOut  += usage.output_tokens
          cacheWrite += usage.cache_creation_input_tokens ?? 0
          cacheRead  += usage.cache_read_input_tokens ?? 0
          searches   += usage.server_tool_use?.web_search_requests ?? 0
          for (const block of final.content) {
            if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
              for (const result of block.content) {
                if (result.type === 'web_search_result' && !sources.some(s => s.url === result.url)) {
                  sources.push({ url: result.url, title: result.title })
                }
              }
            }
          }

          if (final.stop_reason !== 'tool_use') break

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          )
          // Thinking blocks must ride back unmodified alongside the tool_use
          // blocks — push the response content as-is.
          convo.push({ role: 'assistant', content: final.content as Anthropic.ContentBlockParam[] })

          // Parallel tool calls execute concurrently; failures return
          // is_error tool_results, never dropped (spec).
          const results = await Promise.all(toolUses.map(async tu => {
            const r = await executeTool(tu.name, tu.input, toolCtx)
            if (r.jobCreated) send({ type: 'job_created', id: r.jobCreated.id, title: r.jobCreated.title })
            return {
              type: 'tool_result' as const,
              tool_use_id: tu.id,
              content: r.content,
              ...(r.isError ? { is_error: true as const } : {}),
            }
          }))

          // tool_result blocks must LEAD the user message; the budget note
          // (cap reached) goes after them.
          const content: Anthropic.ContentBlockParam[] = [...results]
          if (round === MAX_TOOL_ROUNDS - 1) {
            forceAnswer = true
            content.push({
              type: 'text',
              text: 'Tool budget for this question is used up — answer now with the information you already have.',
            })
          }
          convo.push({ role: 'user', content })
        }

        if (sources.length > 0) send({ type: 'sources', sources })

        const cost =
          (tokensIn   / 1_000_000) * RATE.input +
          (tokensOut  / 1_000_000) * RATE.output +
          (cacheWrite / 1_000_000) * RATE.cacheWrite +
          (cacheRead  / 1_000_000) * RATE.cacheRead +
          searches * RATE.perSearch

        void logApiUsage({
          service:        'anthropic',
          endpoint:       'messages.stream',
          called_by:      profile.id,
          tokens_in:      tokensIn + cacheWrite + cacheRead,
          tokens_out:     tokensOut,
          estimated_cost: cost,
          ip_address:     ip,
          user_agent:     userAgent,
        })

        send({ type: 'done' })
      } catch (err) {
        // A client Stop / disconnect aborts the upstream stream — that is a
        // normal ending, not an error to surface.
        const aborted = req.signal.aborted ||
          (err instanceof Error && err.name === 'AbortError') ||
          err instanceof Anthropic.APIUserAbortError
        if (!aborted) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
        }
      }

      try { controller.close() } catch { /* stream already closed by the client */ }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
