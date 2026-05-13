import { cn } from '@/lib/utils/cn'
import type { JobStatus, Role } from '@/lib/supabase/types'

type PillVariant = JobStatus | Role | 'overdue'

const styles: Record<PillVariant, string> = {
  scheduled:         'bg-brand-blue-soft  text-brand-blue',
  pending:           'bg-brand-amber-soft text-brand-amber',
  awaiting_approval: 'bg-brand-amber-soft text-brand-amber',
  completed:         'bg-brand-green-soft text-brand-green',
  overdue:           'bg-bad text-white',
  sales:             'bg-brand-blue-soft  text-brand-blue',
  scheduler:         'bg-brand-amber-soft text-brand-amber',
  installer:         'bg-brand-green-soft text-brand-green',
  admin:             'bg-terracotta/10 text-terracotta',
}

const label: Record<PillVariant, string> = {
  scheduled:         'scheduled',
  pending:           'Pending',
  awaiting_approval: 'awaiting approval',
  completed:         'Completed',
  overdue:           'Overdue',
  sales:             'Sales',
  scheduler:         'Scheduler',
  installer:         'Installer',
  admin:             'Admin',
}

interface PillProps {
  variant: PillVariant
  className?: string
}

export function Pill({ variant, className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        styles[variant],
        className
      )}
    >
      {label[variant]}
    </span>
  )
}
