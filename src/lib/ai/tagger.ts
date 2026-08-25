import Anthropic from '@anthropic-ai/sdk'
import type { Role } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ChatTag {
  topic:      string
  entities:   string[]
  tags:       string[]
  importance: number
  visibility: string[]
  /** 2–3 sentence recall summary. Empty when nothing reusable. */
  summary:    string
  /** Only meaningful chats enter memory (Nic 2026-08-24) — gates summary + embedding. */
  meaningful: boolean
}

/** Pure parsing of the classifier's response — exported for the standalone test. */
export function parseChatTag(text: string, forcePromote: boolean): ChatTag {
  try {
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>
    return {
      topic:      typeof json.topic === 'string'      ? json.topic : 'General',
      entities:   Array.isArray(json.entities)        ? (json.entities as string[]) : [],
      tags:       Array.isArray(json.tags)            ? (json.tags as string[])     : [],
      importance: forcePromote ? 5 : (typeof json.importance === 'number' ? Math.max(1, Math.min(5, json.importance)) : 2),
      visibility: Array.isArray(json.visibility)      ? (json.visibility as string[]) : ['public-internal'],
      summary:    typeof json.summary === 'string'    ? json.summary : '',
      meaningful: json.meaningful === true,
    }
  } catch {
    return { topic: 'General', entities: [], tags: [], importance: forcePromote ? 5 : 2, visibility: ['public-internal'], summary: '', meaningful: false }
  }
}

export async function tagConversation(
  msgs: { role: string; content: string }[],
  _userRole: Role,
): Promise<ChatTag> {
  const transcript = msgs
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')
    .slice(0, 4000)

  const forcePromote = msgs.some(m => m.content.includes('D-Promote'))

  let text = '{}'
  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You classify internal business conversations for a Singapore install company.
Return ONLY valid JSON with these exact fields:
- topic: string (max 8 words, e.g. "roof waterproofing job for Jurong")
- entities: string[] (names, job IDs, client names, locations mentioned)
- tags: string[] (2–5 keyword tags)
- importance: number 1–5 (5 = critical business knowledge like supplier prices or client escalations, 1 = trivial chitchat)
- visibility: string[] — choose from: ["public-internal","role:sales","role:scheduler","role:installer"]
  Rules:
  - "public-internal" → install techniques, SOPs, how-to, general logistics
  - "role:sales" or "role:scheduler" → client costs, quotes, margins, financial info
  - "role:installer" → field-crew-only information
  - Default to ["public-internal"] unless clearly sensitive
- summary: string — 2 to 3 plain sentences capturing what would matter if this topic comes up again (decisions made, standing facts, prices quoted, preferences stated, ongoing matters). Empty string "" if nothing is worth remembering.
- meaningful: boolean — true ONLY if the conversation contains something reusable in a future conversation (preferences, standing facts, decisions, ongoing work). Throwaway lookups, greetings, tests and chitchat are false.`,
      messages: [{ role: 'user', content: `Classify this conversation:\n\n${transcript}` }],
    })
    text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  } catch {
    // classification is best-effort; fall back to safe defaults
  }

  return parseChatTag(text, forcePromote)
}
