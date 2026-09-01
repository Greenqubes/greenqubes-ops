// Trust check (spec 2026-08-26): a completion rating is quarantined when it
// disagrees by >=2 levels with BOTH independent witnesses — the AI's own
// prediction from the brief, and the actual time taken. Quarantined ratings
// are stored but never teach; admin can Keep/Discard in the AI Scores tab.
export function impliedComplexityFromDays(days: number): number {
  if (days <= 0.5) return 1
  if (days <= 1) return 2
  if (days <= 3) return 3
  if (days <= 5) return 4
  return 5
}

export function ratingSuspect(input: {
  rating: number
  aiComplexity: number | null
  daysTaken: number
}): boolean {
  const timeGap = Math.abs(input.rating - impliedComplexityFromDays(input.daysTaken))
  const aiGap = input.aiComplexity == null ? null : Math.abs(input.rating - input.aiComplexity)
  if (aiGap == null) return timeGap >= 2
  return aiGap >= 2 && timeGap >= 2
}
