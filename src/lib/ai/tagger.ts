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
      // Classification, not writing: temperature 0 so the same conversation scores the same way
      // every time. At the default the importance drifted a point between runs (2026-09-09).
      temperature: 0,
      system: `You classify internal business conversations for a Singapore install company.
Return ONLY valid JSON with these exact fields:
- topic: string (max 8 words, e.g. "roof waterproofing job for Jurong")
- entities: string[] (names, job IDs, client names, locations mentioned)
- tags: string[] (2–5 keyword tags)
- importance: number 1–5 — how much the WHOLE COMPANY would lose if this conversation vanished.
  Score the DIRECTION of the information, not the topic. Ask: did something NEW arrive here that
  exists nowhere else in the company?
  5 — New company knowledge a person stated that is written down nowhere else: what we charge or
      pay, supplier terms or lead times, a decision made, a standing client preference, a lesson
      learned ("never do it that way again").
  4 — A lasting fact picked up in passing: a venue's permit quirk, a delivery restriction, how a
      material behaves. Still true in a year.
  3 — Real work a person brought in, but it expires: a change to a specific job, a one-off
      calculation, an arrangement made for one date.
  2 — A lookup the assistant answered from what the company already knows: schedule and job
      queries, clash checks, team workload, or anything read back out of the knowledge base.
  1 — Greetings, tests, app orientation, chitchat.
  HARD RULE: if the answer came from the knowledge base or from job/schedule data, the score is
  never above 2 — repeating what we already hold adds nothing. A question is a withdrawal; only a
  person stating something new is a deposit.
- visibility: string[] — who may ever read this if it becomes a company note. Choose from:
  ["public-internal","role:sales","role:scheduler","role:coordinator","role:designer","role:production","role:installer","role:hr"]
  Rules:
  - "public-internal" → install techniques, SOPs, how-to, general logistics
  - "role:sales" or "role:scheduler" → client costs, quotes, margins, supplier pricing
  - "role:installer" → field-crew-only information
  - "role:designer", "role:production", "role:coordinator" → craft or workshop detail for that trade
  - "role:hr" ALONE → anything about a NAMED person's leave, medical situation, pay, discipline or
    performance. Set meaningful:false on these regardless of content. A general policy that names
    nobody is scored normally.
  - Default to ["public-internal"] unless clearly sensitive
- summary: string — 2 to 3 plain sentences capturing what would matter if this topic comes up again (decisions made, standing facts, prices quoted, preferences stated, ongoing matters). Empty string "" if nothing is worth remembering.
- meaningful: boolean — whether THIS PERSON would benefit from the assistant recalling it in a later
  chat (preferences, standing facts, decisions, ongoing work). This is a DIFFERENT question from
  importance, which asks whether the whole company should see it: a personal working preference is
  meaningful but not important, a supplier's price is both. Throwaway lookups, greetings, tests and
  chitchat are false.`,
      messages: [{ role: 'user', content: `Classify this conversation:\n\n${transcript}` }],
    })
    text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  } catch {
    // classification is best-effort; fall back to safe defaults
  }

  return parseChatTag(text, forcePromote)
}
