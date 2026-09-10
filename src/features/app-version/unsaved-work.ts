'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * Who currently holds work that a refresh would destroy — a job form with
 * unsaved edits, a file still uploading.
 *
 * A plain module-level set rather than a context: the watcher lives in the top
 * bar and the forms live deep in the page, and threading a provider between
 * them would touch every shell for one boolean.
 */

const holders = new Set<string>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function getSnapshot() {
  return holders.size > 0
}

// The server renders nothing unsaved — there is no form state there yet.
function getServerSnapshot() {
  return false
}

/** True while anything on the page would lose work in a refresh. */
export function useHasUnsavedWork(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Claim from outside React — for work that lives in a function rather than in
 * state, like a file upload. Call the returned function in a `finally` so the
 * claim is dropped even when the upload fails.
 */
export function holdUnsavedWork(key: string): () => void {
  holders.add(key)
  emit()
  return () => { if (holders.delete(key)) emit() }
}

/**
 * Declare that this component is holding unsaved work. Give each caller its
 * own key so two forms on one page cannot clear each other's claim; the claim
 * is dropped automatically when the component unmounts.
 */
export function useUnsavedWork(key: string, active: boolean): void {
  useEffect(() => {
    const had = holders.has(key)
    if (active && !had)      { holders.add(key);    emit() }
    else if (!active && had) { holders.delete(key); emit() }
  }, [key, active])

  useEffect(() => () => {
    if (holders.delete(key)) emit()
  }, [key])
}
