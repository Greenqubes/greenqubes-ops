// The bug bot's side of the conversation with Nic (Nic, 2026-11-04: "like
// claude on telegram"). Sonnet reads what he wrote and picks an action; the
// rules in actions.ts decide whether that action is allowed. The model never
// touches GitHub or the database itself — only the tools in chat-request.ts,
// and it must press one before it may say anything.

import Anthropic from '@anthropic-ai/sdk'
import { chatRequest } from './chat-request'
import { goLive, tryAgain, drop, runNow, type ActionDeps } from './actions'
import { startGoLive } from './go-live'
import { fireFixer } from './fire'
import { deleteBranch } from './github'
import { chatHistory, getItemByNo, listItems, updateItem, latestRun, type ItemRow } from './store'
import { progressReply } from './progress'
import { goLiveNamed } from './telegram-auth'

const MAX_ROUNDS = 4

function brief(i: ItemRow) {
  return {
    no: i.no, status: i.status, verdict: i.verdict, severity: i.severity, title: i.title,
    ...(i.preview_url && i.status === 'awaiting_nic' ? { testLink: i.preview_url } : {}),
  }
}

function deps(): ActionDeps {
  return {
    findByNo:     getItemByNo,
    update:       async (id, patch) => { await updateItem(id, patch) },
    startGoLive,
    fireRetryNow: async () => {
      const r = await fireFixer('retry')
      return r.ok ? { ok: true } : { ok: false, reason: r.reason }
    },
    deleteBranch,
    now:          () => new Date().toISOString(),
  }
}

type Ctx = { photos: string[]; nicText: string; lastBotText: string | null }

async function runTool(name: string, input: Record<string, unknown>, ctx: Ctx): Promise<string> {
  const d = deps()
  const { photos } = ctx
  const no = typeof input.no === 'number' ? input.no : Number(input.no)
  // The number must come from Nic, not from anything the model read.
  if (name === 'go_live' && !goLiveNamed(no, ctx.nicText, ctx.lastBotText)) {
    return `Not done: Nic's message didn't name fix ${no}. Ask him to confirm with the number, e.g. "Put fix ${no} live?"`
  }
  switch (name) {
    case 'list_items': {
      const filter = input.filter === 'open' || input.filter === 'recent' ? input.filter : 'awaiting'
      const rows = await listItems(filter)
      return JSON.stringify(rows.slice(0, 20).map(brief))
    }
    case 'show_item': {
      const it = await getItemByNo(no)
      if (!it) return `No item ${no}.`
      return JSON.stringify({ ...brief(it), summary: it.summary, reason: it.reason, attempts: it.attempts, liveAt: it.live_at })
    }
    case 'go_live':   return goLive(no, d)
    case 'try_again': return tryAgain(no, String(input.note ?? ''), photos, input.now === true, d)
    case 'drop':      return drop(no, d)
    case 'run_now':   return runNow(d)
    case 'progress':  return progressReply(await latestRun(), new Date().toISOString())
    case 'no_action': return 'Nothing done — just reply to Nic.'
    default:          return `Unknown tool ${name}.`
  }
}

/** The conversation so far, shaped as alternating user/assistant turns. */
function shape(rows: { role: 'nic' | 'bot'; text: string }[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = []
  for (const m of rows) {
    const role = m.role === 'nic' ? 'user' : 'assistant'
    const last = out.at(-1)
    if (last && last.role === role) last.content = `${last.content}\n${m.text}`
    else out.push({ role, content: m.text })
  }
  while (out[0]?.role === 'assistant') out.shift()
  return out
}

/**
 * Nic's message must already be saved with addChat — it is the last turn of
 * the history read here. Returns the reply to send him (plain text).
 */
export async function replyToNic(photos: string[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "I can't reply properly right now — the AI key isn't set up."
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const rows = await chatHistory(20)
  const messages = shape(rows)
  if (messages.length === 0) return 'Hi — ask me "what\'s waiting" to see fixes ready to try.'
  // Nic's latest message, and the bot's message just before it — what
  // goLiveNamed checks a go-live against.
  const lastNic = rows.map(r => r.role).lastIndexOf('nic')
  const ctx: Ctx = {
    photos,
    nicText:     lastNic >= 0 ? rows[lastNic].text : '',
    lastBotText: rows.slice(0, Math.max(lastNic, 0)).reverse().find(r => r.role === 'bot')?.text ?? null,
  }
  if (photos.length) {
    const last = messages.at(-1)!
    last.content = `${last.content}\n(Nic also sent ${photos.length} photo${photos.length > 1 ? 's' : ''}; it goes with any try_again note.)`
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await anthropic.messages.create(chatRequest(round, messages))
    if (res.stop_reason !== 'tool_use') {
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
      return text || 'Done.'
    }
    messages.push({ role: 'assistant', content: res.content })
    const results: Anthropic.ToolResultBlockParam[] = []
    for (const block of res.content) {
      if (block.type !== 'tool_use') continue
      const out = await runTool(block.name, block.input as Record<string, unknown>, ctx)
      results.push({ type: 'tool_result', tool_use_id: block.id, content: out })
    }
    messages.push({ role: 'user', content: results })
  }
  return "I've done what I could — ask me \"what's waiting\" to see where things stand."
}
