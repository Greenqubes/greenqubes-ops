'use client'

import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ModalProps {
  isOpen:    boolean
  onClose:   () => void
  title?:    string
  children:  ReactNode
  className?: string
  /**
   * Cap the pop-up at the visible screen height and scroll the body inside it,
   * keeping the title (and its close button) on screen. Opt-in: an overflow
   * container clips any NON-portalled dropdown inside it, so it is switched on
   * per modal once its dropdowns are known to portal to <body> (TimeSelect and
   * LocationInput do). Without it a tall form runs off the top and bottom of
   * the screen (Nic's screenshot of Add trip, 2026-10-12).
   */
  scrollBody?: boolean
}

export function Modal({ isOpen, onClose, title, children, className, scrollBody = false }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    // z-[60]: overlays must layer above the BottomNav (z-50) — hard rule.
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-50 w-full max-w-md bg-paper rounded-card border border-line shadow-xl',
          // dvh, not vh: mobile Chrome's vh is the URL-bar-HIDDEN height (the
          // 2026-09-07 drawer lesson). 2rem = the wrapper's p-4 top + bottom.
          scrollBody && 'flex flex-col max-h-[calc(100dvh-2rem)]',
          className
        )}
      >
        {title && (
          <div className={cn('flex items-center justify-between px-6 pt-6 pb-4 border-b border-line', scrollBody && 'shrink-0')}>
            <h2 className="font-display text-lg font-medium text-ink">{title}</h2>
            <button
              onClick={onClose}
              className="text-muted hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className={cn(title ? 'p-6' : 'p-6', scrollBody && 'min-h-0 overflow-y-auto')}>
          {children}
        </div>
      </div>
    </div>
  )
}
