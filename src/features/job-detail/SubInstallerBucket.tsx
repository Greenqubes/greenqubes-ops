'use client'

import { useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { t } from '@/lib/i18n'
import { InstallerGrid, type InstallerCardState } from './InstallerGrid'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'

interface Props {
  lang:        LangCode
  /** Full installer pool minus anyone already engaged on the MAIN grid. */
  installers:  InstallerUser[]
  /** How many sub-installers are currently picked (badge on the header). */
  subCount:    number
  stateOf:     (id: string) => InstallerCardState
  onToggle?:   (id: string) => void
  disabledOf?: (id: string) => boolean
  noteOf?:     (id: string) => string | null
  /** Clear every sub selection and collapse the bucket ("Remove"). */
  onClear?:    () => void
  /** Open on first render (a job that already has subs). */
  defaultOpen: boolean
  /** Read-only viewers (designer / production) see the bucket but no trigger. */
  canEdit:     boolean
}

// Sub-installer bucket under the main installer grid (Team card). Same pool,
// same card design, same amber-suggestion / green-confirmed rules as the main
// grid — hidden behind a dashed "+ Sub-installer" trigger until needed.
export function SubInstallerBucket({
  lang, installers, subCount, stateOf, onToggle, disabledOf, noteOf,
  onClear, defaultOpen, canEdit,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  if (!open) {
    if (!canEdit) return null
    return (
      <div className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-line bg-bg px-4 py-2 text-xs font-semibold text-ink2 hover:border-brand-green hover:text-ink transition-colors"
        >
          <Plus size={13} />
          {t(lang, 'subBucketAdd')}
        </button>
      </div>
    )
  }

  return (
    <div className="border-t border-line px-4 pt-3 pb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted flex items-center gap-1.5">
          <Users size={12} />
          {t(lang, 'subBucketTitle')}
          {subCount > 0 && (
            <span className="normal-case tracking-normal bg-line text-ink2 rounded-full px-1.5 py-px text-[10px] font-bold">
              {subCount}
            </span>
          )}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => { onClear?.(); setOpen(false) }}
            className="text-[11px] font-semibold text-terracotta"
          >
            {t(lang, 'subBucketRemove')}
          </button>
        )}
      </div>
      {installers.length === 0 ? (
        <p className="text-xs text-muted">{t(lang, 'subBucketAllOnMain')}</p>
      ) : (
        <InstallerGrid
          installers={installers}
          stateOf={stateOf}
          onToggle={onToggle}
          disabledOf={disabledOf}
          noteOf={noteOf}
        />
      )}
    </div>
  )
}
