/**
 * Where the My Jobs panel sits on a PC: between the top bar and the bottom
 * menu, so both stay full width and untouched (Nic's screenshot, 2026-10-14).
 * Measured from the page, never guessed — a guessed 60px top let it run over
 * the bottom menu. Pure so it can be tested on its own.
 */
export function desktopPanelBox(input: {
  /** Bottom edge of the top bar, or null when there is none. */
  topBarBottom:   number | null
  /** Top edge of the fixed bottom menu, or null when there is none. */
  navTop:         number | null
  viewportHeight: number
}): { top: number; bottom: number } {
  const top    = Math.max(0, Math.round(input.topBarBottom ?? 0))
  const bottom = input.navTop == null ? 0 : Math.max(0, Math.round(input.viewportHeight - input.navTop))
  return { top, bottom }
}
