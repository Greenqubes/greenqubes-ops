// src/lib/digest/autoPromote.ts

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { commitVaultFile, topicToSlug } from '@/lib/github/vault'
import type { Json } from '@/lib/supabase/types'

const anthropic = new Anthropic()

type ChatMsg = { role: string; content: string }

function parseMsgs(msgs: Json): ChatMsg[] {
  if (!Array.isArray(msgs)) return []
  return msgs.filter((m): m is ChatMsg =>
    typeof m === 'object' && m !== null &&
    typeof (m as Record<string, unknown>).role === 'string' &&
    typeof (m as Record<string, unknown>).content === 'string',
  )
}

async function generateSummary(msgs: Json, topic: string | null): Promise<string> {
  const conversation = parseMsgs(msgs)
    .map(m => `${(m as ChatMsg).role}: ${(m as ChatMsg).content}`)
    .join('\n')
    .slice(0, 6000)

  if (!conversation.trim()) return topic ?? '[No content]'

  const res = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role:    'user',
      content: `Write a concise knowledge-base note (100–300 words) from this AI assistant conversation.
Focus on useful learnings, decisions, or information discussed.
Write in third person ("The team discussed…").
Structure as flowing prose — no bullet lists. No preamble.

${conversation}`,
    }],
  })

  return res.content[0].type === 'text' ? res.content[0].text : '[Summary unavailable]'
}

/**
 * Promotes an asst_chats conversation to the Obsidian vault.
 * Generates a Sonnet summary, assembles frontmatter from stored visibility/tags,
 * and commits a .md file to vault/digest/ via GitHub API.
 *
 * Returns the vault file path on success, throws on failure.
 */
export async function autoPromoteToVault(chatId: string): Promise<{ path: string }> {
  const db = createServiceClient()

  const { data: chat, error } = await db
    .from('asst_chats')
    .select('id, msgs, topic, tags, visibility, ts')
    .eq('id', chatId)
    .single()

  if (error || !chat) throw new Error(`Chat ${chatId} not found`)

  const summary    = await generateSummary(chat.msgs, chat.topic)
  const date       = new Date(chat.ts).toISOString().split('T')[0]
  const topic      = chat.topic ?? 'Untitled conversation'
  const slug       = topicToSlug(topic)
  const tags       = Array.isArray(chat.tags) && chat.tags.length
                       ? (chat.tags as string[]).join(', ')
                       : 'assistant, digest'
  const visibility = Array.isArray(chat.visibility) && chat.visibility.length
                       ? (chat.visibility as string[]).join(', ')
                       : 'public-internal'

  const noteContent = `---
visibility: [${visibility}]
tags: [${tags}]
source: ai-assistant
date: ${date}
---

# ${topic}

*Promoted from assistant conversation — ${date}*

${summary}
`

  const filePath = `digest/${date}-${slug}.md`
  await commitVaultFile(filePath, noteContent, `digest: promote "${topic}" (${date})`)

  return { path: filePath }
}
