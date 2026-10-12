// Which buttons EditClashModal offers. Pure so it can be tested standalone.
//
// A coordinator facing a real clash or leave escalates ("Alert scheduler"),
// as before. But when the ONLY thing raised is an away-on-work warning, there
// is nothing to escalate — it is amber, never a block (Nic, 2026-10-09) — so
// every role gets Save anyway / Go back.

export type EditClashActions = 'alert-scheduler' | 'save-anyway'

/** The pop-up's title. An away-only result is a heads-up, so it must never
 *  be headed "Clash detected" (review, 2026-10-12). */
export function editClashTitleKey(counts: { clashes: number; leave: number }): 'fcfsClashDetected' | 'awayHeadsUpTitle' {
  return counts.clashes > 0 || counts.leave > 0 ? 'fcfsClashDetected' : 'awayHeadsUpTitle'
}

export function editClashActions(
  role: string,
  counts: { clashes: number; leave: number },
): EditClashActions {
  const blocking = counts.clashes > 0 || counts.leave > 0
  return role === 'coordinator' && blocking ? 'alert-scheduler' : 'save-anyway'
}
