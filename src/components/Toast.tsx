'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type ToastVariant = 'success' | 'warning' | 'error'

interface ToastItem {
  id:      string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  success: (message: string) => void
  warning: (message: string) => void
  error:   (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION_MS = 4000

const variantStyles: Record<ToastVariant, string> = {
  success: 'bg-brand-green-soft text-brand-green',
  warning: 'bg-brand-amber-soft text-brand-amber',
  error:   'bg-terracotta-soft  text-terracotta',
}

function ToastBubble({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        'w-full rounded-card border border-line px-4 py-3 text-sm font-medium',
        'shadow-md pointer-events-auto',
        variantStyles[item.variant]
      )}
    >
      <span>{item.message}</span>
      <button
        onClick={() => onDismiss(item.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const add = useCallback((message: string, variant: ToastVariant) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => remove(id), DURATION_MS)
  }, [remove])

  const ctx: ToastContextValue = {
    success: (m) => add(m, 'success'),
    warning: (m) => add(m, 'warning'),
    error:   (m) => add(m, 'error'),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4"
      >
        {toasts.map(item => (
          <ToastBubble key={item.id} item={item} onDismiss={remove} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
