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
  project_id: string | null
  ts:         string
}

export async function getRecentChats(limit = 20): Promise<AsstChatRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('asst_chats')
    .select('id, topic, msgs, tags, importance, pinned, project_id, ts')
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
  const { error } = await supabase
    .from('asst_chats')
    .delete()
    .eq('id', id)
  if (error) console.error('[deleteChat] error', error)
  return !error
}

export async function updateChat(
  id:     string,
  userId: string,
  msgs:   { role: string; content: string }[],
  tag:    ChatTag,
  // undefined = leave project_id untouched (callers that predate projects,
  // e.g. the floating panel); null = explicitly file under no project.
  projectId?: string | null,
): Promise<string | null> {
  const supabase = createServiceClient()

  // Scope to the caller's own row (audit 2026-08-13, finding #4): this uses the
  // service client, so ownership must be enforced here. If existingId belongs to
  // another user (or was deleted), original is null and the caller falls back to
  // inserting a fresh row owned by the caller — never overwriting someone else's.
  const { data: original } = await supabase
    .from('asst_chats')
    .select('topic')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!original) return null  // not the caller's row (or deleted); fall back to insert

  // Only meaningful chats enter memory — same gate as saveChat. Continuing a
  // conversation regenerates its summary, so a manual Memory-view edit is
  // overwritten if the same chat is continued afterwards (accepted trade-off;
  // avoiding that would need an extra "edited" flag — YAGNI).
  const summary = tag.meaningful && tag.summary.trim() ? tag.summary.trim() : null
  let embeddingStr: string | null = null
  if (summary) {
    try {
      const vec    = await embed(`${original.topic ?? tag.topic}\n${summary}`, 'document')
      embeddingStr = `[${vec.join(',')}]`
    } catch { /* embedding optional */ }
  }

  const { error } = await supabase
    .from('asst_chats')
    .update({
      msgs:       msgs as unknown as Json,
      embedding:  embeddingStr,
      topic:      original.topic ?? tag.topic,
      tags:       tag.tags,
      importance: tag.importance,
      summary,
      ...(projectId !== undefined ? { project_id: projectId } : {}),
      ts:         new Date().toISOString(),
    } as never)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) { console.error('updateChat error', error); return null }
  return id
}

export async function saveChat(
  userId:  string,
  msgs:    { role: string; content: string }[],
  tag:     ChatTag,
  projectId?: string | null,
): Promise<string | null> {
  const supabase = createServiceClient()

  // Only meaningful chats enter memory (Nic 2026-08-24): trivial chats keep
  // summary + embedding NULL so they never match in retrieval and never show
  // in the Memory view. Embedding input is topic + summary (not raw messages).
  const summary = tag.meaningful && tag.summary.trim() ? tag.summary.trim() : null
  let embeddingStr: string | null = null
  if (summary) {
    try {
      const vec    = await embed(`${tag.topic}\n${summary}`, 'document')
      embeddingStr = `[${vec.join(',')}]`
    } catch { /* embedding optional */ }
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
      summary,
      project_id: projectId ?? null,
    })
    .select('id')
    .single()

  if (error) { console.error('saveChat error', error); return null }
  return data?.id ?? null
}
