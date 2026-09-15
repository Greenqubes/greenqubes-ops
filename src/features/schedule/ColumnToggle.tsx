'use client'

import { cn } from '@/lib/utils/cn'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

export type ListColumns = 1 | 2 | 3

/**
 * How many job cards sit side by side in the list (Nic, 2026-09-15).
 *
 * Capping the card's width (feedback item 1) leaves spare room on a wide
 * monitor — the scheduler's is 32" — so the list can show two or three jobs
 * at once instead of one very wide one. The choice is the person's, not the
 * screen's: `ListView` only narrows it when the window cannot carry it, so a
 * laptop never gets three no matter what is picked here.
 *
 * Hidden below `lg`, where there is only ever one column to choose.
 */

/** n columns of three stacked bars — reads as "how many lists across". */
function ColumnsIcon({ n }: { n: ListColumns }) {
  const gap   = 1.5
  const width = (14 - gap * (n - 1)) / n
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {Array.from({ length: n }).map((_, col) =>
        [0, 5, 10].map(y => (
          <rect
            key={`${col}-${y}`}
            x={col * (width + gap)}
            y={y}
            width={width}
            height="3"
            rx="1"
            fill="currentColor"
          />
        )),
      )}
    </svg>
  )
}

interface Props {
  value:    ListColumns
  onChange: (value: ListColumns) => void
  lang:     LangCode
}

export function ColumnToggle({ value, onChange, lang }: Props) {
  const options: ListColumns[] = [1, 2, 3]
  const label = (n: ListColumns) =>
    n === 1 ? t(lang, 'oneColumn') : n === 2 ? t(lang, 'twoColumns') : t(lang, 'threeColumns')

  return (
    <div
      className="hidden lg:flex bg-paper border border-line rounded-lg p-0.5 shrink-0"
      role="group"
      aria-label={t(lang, 'columnsLabel')}
    >
      {options.map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          title={label(n)}
          aria-label={label(n)}
          aria-pressed={value === n}
          className={cn(
            'flex items-center justify-center px-2.5 py-1.5 rounded-md transition-colors',
            value === n ? 'bg-ink text-paper' : 'text-muted hover:text-ink',
          )}
        >
          <ColumnsIcon n={n} />
        </button>
      ))}
    </div>
  )
}
