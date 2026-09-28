'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Pill } from '@/components/Pill'
import { Modal } from '@/components/Modal'
import { CompanyBar } from '@/components/CompanyBar'
import { BottomNav } from '@/components/BottomNav'
import { useToast } from '@/components/Toast'
import { t } from '@/lib/i18n'
import { fmtDate } from '@/features/leave/format'
import type { LangCode } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'

// Deleted jobs, restorable until the bin empties (Nic, 2026-09-28). What each
// person sees and may restore is decided by /api/bin (bin-rules.ts) — this
// page only draws it.

type Entry = {
  id: string; jobId: string; title: string | null; client: string | null; jobDate: string | null
  status: string; deletedByName: string; deletedAt: string; emptiesOn: string
  canRestore: boolean; restoreHint: string | null
}

type Props = { lang: LangCode; isAdmin: boolean; role: Role; navRole: Role }

const PILL_STATUSES = ['pending', 'awaiting_approval', 'scheduled', 'completed'] as const
type PillStatus = typeof PILL_STATUSES[number]

/** '2026-09-28T02:05:00Z' → '28 Sep 2026, 10:05' in Singapore time, English. */
function fmtWhen(iso: string): string {
  const sgt = new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString()
  return `${fmtDate(sgt.slice(0, 10))}, ${sgt.slice(11, 16)}`
}

/** The restored job's clashes as plain lines, or none. */
function clashLines(c: ClashesResponse): string[] {
  const hh = (x: string | null) => (x ?? '').slice(0, 5)
  return [
    ...[...c.clashes, ...c.softClashes].map(x =>
      `${x.installer.name} — also on ${x.conflictingJob.client} ${hh(x.conflictingJob.timeStart)}–${hh(x.conflictingJob.timeEnd)}`),
    ...c.travelWarnings.map(x => `${x.installer.name} — tight travel from ${x.conflictingJob.client}`),
    ...c.leaveClashes.map(x => `${x.person.name} — on leave ${x.dates}`),
  ]
}

export function BinShell({ lang, isAdmin, role, navRole }: Props) {
  const router = useRouter()
  const { success: showSuccess, error: showError } = useToast()
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [busyId, setBusyId]   = useState<string | null>(null)
  const [purgeId, setPurgeId] = useState<string | null>(null)
  const [clash, setClash]     = useState<{ jobId: string; lines: string[] } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/bin')
    if (!res.ok) { showError(t(lang, 'saveError')); setEntries([]); return }
    const j = await res.json() as { entries: Entry[] }
    setEntries(j.entries)
  }, [lang, showError])

  useEffect(() => { void load() }, [load])

  async function restore(e: Entry) {
    setBusyId(e.id)
    try {
      const res = await fetch(`/api/bin/${e.id}/restore`, { method: 'POST' })
      const j = await res.json().catch(() => ({})) as { jobId?: string; status?: string; leftOff?: string[]; error?: string }
      if (!res.ok || !j.jobId) { showError(j.error ?? t(lang, 'saveError')); return }
      setEntries(prev => (prev ?? []).filter(x => x.id !== e.id))
      if (j.leftOff?.length) showSuccess(t(lang, 'binLeftOff').replace('{names}', j.leftOff.join(', ')))

      // The clash check runs just AFTER the restore (Nic approved, 2026-09-28):
      // the check only works on a job that exists, and a fifth copy of the
      // overlap rule written for snapshots is how copies drift apart. "Put it
      // back in the bin" is one tap away, so the decision is the same.
      if (j.status === 'scheduled') {
        const cr = await fetch(`/api/jobs/${j.jobId}/clashes`)
        if (cr.ok) {
          const lines = clashLines(await cr.json() as ClashesResponse)
          if (lines.length) { setClash({ jobId: j.jobId, lines }); return }
        }
      }
      showSuccess(t(lang, 'binRestored'))
      router.push(`/jobs/${j.jobId}`)
    } finally {
      setBusyId(null)
    }
  }

  async function backToBin(jobId: string) {
    const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
    if (!res.ok) { showError(t(lang, 'saveError')); return }
    setClash(null)
    await load()
  }

  async function purge(id: string) {
    setBusyId(id)
    try {
      const res = await fetch(`/api/bin/${id}`, { method: 'DELETE' })
      if (!res.ok) { showError(t(lang, 'saveError')); return }
      setEntries(prev => (prev ?? []).filter(x => x.id !== id))
      setPurgeId(null)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-24 lg:pb-28">
      <CompanyBar lang={lang} role={role} navRole={navRole} />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="mb-4">
          <h1 className="font-display text-xl font-semibold text-ink">{t(lang, 'binTitle')}</h1>
          <p className="text-[11px] text-muted mt-0.5">{t(lang, 'binSubtitle')}</p>
        </div>

        {entries === null && <p className="text-sm text-muted">{t(lang, 'loading')}</p>}
        {entries?.length === 0 && <p className="text-sm text-muted">{t(lang, 'binEmpty')}</p>}

        <div className="flex flex-col gap-3">
          {entries?.map(e => (
            <Card key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink break-words">{e.title || 'Untitled'}</p>
                  <p className="text-xs text-ink2 mt-0.5">
                    {e.client ?? '—'}{e.jobDate ? ` · ${fmtDate(e.jobDate)}` : ''}
                  </p>
                </div>
                {(PILL_STATUSES as readonly string[]).includes(e.status) && <Pill variant={e.status as PillStatus} />}
              </div>
              <p className="text-[11px] text-muted mt-2">
                {t(lang, 'binDeletedBy').replace('{name}', e.deletedByName).replace('{when}', fmtWhen(e.deletedAt))}
              </p>
              <p className="text-[11px] text-muted">{t(lang, 'binEmptiesOn').replace('{date}', fmtDate(e.emptiesOn))}</p>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                {e.canRestore ? (
                  <Btn size="sm" onClick={() => restore(e)} disabled={busyId !== null}>
                    {busyId === e.id ? t(lang, 'loading') : t(lang, 'binRestore')}
                  </Btn>
                ) : e.restoreHint ? (
                  <p className="text-xs text-muted">{e.restoreHint}</p>
                ) : null}
                {isAdmin && (
                  <Btn size="sm" variant="secondary" onClick={() => setPurgeId(e.id)} disabled={busyId !== null}>
                    {t(lang, 'binDeleteForever')}
                  </Btn>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Modal isOpen={purgeId !== null} onClose={() => setPurgeId(null)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">{t(lang, 'binDeleteForever')}</h2>
          <p className="text-sm text-muted">{t(lang, 'binDeleteForeverConfirm')}</p>
          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => setPurgeId(null)} disabled={busyId !== null}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn size="sm" onClick={() => purgeId && purge(purgeId)} disabled={busyId !== null}>
              {busyId ? t(lang, 'loading') : t(lang, 'binDeleteForever')}
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal isOpen={clash !== null} onClose={() => clash && router.push(`/jobs/${clash.jobId}`)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">{t(lang, 'binClashTitle')}</h2>
          <ul className="text-sm text-ink2 space-y-1">
            {clash?.lines.map(l => <li key={l}>{l}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => clash && backToBin(clash.jobId)}>
              {t(lang, 'binClashBackToBin')}
            </Btn>
            <Btn size="sm" onClick={() => clash && router.push(`/jobs/${clash.jobId}`)}>
              {t(lang, 'binClashKeep')}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Callers own the hidden lg:block wrapper — see BottomNav's own note. */}
      <div className="hidden lg:block"><BottomNav role={navRole} /></div>
    </div>
  )
}
