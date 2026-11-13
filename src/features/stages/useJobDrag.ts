'use client'

import { useEffect, useRef, useState, type DragEvent, type HTMLAttributes } from 'react'
import type { StageJob } from '@/lib/supabase/queries/jobs'

const OUT = '__out__'

/**
 * Drag a job into or out of a group on the Jobs tab — computers only (Nic,
 * 2026-11-11: on a phone it's tick + Add to group, since dragging in a long
 * list is fiddly). Native HTML5 drag and drop (the driver board uses pointer
 * events instead; a plain list needs no more than this).
 *
 * Nothing may move under the pointer as a drag starts: Chrome cancels a drag
 * whose element is no longer under the point it began (final review). So the
 * drag state is set a moment AFTER dragstart, and the "take it out" hint
 * floats instead of pushing the list down.
 *
 *  - every row/card is draggable;
 *  - a group accepts a job that isn't already in it → onAdd;
 *  - while a grouped job is dragged, the list outside the groups accepts it
 *    → onRemove. Its own group swallows the drop, so letting go back on it
 *    changes nothing.
 */
export function useJobDrag({ enabled, onAdd, onRemove }: {
  enabled:  boolean
  onAdd:    (jobId: string, groupId: string) => void
  onRemove: (jobId: string) => void
}) {
  // Read after mount: the server render has no pointer.
  const [fine, setFine] = useState(false)
  useEffect(() => { setFine(window.matchMedia('(pointer: fine)').matches) }, [])
  const on = enabled && fine

  const [drag, setDrag] = useState<{ id: string; groupId: string | null } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  // Each drag gets a number; a delayed start for a drag that already ended
  // (a quick click-drag) is dropped, so the state never sticks on.
  const dragNo = useRef(0)
  const end = () => { dragNo.current++; setDrag(null); setOver(null) }

  const dragProps = (job: StageJob): HTMLAttributes<HTMLLIElement> => on ? {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLLIElement>) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', job.id)
      const started = { id: job.id, groupId: job.group_id }
      const no = ++dragNo.current
      setTimeout(() => { if (dragNo.current === no) setDrag(started) }, 0)
    },
    onDragEnd: end,
  } : {}

  const groupDrop = (groupId: string): { active: boolean; props: HTMLAttributes<HTMLLIElement> } => {
    if (!drag) return { active: false, props: {} }
    if (drag.groupId === groupId) {
      // Its own group: swallow, so the list below doesn't read "take it out".
      return { active: false, props: { onDragOver: e => e.stopPropagation(), onDrop: e => e.stopPropagation() } }
    }
    return {
      active: over === groupId,
      props: {
        onDragOver: e => { e.preventDefault(); e.stopPropagation(); if (over !== groupId) setOver(groupId) },
        onDragLeave: e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(o => o === groupId ? null : o)
        },
        onDrop: e => { e.preventDefault(); e.stopPropagation(); const id = drag.id; end(); onAdd(id, groupId) },
      },
    }
  }

  const dragOut = !!drag?.groupId
  const listDrop: HTMLAttributes<HTMLDivElement> = dragOut ? {
    onDragOver: e => { e.preventDefault(); if (over !== OUT) setOver(OUT) },
    onDrop: e => { e.preventDefault(); const id = drag!.id; end(); onRemove(id) },
  } : {}

  return { dragProps, groupDrop, listDrop, dragOut, draggingId: drag?.id ?? null }
}
