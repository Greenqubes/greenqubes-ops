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

/** True once the scroll position has held still for the last 4 frames —
 *  the blink must not start while the page is still gliding (Nic,
 *  2026-10-14: "it's blinking already when still scrolling"). */
export function scrollSettled(samples: number[], frames = 4, mustHaveMoved = false): boolean {
  if (samples.length < frames) return false
  // A smooth scroll can take a frame or two to start; when one is on its way,
  // those still first frames are not "settled".
  if (mustHaveMoved && samples.every(v => v === samples[0])) return false
  const tail = samples.slice(-frames)
  return tail.every(v => v === tail[0])
}

/** Scroll only if needed, then blink twice — after the scroll has stopped.
 *  The card carries scroll margins for the sticky top bar and the fixed
 *  bottom menu, so 'nearest' brings it fully clear of both, and does nothing
 *  when it is already visible (then the blink starts at once).
 *  Returns how many cards were found (0 = not rendered yet, try again). */
export function blinkJobCards(root: ParentNode, jobId: string): number {
  const cards = Array.from(root.querySelectorAll<HTMLElement>(jobCardSelector(jobId)))
  if (cards.length === 0) return 0
  // Will 'nearest' move the page? Same margins as the card's scroll-mt-20
  // (80px, sticky top bar) and scroll-mb-24 (96px, fixed bottom menu).
  const r = cards[0].getBoundingClientRect()
  const needsScroll = r.top < 80 || r.bottom > window.innerHeight - 96
  cards[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' })

  const samples: number[] = []
  const started = performance.now()
  const waitThenBlink = () => {
    samples.push(window.scrollY)
    // 1.5 s cap: a page that never settles still gets its blink.
    if (!scrollSettled(samples, 4, needsScroll) && performance.now() - started < 1500) {
      requestAnimationFrame(waitThenBlink)
      return
    }
    for (const card of cards) {
      card.classList.remove('gq-blink')
      void card.offsetWidth   // restart the animation if it is already running
      card.classList.add('gq-blink')
      card.addEventListener('animationend', () => card.classList.remove('gq-blink'), { once: true })
    }
  }
  requestAnimationFrame(waitThenBlink)
  return cards.length
}
