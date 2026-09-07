'use client'

import { cn } from '@/lib/utils/cn'

interface Props {
  roles:    string[]
  value:    string
  onChange: (role: string) => void
}

/**
 * Compact one-line role filter for the job form's people pickers (Nic,
 * 2026-09-07) — Person-in-Charge and Sub POC / Coordinators both list every
 * non-installer in the company, which is a long scroll.
 *
 * A native <select> on purpose, matching the subrole filter in Admin > Users:
 * it holds every role on one line however many there are (pills would wrap to
 * two or three rows and eat most of the 224px-tall dropdown), and on a phone it
 * opens the OS picker instead of a cramped in-page menu.
 *
 * Renders nothing when the options carry no roles, which is what keeps the
 * client-name and external-contact pickers exactly as they were.
 */
export function RoleFilter({ roles, value, onChange }: Props) {
  if (roles.length === 0) return null

  return (
    <div className="px-3 py-2 border-b border-line shrink-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onClick={e => e.stopPropagation()}
        aria-label="Filter by role"
        className={cn(
          'w-full border rounded-lg px-2 py-1 text-xs bg-bg focus:outline-none cursor-pointer',
          value === 'all'
            ? 'border-line text-ink2'
            : 'border-terracotta text-terracotta font-medium',
        )}
      >
        <option value="all">All roles</option>
        {roles.map(r => (
          <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
        ))}
      </select>
    </div>
  )
}
