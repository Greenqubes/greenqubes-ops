import { cn } from '@/lib/utils/cn'
import type { JobStatus, Role } from '@/lib/supabase/types'

type PillVariant = JobStatus | Role | 'overdue'

const styles: Record<PillVariant, string> = {
  scheduled:         'bg-brand-blue-soft  text-brand-blue',
  pending:           'bg-brand-amber-soft text-brand-amber',
  awaiting_approval: 'bg-brand-amber-soft text-brand-amber',
  completed:         'bg-brand-green-soft text-brand-green',
  overdue:           'bg-terracotta-soft  text-terracotta',
  sales:             'bg-brand-blue-soft  text-brand-blue',
  scheduler:         'bg-brand-amber-soft text-brand-amber',
  installer:         'bg-brand-green-soft text-brand-green',
}

const label: Record<PillVariant, string> = {
  scheduled:         'scheduled',
  pending:           'pending',
  awaiting_approval: 'awaiting approval',
  completed:         'completed',
  overdue:           'overdue',
  sales:             'sales',
  scheduler:         'scheduler',
  installer:         'installer',
}

interface PillProps {
  variant: PillVariant
  className?: string
}

export function Pill({ variant, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium lowercase',
        styles[variant],
        className
      )}
    >
      {label[variant]}
    </span>
  )
}
