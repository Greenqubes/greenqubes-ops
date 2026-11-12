'use client'

import { useEffect, useState } from 'react'
import { Folder } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { t as tr, type LangCode } from '@/lib/i18n'
import { GROUP_NAME_MAX, type JobGroup } from '@/lib/utils/job-groups'

export type GroupDialogMode = 'create' | 'add' | 'rename' | 'ungroup'

const BTN = 'px-4 py-2 text-sm rounded-lg font-semibold disabled:opacity-50'

/**
 * The Jobs tab group dialog (Nic, 2026-11-11; approved mockup "Make a
 * group"). On the shared Modal (z-[60], above the bottom nav).
 *  - create:  name pre-filled from the shared start of the titles, or pick an
 *             existing group instead;
 *  - add:     pick an existing group;
 *  - rename:  a new name;
 *  - ungroup: one confirm — regrouping 20 jobs by hand is the cost of a slip.
 */
export function GroupDialog({ mode, count, initialName, existing, busy, lang, onClose, onCreate, onAdd, onRename, onUngroup }: {
  /** null = closed. */
  mode:        GroupDialogMode | null
  count:       number
  initialName: string
  existing:    Array<JobGroup & { count: number }>
  busy:        boolean
  lang:        LangCode
  onClose:     () => void
  onCreate:    (name: string) => void
  onAdd:       (groupId: string) => void
  onRename:    (name: string) => void
  onUngroup:   () => void
}) {
  const [name, setName] = useState(initialName)
  useEffect(() => { if (mode) setName(initialName) }, [mode, initialName])
  const n = String(count)
  const title = mode === 'create' ? tr(lang, 'groupCreateTitle').replace('{n}', n)
    : mode === 'add' ? tr(lang, 'groupAddTitle').replace('{n}', n)
    : mode === 'rename' ? tr(lang, 'groupRenameTitle')
    : tr(lang, 'groupUngroupTitle')
  const named = name.trim().length > 0

  const picker = existing.length > 0 && (
    <ul className="space-y-1.5">
      {existing.map(g => (
        <li key={g.id}>
          <button type="button" disabled={busy} onClick={() => onAdd(g.id)}
            className="flex w-full items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-left text-sm hover:bg-bg disabled:opacity-50">
            <Folder size={14} className="shrink-0 text-brand-green" />
            <span className="flex-1 min-w-0 truncate text-ink">{g.name}</span>
            <span className="shrink-0 text-xs text-muted">{tr(lang, 'groupJobsCount').replace('{n}', String(g.count))}</span>
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <Modal isOpen={mode !== null} onClose={onClose} title={title} scrollBody>
      <form className="space-y-4" onSubmit={e => {
        e.preventDefault()
        if (busy) return
        if (mode === 'create' && named) onCreate(name.trim())
        if (mode === 'rename' && named) onRename(name.trim())
        if (mode === 'ungroup') onUngroup()
      }}>
        {(mode === 'create' || mode === 'rename') && (
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink2">{tr(lang, 'groupNameLabel')}</span>
            <input autoFocus value={name} maxLength={GROUP_NAME_MAX} onChange={e => setName(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand-green" />
            {mode === 'create' && <span className="block text-[11px] text-muted">{tr(lang, 'groupNameHint')}</span>}
          </label>
        )}
        {mode === 'create' && picker && (
          <div className="space-y-2">
            <p className="text-xs text-muted">{tr(lang, 'groupOrExisting')}</p>
            {picker}
          </div>
        )}
        {mode === 'add' && picker}
        {mode === 'ungroup' && <p className="text-sm text-ink2">{tr(lang, 'groupUngroupBody').replace('{n}', n)}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BTN} border border-line text-ink2`}>{tr(lang, 'groupCancel')}</button>
          {mode === 'create' && <button type="submit" disabled={busy || !named} className={`${BTN} bg-brand-green text-white`}>{tr(lang, 'groupAction')}</button>}
          {mode === 'rename' && <button type="submit" disabled={busy || !named} className={`${BTN} bg-brand-green text-white`}>{tr(lang, 'groupSave')}</button>}
          {mode === 'ungroup' && <button type="submit" disabled={busy} className={`${BTN} bg-bad text-white`}>{tr(lang, 'groupUngroup')}</button>}
        </div>
      </form>
    </Modal>
  )
}
