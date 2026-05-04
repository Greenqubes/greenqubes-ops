import { embed } from './embed'
import { createClient } from '@/lib/supabase/server'

export interface RetrievedContext {
  chunks:    { source_path: string; content: string; similarity: number }[]
  pastChats: { topic: string | null; summary: string; similarity: number }[]
}

export async function retrieveContext(query: string): Promise<RetrievedContext> {
  let embedding: number[]
  try {
    embedding = await embed(query)
  } catch {
    return { chunks: [], pastChats: [] }
  }

  const supabase = await createClient()

  // Cast needed: Supabase rpc() generic inference doesn't handle number[] args well
  // in this SDK version — at runtime the values are correct.
  const args = (a: object) => a as never
  const [kbRes, chatRes] = await Promise.all([
    supabase.rpc('match_kb_chunks',  args({ query_embedding: embedding, match_threshold: 0.5, match_count: 5 })),
    supabase.rpc('match_asst_chats', args({ query_embedding: embedding, match_threshold: 0.5, match_count: 3 })),
  ])

  type KbRow   = { source_path: string; content: string; similarity: number }
  type ChatRow = { topic: string | null; msgs: unknown; similarity: number }

  const chunks = ((kbRes.data ?? []) as KbRow[]).map(r => ({
    source_path: r.source_path,
    content:     r.content,
    similarity:  r.similarity,
  }))

  const pastChats = ((chatRes.data ?? []) as ChatRow[]).map(r => {
    const msgs = Array.isArray(r.msgs) ? (r.msgs as { role: string; content: string }[]) : []
    const first = msgs.find(m => m.role === 'user')?.content ?? ''
    return {
      topic:     r.topic,
      summary:   first.slice(0, 200),
      similarity: r.similarity,
    }
  })

  return { chunks, pastChats }
}

export function formatContext(ctx: RetrievedContext): string {
  if (ctx.chunks.length === 0 && ctx.pastChats.length === 0) return ''

  const parts: string[] = []

  if (ctx.chunks.length > 0) {
    parts.push('--- Knowledge base ---')
    ctx.chunks.forEach((c, i) => {
      parts.push(`[KB${i + 1}] ${c.source_path}\n${c.content}`)
    })
  }

  if (ctx.pastChats.length > 0) {
    parts.push('--- Relevant past conversations ---')
    ctx.pastChats.forEach((c, i) => {
      const label = c.topic ? `Topic: ${c.topic}` : `Chat ${i + 1}`
      parts.push(`[${label}]\n${c.summary}`)
    })
  }

  return parts.join('\n\n')
}
