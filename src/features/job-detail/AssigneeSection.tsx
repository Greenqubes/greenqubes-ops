'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { X } from 'lucide-react'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { Role } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'

interface Props {
  jobId:             string
  role:              Role
  lang:              LangCode
  assignees:         InstallerUser[]
  allInstallers:     InstallerUser[]
  onAssigneesChange: (next: InstallerUser[]) => void
  readOnly?:         boolean
}

export function AssigneeSection({ jobId, role, lang, assignees, allInstallers, onAssigneesChange, readOnly = false }: Props) {
  const { error: showError } = useToast()
  const supabase = createClient()
  const [adding, setAdding] = useState(false)

  const assignedIds = new Set(assignees.map(a => a.id))
  const available   = allInstallers.filter(i => !assignedIds.has(i.id))

  const handleAdd = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value
    if (!userId) return
    const installer = allInstallers.find(i => i.id === userId)
    if (!installer) return

    setAdding(true)
    try {
      await supabase
        .from('job_assignees')
        .insert({ job_id: jobId, user_id: userId } as never)
        .throwOnError()
      onAssigneesChange([...assignees, installer])
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setAdding(false)
      e.target.value = ''
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      await supabase
        .from('job_assignees')
        .delete()
        .eq('job_id', jobId)
        .eq('user_id', userId)
        .throwOnError()
      onAssigneesChange(assignees.filter(a => a.id !== userId))
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const canEdit = role === 'scheduler' && !readOnly

  return (
    <Card className="p-5 space-y-3">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'assignees')}</h3>

      {assignees.length === 0 ? (
        <p className="text-sm text-muted">{t(lang, 'noAssignees')}</p>
      ) : (
        <ul className="space-y-2">
          {assignees.map(a => (
            <li key={a.id} className="flex items-center justify-between text-sm">
              <span className="text-ink">{a.name}</span>
              {a.phone && <span className="text-muted text-xs">{a.phone}</span>}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(a.id)}
                  className="ml-2 text-muted hover:text-terracotta transition-colors"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && available.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <select
            onChange={handleAdd}
            disabled={adding}
            defaultValue=""
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50"
          >
            <option value="" disabled>{t(lang, 'selectInstaller')}</option>
            {available.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
      )}
    </Card>
  )
}
