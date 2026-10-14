/**
 * Jumping to a job from the My Jobs panel (Nic, 2026-10-14): land on its date,
 * bring the card into view only if it is off screen, and blink it twice.
 */

export type ScheduleView = 'list' | 'board' | 'week' | 'month'

/** Month shows dots, not cards — it switches to that day's List, the same as
 *  tapping a day in Month. Every other view keeps the person where they are. */
export function viewAfterPick(view: ScheduleView): ScheduleView {
  return view === 'month' ? 'list' : view
}

/** Every copy of a job's card (a job shared with an outside contractor shows
 *  twice on the Drivers board). JobRow tags its card with data-job-card. */
export function jobCardSelector(jobId: string): string {
  return `[data-job-card="${jobId.replace(/["\\]/g, '\\$&')}"]`
}

/** Scroll only if needed, then blink twice. The card carries scroll margins
 *  for the sticky top bar and the fixed bottom menu, so 'nearest' brings it
 *  fully clear of both — and does nothing when it is already visible. */
export function blinkJobCards(root: ParentNode, jobId: string): number {
  const cards = Array.from(root.querySelectorAll<HTMLElement>(jobCardSelector(jobId)))
  if (cards.length === 0) return 0
  cards[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  for (const card of cards) {
    card.classList.remove('gq-blink')
    void card.offsetWidth   // restart the animation if it is already running
    card.classList.add('gq-blink')
    card.addEventListener('animationend', () => card.classList.remove('gq-blink'), { once: true })
  }
  return cards.length
}
