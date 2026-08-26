import { embed } from './embed'
import { createClient } from '@/lib/supabase/server'
import { pastChatSummary } from './past-chat-summary'

export interface PastChat { topic: string | null; summary: string; similarity: number }
export interface KbHit    { source_path: string; content: string; similarity: number }

// Cast needed: Supabase rpc() generic inference doesn't handle number[] args well
// in this SDK version — at runtime the values are correct.
const args = (a: object) => a as never

/** Automatic per-user memory: the caller's own past chats (RLS via
 *  SECURITY INVOKER match_asst_chats — migration 0030 isolation).
 *  Inside a project (Phase 4): sibling chats in the same project match
 *  first, general per-user memory beneath. */
export async function retrievePastChats(query: string, projectId?: string): Promise<PastChat[]> {
  let embedding: number[]
  try { embedding = await embed(query, 'query') } catch { return [] }

  const supabase = await createClient()
  type Row = { id: string; topic: string | null; summary: string | null; msgs: unknown; similarity: number }
  const rows: Row[] = []

  if (projectId) {
    const { data } = await supabase.rpc('match_asst_chats',
      args({ query_embedding: embedding, match_threshold: 0.5, match_count: 3, project_filter: projectId }))
    rows.push(...((data ?? []) as Row[]))
  }

  const { data } = await supabase.rpc('match_asst_chats',
    args({ query_embedding: embedding, match_threshold: 0.5, match_count: 3 }))
  for (const r of (data ?? []) as Row[]) {
    if (!rows.some(x => x.id === r.id)) rows.push(r)
  }

  return rows.slice(0, projectId ? 4 : 3)
    .map(r => ({ topic: r.topic, summary: pastChatSummary(r), similarity: r.similarity }))
    .filter(r => r.summary !== '')
}

/** KB vector search — now a tool the model calls (repeatably) rather than a
 *  pre-baked one-shot. Visibility filtering via RLS on kb_chunks. */
export async function searchKnowledge(query: string): Promise<KbHit[]> {
  let embedding: number[]
  try { embedding = await embed(query, 'query') } catch { return [] }

  const supabase = await createClient()
  const { data } = await supabase.rpc('match_kb_chunks',
    args({ query_embedding: embedding, match_threshold: 0.35, match_count: 5 }))

  type Row = { source_path: string; content: string; similarity: number }
  return ((data ?? []) as Row[]).map(r => ({
    source_path: r.source_path, content: r.content, similarity: r.similarity,
  }))
}

export function formatPastChats(chats: PastChat[]): string {
  if (chats.length === 0) return ''
  const parts = ['--- Relevant past conversations (this user only) ---']
  chats.forEach((c, i) => {
    const label = c.topic ? `Topic: ${c.topic}` : `Chat ${i + 1}`
    parts.push(`[${label}]\n${c.summary}`)
  })
  return parts.join('\n\n')
}
