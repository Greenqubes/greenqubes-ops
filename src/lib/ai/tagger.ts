import Anthropic from '@anthropic-ai/sdk'
import type { Role } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ChatTag {
  topic:      string
  entities:   string[]
  tags:       string[]
  importance: number
  visibility: string[]
}

export async function tagConversation(
  msgs: { role: string; content: string }[],
  _userRole: Role,
): Promise<ChatTag> {
  const transcript = msgs
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n')
    .slice(0, 4000)

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
  - Default to ["public-internal"] unless clearly sensitive`,
      messages: [{ role: 'user', content: `Classify this conversation:\n\n${transcript}` }],
    })
    text = res.content.find(b => b.type === 'text')?.text ?? '{}'
  } catch {
    // classification is best-effort; fall back to safe defaults
  }

  try {
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Record<string, unknown>
    return {
      topic:      typeof json.topic === 'string'      ? json.topic : 'General',
      entities:   Array.isArray(json.entities)        ? (json.entities as string[]) : [],
      tags:       Array.isArray(json.tags)            ? (json.tags as string[])     : [],
      importance: typeof json.importance === 'number' ? Math.max(1, Math.min(5, json.importance)) : 2,
      visibility: Array.isArray(json.visibility)      ? (json.visibility as string[]) : ['public-internal'],
    }
  } catch {
    return { topic: 'General', entities: [], tags: [], importance: 2, visibility: ['public-internal'] }
  }
}
