/** What the automatic memory block recalls for one past chat: the stored
 *  summary (Phase 2 rows), or the old first-message truncation for rows
 *  saved before migration 0046. Pure — standalone-testable. */
export function pastChatSummary(row: { summary: string | null; msgs: unknown }): string {
  if (row.summary && row.summary.trim()) return row.summary
  const msgs  = Array.isArray(row.msgs) ? (row.msgs as { role: string; content: string }[]) : []
  const first = msgs.find(m => m.role === 'user')?.content ?? ''
  return first.slice(0, 200)
}
