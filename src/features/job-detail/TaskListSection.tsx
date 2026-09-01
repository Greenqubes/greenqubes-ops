'use client'

import { useEffect, useRef, useState } from 'react'
import { ListChecks, Plus, X, Check, ChevronDown } from 'lucide-react'
import { Card } from '@/components/Card'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import { useCardCollapse } from './useCardCollapse'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'

type Task = { id: string; text: string; is_completed: boolean; sort_order: number }

interface Props {
  jobId:    string
  role:     Role
  lang:     LangCode
  /** Completed jobs lock the list for everyone. */
  readOnly: boolean
  /** Bump to re-pull from the server (live job-form events). */
  refreshKey?: number
}

// Job task list (Phase 4, approved mockup). Office roles build the list —
// drag to reorder, add, delete. Installers get interactive checkboxes with a
// progress bar and tick tasks off on site (externals do the same on their
// /ext link page). Checkboxes are decorative in edit mode.
export function TaskListSection({ jobId, role, lang, readOnly, refreshKey }: Props) {
  const canEdit = !readOnly && (['sales', 'scheduler', 'coordinator', 'admin'] as Role[]).includes(role)
  const canTick = !readOnly && role === 'installer'

  const [tasks,    setTasks]    = useState<Task[]>([])
  const [loaded,   setLoaded]   = useState(false)
  const [adding,   setAdding]   = useState(false)
  const [newText,  setNewText]  = useState('')
  const [dragging, setDragging] = useState<string | null>(null)

  const listRef  = useRef<HTMLDivElement>(null)
  const tasksRef = useRef<Task[]>([])
  const dragId   = useRef<string | null>(null)
  useEffect(() => { tasksRef.current = tasks }, [tasks])

  useEffect(() => {
    if (dragId.current) return   // mid-drag — skip; the next event or reload catches up
    let cancelled = false
    fetch(`/api/jobs/${jobId}/tasks`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Task[]) => { if (!cancelled) { setTasks(data); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [jobId, refreshKey])

  const addTask = async () => {
    const text = newText.trim()
    if (!text) return
    setNewText('')
    try {
      const res = await fetch(`/api/jobs/${jobId}/tasks`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error()
      const task: Task = await res.json()
      setTasks(prev => [...prev, task])
    } catch {
      setNewText(text)
    }
  }

  const deleteTask = async (taskId: string) => {
    const prev = tasks
    setTasks(p => p.filter(task => task.id !== taskId))
    try {
      const res = await fetch(`/api/jobs/${jobId}/tasks`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ task_id: taskId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(prev)
    }
  }

  const clearAll = async () => {
    const prev = tasks
    setTasks([])
    setAdding(false)
    try {
      const res = await fetch(`/api/jobs/${jobId}/tasks`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ all: true }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(prev)
    }
  }

  const toggleTask = async (task: Task) => {
    const next = !task.is_completed
    setTasks(prev => prev.map(x => x.id === task.id ? { ...x, is_completed: next } : x))
    try {
      const res = await fetch(`/api/jobs/${jobId}/tasks`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ task_id: task.id, is_completed: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setTasks(prev => prev.map(x => x.id === task.id ? { ...x, is_completed: !next } : x))
    }
  }

  // ── Drag reorder (pointer events — works with mouse AND touch) ────────────
  const onHandleDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    dragId.current = id
    setDragging(id)
  }

  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragId.current || !listRef.current) return
    const rows = Array.from(listRef.current.children) as HTMLElement[]
    let target = rows.length - 1
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) { target = i; break }
    }
    setTasks(prev => {
      const from = prev.findIndex(task => task.id === dragId.current)
      if (from === -1 || from === target) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const onHandleUp = () => {
    if (!dragId.current) return
    dragId.current = null
    setDragging(null)
    void fetch(`/api/jobs/${jobId}/tasks`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ order: tasksRef.current.map(task => task.id) }),
    }).catch(() => {})
  }

  const done  = tasks.filter(task => task.is_completed).length
  const total = tasks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  // PC-only card collapse — same per-device memory as the other job cards.
  const { open, toggle } = useCardCollapse('gq-jobcard-tasks')

  // Non-editors don't need an empty card taking up form space.
  if (!canEdit && (!loaded || total === 0)) return null

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-4 py-3 border-b border-line flex items-center justify-between gap-2',
        !open && 'lg:border-b-0',
      )}>
        <div className="flex items-center gap-2">
          <ListChecks size={12} className={cn(done === total && total > 0 ? 'text-brand-green' : 'text-muted')} />
          <span className="text-[13px] font-semibold tracking-wide uppercase text-muted">
            {t(lang, 'taskListTitle')}
          </span>
          {canEdit && (
            <span className="text-[10px] font-medium text-muted bg-bg border border-line rounded px-1.5 py-px">
              {t(lang, 'taskListOptional')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {canEdit && total > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex items-center gap-1 text-[11px] font-semibold text-terracotta"
            >
              <X size={11} />
              {t(lang, 'taskListClearAll')}
            </button>
          )}
          {!canEdit && total > 0 && done === total && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-brand-green">
              <Check size={12} strokeWidth={3} />
              {t(lang, 'taskListAllDone')}
            </span>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="hidden lg:flex items-center justify-center w-6 h-6 rounded text-muted hover:text-ink transition-colors"
          >
            <ChevronDown size={14} className={cn('transition-transform', !open && '-rotate-90')} />
          </button>
        </div>
      </div>

      {/* Body — folds on PC when the card is collapsed */}
      <div className={cn(!open && 'lg:hidden')}>

      {/* Progress (tick + read-only views) */}
      {!canEdit && total > 0 && (
        <div className="px-4 pt-2.5 pb-2 border-b border-bg">
          <div className="flex justify-between text-[11px] text-muted mb-1">
            <span>{done}/{total} {t(lang, 'taskListDoneLabel')}</span>
            <span className="font-semibold text-brand-green">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-line overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-green transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Empty state (edit mode only) */}
      {canEdit && loaded && total === 0 && !adding && (
        <div className="px-5 py-6 flex flex-col items-center gap-2 text-center">
          <div className="w-11 h-11 rounded-full bg-bg flex items-center justify-center">
            <ListChecks size={18} className="text-line" />
          </div>
          <p className="text-sm font-medium text-ink2">{t(lang, 'taskListEmptyTitle')}</p>
          <p className="text-xs text-muted max-w-[240px] leading-relaxed">{t(lang, 'taskListEmptyHint')}</p>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-1 flex items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-line bg-bg px-4 py-2 text-xs font-semibold text-ink2 hover:border-brand-green hover:text-ink transition-colors"
          >
            <Plus size={12} />
            {t(lang, 'taskListAddFirst')}
          </button>
        </div>
      )}

      {/* Task rows */}
      {total > 0 && (
        <div ref={listRef}>
          {tasks.map(task => (
            <div
              key={task.id}
              className={cn(
                'flex items-start gap-2.5 px-4 py-2.5 border-b border-bg last:border-b-0',
                dragging === task.id && 'bg-bg',
              )}
            >
              {canEdit && (
                <button
                  type="button"
                  aria-label="Reorder"
                  onPointerDown={e => onHandleDown(e, task.id)}
                  onPointerMove={onHandleMove}
                  onPointerUp={onHandleUp}
                  onPointerCancel={onHandleUp}
                  className="shrink-0 mt-1 cursor-grab active:cursor-grabbing touch-none px-0.5"
                >
                  <span className="grid grid-cols-2 gap-[3px]">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span key={i} className="w-[3px] h-[3px] rounded-full bg-line" />
                    ))}
                  </span>
                </button>
              )}

              {canTick ? (
                <button
                  type="button"
                  onClick={() => toggleTask(task)}
                  className={cn(
                    'w-5 h-5 rounded-md border-2 shrink-0 mt-px flex items-center justify-center transition-colors',
                    task.is_completed ? 'bg-brand-green border-brand-green' : 'bg-paper border-line',
                  )}
                >
                  {task.is_completed && <Check size={12} strokeWidth={3} className="text-white" />}
                </button>
              ) : (
                <span
                  className={cn(
                    'w-[18px] h-[18px] rounded-[5px] border-[1.5px] shrink-0 mt-0.5 flex items-center justify-center',
                    task.is_completed ? 'bg-brand-green border-brand-green' : 'bg-paper border-line',
                  )}
                >
                  {task.is_completed && <Check size={11} strokeWidth={3} className="text-white" />}
                </span>
              )}

              <span
                className={cn(
                  'flex-1 text-sm leading-relaxed pt-px',
                  task.is_completed ? 'text-muted line-through' : 'text-ink',
                )}
              >
                {task.text}
              </span>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteTask(task.id)}
                  aria-label="Delete task"
                  className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-line hover:text-terracotta hover:bg-terracotta-soft transition-colors"
                >
                  <X size={11} strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add row */}
      {canEdit && (total > 0 || adding) && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-bg">
          <input
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void addTask() } }}
            placeholder={t(lang, 'taskListAddPlaceholder')}
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20"
          />
          <button
            type="button"
            onClick={() => void addTask()}
            aria-label="Add task"
            className="w-8 h-8 rounded-lg bg-brand-blue flex items-center justify-center shrink-0 disabled:opacity-40"
            disabled={!newText.trim()}
          >
            <Plus size={14} className="text-white" strokeWidth={2.5} />
          </button>
        </div>
      )}
      </div>
    </Card>
  )
}
