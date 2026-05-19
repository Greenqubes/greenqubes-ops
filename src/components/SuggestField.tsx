'use client'

import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface Props {
  value:    string
  onAccept: (suggestion: string) => void
  readOnly?: boolean
  field?:   string
  children: ReactNode
}

export function SuggestField({ value, onAccept, readOnly = false, field, children }: Props) {
  const [loading,    setLoading]    = useState(false)
  const [suggestion, setSuggestion] = useState<string | null>(null)

  const handleImprove = async () => {
    if (!value.trim() || loading) return
    setLoading(true)
    setSuggestion(null)
    try {
      const res  = await fetch('/api/ai/suggest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ field, value }),
      })
      const data = await res.json() as { suggestion?: string }
      if (data.suggestion) setSuggestion(data.suggestion)
    } finally {
      setLoading(false)
    }
  }

  const showButton = !readOnly && value.trim().length > 0 && !loading && !suggestion

  return (
    <div>
      {(showButton || loading) && (
        <div className="flex justify-end mb-1">
          {showButton && (
            <button
              type="button"
              onClick={handleImprove}
              className="text-xs font-medium text-muted border border-line bg-paper hover:text-terracotta hover:border-terracotta hover:bg-terracotta/5 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
            >
              ✦ Improve
            </button>
          )}
          {loading && (
            <span className="text-xs text-muted">Improving…</span>
          )}
        </div>
      )}
      {children}
      {suggestion && (
        <div className="mt-2 rounded-xl border-2 border-dashed border-terracotta bg-terracotta/[0.04] px-3.5 py-3">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-terracotta mb-2.5">✦ Improve</p>
          <p className={cn('text-[10px] font-semibold tracking-wider uppercase text-muted mb-1')}>Your original</p>
          <p className="text-sm text-muted mb-2.5 leading-relaxed">{value}</p>
          <p className={cn('text-[10px] font-semibold tracking-wider uppercase text-muted mb-1')}>Suggested</p>
          <p className="text-sm text-ink mb-3 leading-relaxed">{suggestion}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="flex-1 py-2 rounded-lg border border-line bg-paper text-sm font-medium text-ink2"
            >
              Keep mine
            </button>
            <button
              type="button"
              onClick={() => { onAccept(suggestion); setSuggestion(null) }}
              className="flex-1 py-2 rounded-lg bg-terracotta text-sm font-medium text-white"
            >
              Use this
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
