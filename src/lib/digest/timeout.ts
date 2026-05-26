import { createServiceClient } from '@/lib/supabase/service'
import { sendDigestTelegram } from '@/lib/telegram/bot'
import { tplVoteStatusTimeout } from '@/lib/telegram/templates'

export async function runDigestTimeout(): Promise<{ resolved: number }> {
  const db = createServiceClient()
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

  const { data: chats } = await db
    .from('asst_chats')
    .select('id, topic, importance, ts')
    .gte('importance', 4)

  if (!chats?.length) return { resolved: 0 }

  const { data: allVotes } = await db
    .from('digest_votes')
    .select('chat_id, voter_id, vote, ts')

  const { data: allVoters } = await db
    .from('users')
    .select('id, telegram_chat_id')
    .eq('digest_subscriber', true)
    .not('telegram_chat_id', 'is', null)

  const total = (allVoters ?? []).length || 1
  let resolved = 0

  for (const chat of chats) {
    const chatVotes = (allVotes ?? []).filter(v => v.chat_id === chat.id)
    const yesCount = chatVotes.filter(v => v.vote === 'yes').length
    const noCount  = chatVotes.filter(v => v.vote === 'no').length

    if (yesCount / total > 0.5 || noCount / total > 0.5) continue

    // Use oldest vote timestamp as "sent at" proxy; fall back to chat.ts
    const voteTimes = chatVotes.map(v => v.ts).filter(Boolean).sort()
    const refTime   = voteTimes[0] ?? chat.ts
    if (new Date(refTime) > new Date(fiveDaysAgo)) continue

    const outcome: 'promoted' | 'dismissed' = yesCount / total > 0.5 ? 'promoted' : 'dismissed'
    const chatDate = new Date(chat.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })

    const text = tplVoteStatusTimeout({
      topic:       chat.topic ?? 'Untitled conversation',
      date:        chatDate,
      importance:  chat.importance ?? 4,
      yesCount,
      noCount,
      totalVoters: total,
      outcome,
    })

    // Fill remaining voters with auto-votes to prevent re-triggering on next cron run
    const votedIds = new Set(chatVotes.map(v => v.voter_id))
    const autoVote = outcome === 'promoted' ? 'yes' : 'no'
    for (const u of allVoters ?? []) {
      if (!votedIds.has(u.id)) {
        await db.from('digest_votes').upsert(
          { chat_id: chat.id, voter_id: u.id, vote: autoVote },
          { onConflict: 'chat_id,voter_id' },
        )
      }
    }

    for (const voter of allVoters ?? []) {
      if (voter.telegram_chat_id) {
        await sendDigestTelegram(voter.telegram_chat_id, text)
      }
    }

    resolved++
  }

  return { resolved }
}
