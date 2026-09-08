import { CalendarDays, UserMinus } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// Public holiday and who-is-away banners for one day.
//
// Deliberately prominent, not a footnote (Nic, 2026-09-08): the office shows
// everyone who is on leave and every public holiday, so these read as real
// notices at the top of the day rather than small grey text. Shown to EVERY
// role, installers included — it is ordinary team information.
//
// The REASON for an absence never appears here. This component is only ever
// given names, and the query behind it does not select the details table.

interface Props {
  /** Names away that day. Already de-duplicated by the caller. */
  leaveNames?: string[]
  /** Public holiday name for that day, if any. */
  holiday?:    string
  /** Translated "On leave" label. */
  onLeaveLabel?: string
  /** Translated "Public holiday" label. */
  holidayLabel?: string
  className?:  string
}

export function DayNotices({
  leaveNames = [], holiday, onLeaveLabel = 'On leave', holidayLabel = 'Public holiday', className,
}: Props) {
  if (!holiday && leaveNames.length === 0) return null

  return (
    <div className={cn('flex flex-col gap-2 mb-3', className)}>
      {holiday && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-brand-green/30 bg-brand-green-soft px-3 py-2.5">
          <CalendarDays size={16} className="text-brand-green shrink-0" strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-green/80 leading-none">
              {holidayLabel}
            </p>
            <p className="text-sm font-semibold text-brand-green mt-1 truncate">{holiday}</p>
          </div>
        </div>
      )}

      {leaveNames.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-brand-blue/30 bg-brand-blue-soft px-3 py-2.5">
          <UserMinus size={16} className="text-brand-blue shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-blue/80 leading-none">
              {onLeaveLabel}
            </p>
            <p className="text-sm font-semibold text-ink mt-1">{leaveNames.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
