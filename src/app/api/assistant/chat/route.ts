import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrieveContext, formatContext } from '@/lib/ai/retrieve'
import { logApiUsage } from '@/lib/supabase/queries/admin'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
- You may be given retrieved company knowledge and relevant past conversations in a later system section. Treat that material as your primary source when it answers the question, and mention which note or document the answer came from when that helps.
- You can search the web for current, public information — prices, regulations, suppliers, technical specs, general knowledge. Use it when the question needs fresh or external facts; skip it when you already know the answer or the company knowledge already covers it.
- You do NOT have live access to the schedule, jobs, or team database. If someone asks about today's jobs, a specific job's status, who is assigned where, or team availability, say plainly that you cannot see the live schedule yet and point them to the right place in the app (the Schedule tab, the FCFS board, or the job's own page).
- You cannot create, edit or delete anything in the app. Never imply that you have taken an action.
- If you genuinely do not know something and cannot find it, say so directly. Never invent job details, prices, client information or company facts.

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
    messages: { role: 'user' | 'assistant'; content: string }[]
  }
  const { messages } = body

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

  const ctx          = await retrieveContext(lastUserMsg)
  const contextBlock = formatContext(ctx)

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
        const stream = anthropic.messages.stream({
          model:      'claude-sonnet-5',
          max_tokens: 8192,
          thinking:   { type: 'adaptive' },
          system: [
            { type: 'text', text: SYSTEM_PREFIX, cache_control: { type: 'ephemeral' } },
            { type: 'text', text: volatileParts.join('\n') },
          ],
          messages,
          tools: [{ type: 'web_search_20260209', name: 'web_search' }],
        }, { signal: req.signal })

        for await (const event of stream) {
          if (event.type === 'content_block_start') {
            const block = event.content_block
            if (block.type === 'thinking') {
              send({ type: 'status', key: 'thinking' })
            } else if (block.type === 'server_tool_use') {
              send({ type: 'status', key: 'searching' })
            }
          } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            send({ type: 'text', text: event.delta.text })
          }
        }

        const final = await stream.finalMessage()

        // Surface web search citations as link chips under the answer
        const sources: { url: string; title: string }[] = []
        for (const block of final.content) {
          if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
            for (const result of block.content) {
              if (result.type === 'web_search_result' && !sources.some(s => s.url === result.url)) {
                sources.push({ url: result.url, title: result.title })
              }
            }
          }
        }
        if (sources.length > 0) send({ type: 'sources', sources })

        const usage      = final.usage
        const cacheWrite = usage.cache_creation_input_tokens ?? 0
        const cacheRead  = usage.cache_read_input_tokens ?? 0
        const searches   = usage.server_tool_use?.web_search_requests ?? 0
        const cost =
          (usage.input_tokens  / 1_000_000) * RATE.input +
          (usage.output_tokens / 1_000_000) * RATE.output +
          (cacheWrite          / 1_000_000) * RATE.cacheWrite +
          (cacheRead           / 1_000_000) * RATE.cacheRead +
          searches * RATE.perSearch

        void logApiUsage({
          service:         'anthropic',
          endpoint:        'messages.stream',
          called_by:       profile.id,
          tokens_in:       usage.input_tokens + cacheWrite + cacheRead,
          tokens_out:      usage.output_tokens,
          estimated_cost:  cost,
          ip_address:      ip,
          user_agent:      userAgent,
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
