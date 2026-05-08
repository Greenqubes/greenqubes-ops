'use client'

import { useState, useRef }        from 'react'
import { usePathname }             from 'next/navigation'
import { Bug, X, Loader2, Upload } from 'lucide-react'
import { cn }                      from '@/lib/utils/cn'
import { useToast }                from '@/components/Toast'

type Priority = 'low' | 'medium' | 'high' | 'urgent'

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low',    label: 'Low'    },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High'   },
  { value: 'urgent', label: 'Urgent' },
]

const PRIORITY_COLOURS: Record<Priority, string> = {
  low:    'border-muted text-muted',
  medium: 'border-amber text-amber',
  high:   'border-terracotta text-terracotta',
  urgent: 'border-[var(--bad)] text-[var(--bad)]',
}

const PRIORITY_SELECTED: Record<Priority, string> = {
  low:    'bg-muted/10 border-muted text-muted',
  medium: 'bg-amber/10 border-amber text-amber',
  high:   'bg-terracotta/10 border-terracotta text-terracotta',
  urgent: 'bg-[var(--bad)]/10 border-[var(--bad)] text-[var(--bad)]',
}

export function BugReportButton() {
  const pathname              = usePathname()
  const toast                 = useToast()
  const [isOpen,    setIsOpen]    = useState(false)
  const [message,   setMessage]   = useState('')
  const [priority,  setPriority]  = useState<Priority>('medium')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Hide on login and assistant pages (same exclusion as AI bubble)
  if (pathname === '/login' || pathname === '/assistant') return null

  function handleClose() {
    setIsOpen(false)
    setMessage('')
    setPriority('medium')
    setScreenshot(null)
  }

  async function handleSubmit() {
    if (!message.trim() || submitting) return
    setSubmitting(true)
    try {
      let screenshotKey: string | null = null

      // Upload screenshot to R2 if provided
      if (screenshot) {
        const urlRes = await fetch('/api/bugs/upload-url', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ filename: screenshot.name, contentType: screenshot.type }),
        })
        if (urlRes.ok) {
          const { url, key } = await urlRes.json() as { url: string; key: string }
          await fetch(url, {
            method:  'PUT',
            headers: { 'Content-Type': screenshot.type },
            body:    screenshot,
          })
          screenshotKey = key
        }
      }

      const res = await fetch('/api/bugs', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:       message.trim(),
          priority,
          screenshotKey,
          route:         window.location.pathname,
          screen:        `${window.screen.width}×${window.screen.height}`,
        }),
      })

      if (res.ok) {
        toast.success('Bug report submitted — thank you!')
        handleClose()
      } else {
        toast.error('Failed to submit bug report. Please try again.')
      }
    } catch {
      toast.error('Failed to submit bug report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* ── Modal ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" aria-hidden />
          <div className="relative z-10 w-full max-w-sm bg-paper rounded-2xl shadow-xl border border-line p-5 flex flex-col gap-4">

            {/* Header */}
            <div className="flex items-center gap-2">
              <Bug size={16} className="text-terracotta shrink-0" />
              <p className="flex-1 font-display text-base font-medium text-ink leading-none">
                Report a Bug
              </p>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-muted hover:text-ink2 hover:bg-bg transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Message */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted font-medium">
                Description <span className="text-terracotta">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="What went wrong? What did you expect to happen?"
                rows={4}
                className={cn(
                  'w-full resize-none rounded-xl border border-line bg-bg px-3 py-2.5 text-sm text-ink placeholder:text-muted',
                  'focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta/60 transition-colors leading-relaxed',
                )}
              />
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] uppercase tracking-widest text-muted font-medium">Priority</p>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      'flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                      priority === p.value
                        ? PRIORITY_SELECTED[p.value]
                        : `${PRIORITY_COLOURS[p.value]} opacity-50 hover:opacity-75`,
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Screenshot */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] uppercase tracking-widest text-muted font-medium">
                Screenshot <span className="text-muted font-normal normal-case tracking-normal">(optional)</span>
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => setScreenshot(e.target.files?.[0] ?? null)}
              />
              {screenshot ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-line bg-bg">
                  <p className="flex-1 text-xs text-ink2 truncate">{screenshot.name}</p>
                  <button
                    onClick={() => { setScreenshot(null); if (fileRef.current) fileRef.current.value = '' }}
                    className="text-muted hover:text-terracotta transition-colors"
                    aria-label="Remove screenshot"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-line text-muted hover:border-ink2 hover:text-ink2 transition-colors text-xs"
                >
                  <Upload size={13} />
                  Attach screenshot
                </button>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!message.trim() || submitting}
              className={cn(
                'w-full py-2.5 rounded-xl text-sm font-medium transition-colors',
                message.trim() && !submitting
                  ? 'bg-terracotta text-white hover:bg-terracotta/90'
                  : 'bg-line text-muted cursor-not-allowed',
              )}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Submitting…
                </span>
              ) : (
                'Submit Report'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Floating trigger button — sits above AI bubble ── */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={cn(
          'fixed right-4 z-[59] w-10 h-10 rounded-full shadow-lg',
          'flex items-center justify-center transition-all duration-200',
          'bottom-[136px]',
          isOpen
            ? 'bg-ink text-paper hover:bg-ink/90'
            : 'bg-terracotta/90 text-white hover:bg-terracotta',
        )}
        aria-label="Report a bug"
        title="Report a bug"
      >
        <Bug size={17} />
      </button>
    </>
  )
}
