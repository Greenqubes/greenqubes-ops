'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Pencil, Trash2 } from 'lucide-react'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

export interface MemoryRow {
  id:      string
  topic:   string | null
  summary: string
  ts:      string
}

interface Props {
  open:    boolean
  onClose: () => void
  lang:    LangCode
}

// Static English date parts — dates are always English (hard rule) and
// locale calls caused the /schedule hydration bug.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function fmtDate(ts: string): string {
  const d = new Date(ts)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function MemoryView({ open, onClose, lang }: Props) {
  const [rows,      setRows]      = useState<MemoryRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editText,  setEditText]  = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/assistant/memory')
      if (res.ok) setRows(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) { setEditId(null); setConfirmId(null); fetchRows() }
  }, [open, fetchRows])

  async function saveEdit() {
    const id = editId
    const summary = editText.trim()
    if (!id || !summary || saving) return
    setSaving(true)
    const res = await fetch('/api/assistant/memory', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, summary }),
    })
    setSaving(false)
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, summary } : r))
      setEditId(null)
    }
  }

  async function forget(id: string) {
    setConfirmId(null)
    setRows(prev => prev.filter(r => r.id !== id))
    const res = await fetch('/api/assistant/memory', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    })
    if (!res.ok) fetchRows()
  }

  if (!open) return null

  return (
    // z-[70]: above the phone drawer (z-[60]) and BottomNav (hard rule)
    <div className="fixed inset-0 z-[70] flex md:items-center md:justify-center">
      <div onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div className="relative bg-paper w-full h-full md:h-auto md:max-h-[80vh] md:w-[560px] md:rounded-2xl md:border md:border-line flex flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-line">
          <div>
            <p className="font-display text-base font-medium text-ink">{t(lang, 'memory')}</p>
            <p className="text-xs text-muted mt-0.5">{t(lang, 'memoryTitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
            aria-label={t(lang, 'memoryCancel')}
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="space-y-4 animate-pulse py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-1/3 rounded bg-line/80" />
                  <div className="h-3 w-full rounded bg-line/60" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-sm text-muted text-center">{t(lang, 'memoryEmpty')}</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map(row => (
                <li key={row.id} className="py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-sm font-medium text-ink truncate">
                        {row.topic ?? 'Untitled'}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">{fmtDate(row.ts)}</p>
                    </div>
                    {editId !== row.id && confirmId !== row.id && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { setEditId(row.id); setEditText(row.summary); setConfirmId(null) }}
                          className="p-1.5 rounded-lg text-ink2 hover:text-ink hover:bg-bg transition-colors"
                          aria-label={t(lang, 'memoryEditLabel')}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => { setConfirmId(row.id); setEditId(null) }}
                          className="p-1.5 rounded-lg text-ink2 hover:text-terracotta hover:bg-bg transition-colors"
                          aria-label={t(lang, 'memoryForget')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editId === row.id ? (
                    <div className="mt-2">
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                        className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60"
                      />
                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={() => setEditId(null)}
                          className="px-3 py-1.5 rounded-xl border border-line text-ink2 text-xs font-medium hover:border-ink2 transition-colors"
                        >
                          {t(lang, 'memoryCancel')}
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={!editText.trim() || saving}
                          className="px-3 py-1.5 rounded-xl bg-terracotta text-white text-xs font-medium hover:bg-terracotta/90 disabled:opacity-50 transition-colors"
                        >
                          {t(lang, 'memorySave')}
                        </button>
                      </div>
                    </div>
                  ) : confirmId === row.id ? (
                    <div className="mt-2 rounded-xl border border-line bg-bg px-3 py-2.5">
                      <p className="text-xs text-ink2">{t(lang, 'memoryForgetConfirm')}</p>
                      <div className="flex gap-2 justify-end mt-2">
                        <button
                          onClick={() => setConfirmId(null)}
                          className="px-3 py-1.5 rounded-xl border border-line text-ink2 text-xs font-medium hover:border-ink2 transition-colors"
                        >
                          {t(lang, 'memoryCancel')}
                        </button>
                        <button
                          onClick={() => forget(row.id)}
                          className="px-3 py-1.5 rounded-xl bg-terracotta text-white text-xs font-medium hover:bg-terracotta/90 transition-colors"
                        >
                          {t(lang, 'memoryForget')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-sm text-ink2 leading-relaxed">{row.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
