/**
 * When a job's saved map coordinates survive an edit to the Location box, and
 * when they must be thrown away.
 *
 * Captured from 2026-09-16 on Nic's call, against a future "which driver is
 * already near this job" feature. Nothing reads lat/lng yet — this is
 * deliberate data capture, recorded here and in migration 0061 so a later
 * session does not mistake it for dead code.
 *
 * The rule that matters: coordinates belong to a PICKED suggestion. The
 * moment someone types over the box by hand the pin no longer describes what
 * is written there, and stale coordinates are worse than none — a proximity
 * feature would trust them.
 */

export type Coords = { lat: number; lng: number }
export type MaybeCoords = { lat: number | null; lng: number | null }

const EMPTY: MaybeCoords = { lat: null, lng: null }

export function coordsAfterChange(p: {
  previous:       MaybeCoords
  previousValue?: string
  nextValue:      string
  fromPick:       boolean
  pickedCoords?:  Coords | null
}): MaybeCoords {
  if (p.fromPick) {
    return p.pickedCoords
      ? { lat: p.pickedCoords.lat, lng: p.pickedCoords.lng }
      : EMPTY
  }
  if (!p.nextValue.trim()) return EMPTY
  // A hand edit that changes nothing but whitespace is not a new address.
  if (p.previousValue !== undefined && p.previousValue.trim() === p.nextValue.trim()) {
    return p.previous
  }
  return EMPTY
}
