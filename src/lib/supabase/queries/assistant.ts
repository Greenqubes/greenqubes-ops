import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { embed } from '@/lib/ai/embed'
import type { ChatTag } from '@/lib/ai/tagger'
import type { Json } from '@/lib/supabase/types'

export interface AsstChatRow {
  id:         string
  topic:      string | null
  msgs:       Json
  tags:       string[] | null
  importance: number | null
  pinned:     boolean
  ts:         string
}

export async function getRecentChats(limit = 20): Promise<AsstChatRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_chats')
    .select('id, topic, msgs, tags, importance, pinned, ts')
    .order('pinned', { ascending: false })
    .order('ts',     { ascending: false })
    .limit(limit)
  return (data ?? []) as AsstChatRow[]
}

export async function pinChat(id: string, pinned: boolean): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_chats')
    .update({ pinned } as never, { count: 'exact' })
    .eq('id', id)
  return !error && (count ?? 0) > 0
}

export async function deleteChat(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('asst_chats')
    .delete({ count: 'exact' })
    .eq('id', id)
  return !error && (count ?? 0) > 0
}

export async function saveChat(
  userId:  string,
  msgs:    { role: string; content: string }[],
  tag:     ChatTag,
): Promise<string | null> {
  const supabase = createServiceClient()

  let embeddingStr: string | null = null
  try {
    const text    = msgs.map(m => m.content).join(' ').slice(0, 2000)
    const vec     = await embed(text)
    embeddingStr  = `[${vec.join(',')}]`
  } catch {
    // embedding is optional — save without it
  }

  const { data, error } = await supabase
    .from('asst_chats')
    .insert({
      user_id:    userId,
      msgs:       msgs as unknown as Json,
      embedding:  embeddingStr,
      topic:      tag.topic,
      entities:   tag.entities,
      tags:       tag.tags,
      importance: tag.importance,
      visibility: tag.visibility,
    })
    .select('id')
    .single()

  if (error) { console.error('saveChat error', error); return null }
  return data?.id ?? null
}
