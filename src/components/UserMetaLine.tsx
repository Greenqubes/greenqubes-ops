'use client'

import { cn } from '@/lib/utils/cn'
import { buildUserMeta, type LinkStatus } from '@/lib/utils/user-meta'

// Small colored link-status dot beside a name (Nic 2026-09-04: dots, not text
// tags — "too cluttered"). Words live in the tooltip only.
export function LinkDot({ status }: { status: LinkStatus }) {
  return (
    <span
      title={status === 'linked' ? 'Linked' : status === 'pending' ? 'Unlinked — waiting for sign-in' : 'Unlinked — no email yet'}
      className={cn(
        'inline-block w-2 h-2 rounded-full shrink-0',
        status === 'linked' ? 'bg-brand-green' : status === 'pending' ? 'bg-brand-amber' : 'bg-bad',
      )}
    />
  )
}

// Driver chip — always sits right beside the name.
export function DriverChip({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-medium bg-brand-blue/10 text-brand-blue border border-brand-blue/20 rounded-full px-1.5 py-px shrink-0">
      {label}
    </span>
  )
}

// Chip rows under the name: subrole chip, then qualification chips on their
// own row (Nic's card layout, 2026-09-04). Falls back to the role name as the
// subrole chip when a caller passes `role` and no subrole is set.
export function UserMetaLine({ user, chipClass = 'text-muted bg-bg border-line' }: {
  user: { role?: string | null; subrole?: string | null; qualifications?: string[] | null }
  /** color classes for the chips — grids tint by card state */
  chipClass?: string
}) {
  const meta = buildUserMeta(user)
  if (!meta.subroleLine && meta.qualifications.length === 0) return null
  return (
    <div className="min-w-0 mt-0.5 flex flex-col gap-0.5">
      {meta.subroleLine && (
        <span className={cn('self-start text-[10px] border rounded-full px-1.5 py-px truncate max-w-full', chipClass)}>
          {meta.subroleLine}
        </span>
      )}
      {meta.qualifications.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meta.qualifications.map(q => (
            <span key={q} className={cn('text-[10px] border rounded-full px-1.5 py-px', chipClass)}>{q}</span>
          ))}
        </div>
      )}
    </div>
  )
}
