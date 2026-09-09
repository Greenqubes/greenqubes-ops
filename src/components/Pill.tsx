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
  designer:          'bg-brand-blue-soft  text-brand-blue',
  coordinator:       'bg-brand-amber-soft text-brand-amber',
  production:        'bg-brand-green-soft text-brand-green',
  hr:                'bg-terracotta/10 text-terracotta',
}

const label: Record<PillVariant, string> = {
  scheduled:         'Scheduled',
  pending:           'Pending',
  awaiting_approval: 'Awaiting Approval',
  completed:         'Completed',
  overdue:           'Overdue',
  sales:             'Sales',
  scheduler:         'Scheduler',
  installer:         'Installer',
  admin:             'Admin',
  designer:          'Designer',
  coordinator:       'Coordinator',
  production:        'Production',
  hr:                'HR / Finance',
}

// Role display name. 'hr' must never render as auto-capitalised "Hr" — the
// four inline `charAt(0).toUpperCase()` calls in UsersTab all route here now.
export function roleLabel(r: string): string {
  if (r === 'hr') return 'HR / Finance'
  return r.charAt(0).toUpperCase() + r.slice(1)
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
