'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Plus, X } from 'lucide-react'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { CompanyBar } from '@/components/CompanyBar'
import { JobFormLayout } from '@/features/job-detail/JobFormLayout'
import { CollapseCard } from '@/features/job-detail/CollapseCard'
import { AttachmentBuckets } from '@/features/job-detail/AttachmentBuckets'
import { AddJobPicker } from './AddJobPicker'
import { createClient as createBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { JobProject, ProjectJobRow, NestableJob } from '@/lib/supabase/queries/projects'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'
import type { LangCode } from '@/lib/i18n'
import type { Role, Punctuality } from '@/lib/supabase/types'

interface Props {
  mode:        'new' | 'edit'
  lang:        LangCode
  role:        Role
  userId:      string
  project?:    JobProject          // edit mode
  initialJobs?: ProjectJobRow[]    // edit mode
  modeSwitch?: ReactNode           // caller-supplied control rendered in the header (e.g. NewJobShell's "Multiple jobs" toggle, flipped on)
}

type Held = { id: string; title: string; reason: string }

// Same DD/MM/YYYY format the picker uses (AddJobPicker.tsx) — keep nested-row
// dates visually consistent with the picker's match list.
const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

function statusChipClass(status: string): string {
  if (status === 'pending')   return 'border-brand-amber bg-brand-amber-soft text-brand-amber'
  if (status === 'completed') return 'border-line bg-bg text-muted'
  return 'border-brand-green bg-brand-green-soft text-brand-green' // scheduled / awaiting_approval
}

// A row shape both ProjectJobRow (edit mode) and NestableJob (new mode's
// local picks) can be normalized into for rendering. NestableJob carries no
// timing/punctuality — those chips simply don't render for freshly-picked,
// not-yet-nested jobs.
type DisplayRow = {
  id: string
  title: string
  date: string
  date_end: string | null
  time_start: string | null
  time_end: string | null
  time_inherited: boolean
  punctuality: Punctuality | null
  status: string
}

export function ProjectFormShell({ mode, lang, role, userId, project, initialJobs = [], modeSwitch }: Props) {
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()

  // Round-1 fix (finding 5): spec says designer/production are read-only on
  // projects — only sales/scheduler/coordinator/admin manage them. This
  // shell is reachable directly at /projects/[id] by any office role, so the
  // gate lives here rather than relying on callers to keep read-only viewers
  // out. Files tab computes its own readOnly already (line below, unchanged).
  const canManage = (['sales', 'scheduler', 'coordinator', 'admin'] as Role[]).includes(role)

  // ── labels ──
  const [name,        setName]        = useState(project?.name ?? '')
  const [client,      setClient]      = useState(project?.client ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [timeStart,   setTimeStart]   = useState(project?.time_start ?? '')
  const [timeEnd,     setTimeEnd]     = useState(project?.time_end ?? '')
  const [defPunct,    setDefPunct]    = useState<Punctuality | null>(project?.default_punctuality ?? null)

  // ── nesting ──
  const [jobs,     setJobs]     = useState<ProjectJobRow[]>(initialJobs)   // edit mode source of truth
  const [picks,    setPicks]    = useState<NestableJob[]>([])              // new mode accumulator
  const [pickerOpen, setPickerOpen] = useState(false)

  // ── flows ──
  const [saving,      setSaving]      = useState(false)
  const [emptyOpen,   setEmptyOpen]   = useState(false)
  const [deleteOpen,  setDeleteOpen]  = useState(false)
  const [pushResult,  setPushResult]  = useState<{ pushed: number; total: number; held: Held[] } | null>(null)

  const nestedIds = useMemo(
    () => (mode === 'new' ? picks.map(p => p.id) : jobs.map(j => j.id)),
    [mode, picks, jobs],
  )

  const displayRows = useMemo<DisplayRow[]>(() => {
    if (mode === 'edit') {
      return jobs.map(j => ({
        id: j.id,
        title: j.project_title || j.client || 'Untitled job',
        date: j.date,
        date_end: j.date_end,
        time_start: j.time_start,
        time_end: j.time_end,
        time_inherited: j.time_inherited,
        punctuality: j.punctuality,
        status: j.status,
      }))
    }
    return picks.map(p => ({
      id: p.id,
      title: p.project_title || p.client || 'Untitled job',
      date: p.date,
      date_end: null,
      time_start: null,
      time_end: null,
      time_inherited: false,
      punctuality: null,
      status: p.status,
    }))
  }, [mode, jobs, picks])

  // Edit mode: re-fetch the project's jobs via the browser client — same
  // select column list as getProjectJobs (Task 5), which is server-only and
  // can't be imported into this client component.
  async function refreshJobs() {
    if (mode !== 'edit' || !project) return
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from('jobs')
        .select('id, status, date, date_end, time_start, time_end, time_inherited, project_title, client, location, punctuality, sales_poc_id, completed_at')
        .eq('project_id', project.id)
        .order('date', { ascending: true })
      if (error) throw error
      setJobs((data ?? []) as unknown as ProjectJobRow[])
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  async function handleNest(job: NestableJob) {
    if (mode === 'new') { setPicks(prev => [...prev, job]); return }
    try {
      const res = await fetch(`/api/projects/${project!.id}/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, action: 'nest' }),
      })
      if (!res.ok) throw new Error()
      await refreshJobs()
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  async function handleUnnest(jobId: string) {
    if (mode === 'new') { setPicks(prev => prev.filter(p => p.id !== jobId)); return }
    try {
      const res = await fetch(`/api/projects/${project!.id}/jobs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, action: 'unnest' }),
      })
      if (!res.ok) throw new Error()
      await refreshJobs()
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  async function handleSave() {
    setSaving(true)
    const labels = {
      name, client, description: description || null,
      time_start: timeStart || null, time_end: timeEnd || null,
      default_punctuality: defPunct,
    }
    try {
      if (mode === 'new') {
        const res = await fetch('/api/projects', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...labels, nestJobIds: picks.map(p => p.id) }),
        })
        if (!res.ok) throw new Error()
        const { id } = await res.json() as { id: string }
        router.push(`/projects/${id}`)
      } else {
        const res = await fetch(`/api/projects/${project!.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(labels),
        })
        if (!res.ok) throw new Error()
        showSuccess(t(lang, 'savedSuccessfully'))
        setSaving(false)
      }
    } catch {
      showError(t(lang, 'saveError'))
      setSaving(false)
    }
  }

  async function handleDelete() {
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project!.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.push('/schedule')
    } catch {
      showError(t(lang, 'saveError'))
      setSaving(false)
    }
  }

  // Edit mode only. Per-job clash checks run client-side (same GET the job
  // form itself uses) so held jobs never reach the push route; that route
  // then re-verifies ownership/status server-side and returns its own holds.
  async function handlePush() {
    const pending = jobs.filter(j => j.status === 'pending')
    if (jobs.length === 0) { setEmptyOpen(true); return }
    if (pending.length === 0) { showError(t(lang, 'jpEmptyTitle')); return }

    setSaving(true)
    const clean: string[] = []
    const held: Held[] = []
    for (const job of pending) {
      const res = await fetch(`/api/jobs/${job.id}/clashes`)
      if (!res.ok) { held.push({ id: job.id, title: job.project_title ?? job.client, reason: 'check failed' }); continue }
      const c: ClashesResponse = await res.json()
      if (c.clashes.length || c.softClashes.length || c.travelWarnings.length) {
        const first = c.clashes[0] ?? c.softClashes[0] ?? c.travelWarnings[0]
        held.push({ id: job.id, title: job.project_title ?? job.client, reason: `Clash: ${first.installer.name}` })
      } else {
        clean.push(job.id)
      }
    }

    let pushedCount = 0
    if (clean.length) {
      const res = await fetch(`/api/projects/${project!.id}/push`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: clean }),
      })
      if (res.ok) {
        const out = await res.json() as { pushed: string[]; held: { id: string; reason: string }[] }
        pushedCount = out.pushed.length
        for (const h of out.held) {
          const heldJob = jobs.find(j => j.id === h.id)
          held.push({
            id: h.id,
            title: heldJob?.project_title ?? heldJob?.client ?? '',
            reason: h.reason === 'not-yours' ? t(lang, 'jpHeldNotYours') : h.reason,
          })
        }
      } else {
        showError(t(lang, 'saveError'))
        setSaving(false)
        return
      }
    }

    setPushResult({ pushed: pushedCount, total: pending.length, held })
    await refreshJobs()
    setSaving(false)
  }

  const punctOptions: { v: Punctuality | null; label: string; activeCls: string; dot?: string }[] = [
    { v: null,        label: 'Not set',   activeCls: 'border-ink2 bg-bg text-ink' },
    { v: 'strict',    label: 'Strict',    activeCls: 'border-punct-strict bg-punct-strict-soft text-ink', dot: 'bg-punct-strict' },
    { v: 'flexible',  label: 'Flexible',  activeCls: 'border-punct-flex bg-punct-flex-soft text-ink',     dot: 'bg-punct-flex' },
  ]

  return (
    <div className="min-h-screen bg-bg pb-28">
      <CompanyBar lang={lang} />

      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-5 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/schedule" className="text-ink2 hover:text-ink shrink-0">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="font-display text-xl font-semibold text-ink">
              {mode === 'new' ? t(lang, 'jpTitle') : 'Edit project'}
            </h1>
          </div>
          {modeSwitch}
        </div>
      </div>

      <JobFormLayout
        lang={lang}
        lockedTabs={['team', 'chat']}
        details={
          <div className="flex flex-col gap-4">
            <CollapseCard title={t(lang, 'jobDetails')} storageKey="gq-projectcard-details">
              <div className="space-y-3">
                <Field label={t(lang, 'projectTitle')}>
                  <Input value={name} onChange={e => setName(e.target.value)} disabled={!canManage} />
                </Field>
                <Field label={t(lang, 'client')}>
                  <Input value={client} onChange={e => setClient(e.target.value)} disabled={!canManage} />
                </Field>
                <Field label={t(lang, 'jobDescription')}>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={2}
                    disabled={!canManage}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t(lang, 'timeStart')}>
                    <Input type="time" value={timeStart ? timeStart.slice(0, 5) : ''} onChange={e => setTimeStart(e.target.value)} disabled={!canManage} />
                  </Field>
                  <Field label={t(lang, 'timeEnd')}>
                    <Input type="time" value={timeEnd ? timeEnd.slice(0, 5) : ''} onChange={e => setTimeEnd(e.target.value)} disabled={!canManage} />
                  </Field>
                </div>
                <p className="text-xs text-muted -mt-1.5">{t(lang, 'jpTimingHint')}</p>

                <Field label={t(lang, 'jpDefaultPunctuality')} hint={t(lang, 'jpDefaultPunctualityHint')}>
                  <div className="flex gap-2">
                    {punctOptions.map(opt => (
                      <button
                        key={opt.label}
                        type="button"
                        disabled={!canManage}
                        onClick={() => setDefPunct(opt.v)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          defPunct === opt.v ? opt.activeCls : 'border-line bg-paper text-ink2 hover:bg-bg',
                        )}
                      >
                        {opt.dot && <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', opt.dot)} />}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </CollapseCard>

            <CollapseCard title={t(lang, 'jpSwitchLabel')} storageKey="gq-projectcard-jobs">
              <div className="space-y-3">
                <p className="text-xs text-muted -mt-1">{t(lang, 'jpSwitchHint')}</p>

                {displayRows.map(row => (
                  <div key={row.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-ink">{row.title}</p>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleUnnest(row.id)}
                          aria-label={t(lang, 'jpRemoveFromProject')}
                          className="shrink-0 p-1 text-muted hover:text-ink transition-colors"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="inline-flex items-center rounded-full border border-line bg-bg px-2.5 py-1 text-[11px] font-medium text-ink2">
                        {row.date_end && row.date_end !== row.date ? `${fmtDate(row.date)} – ${fmtDate(row.date_end)}` : fmtDate(row.date)}
                      </span>
                      {row.time_inherited ? (
                        <span className="inline-flex items-center rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] font-medium text-muted">
                          project timing
                        </span>
                      ) : (row.time_start || row.time_end) ? (
                        <span className="inline-flex items-center rounded-full border border-line bg-bg px-2.5 py-1 text-[11px] font-medium text-ink2">
                          {[row.time_start, row.time_end].filter(Boolean).map(s => s!.slice(0, 5)).join(' – ')} · own time
                        </span>
                      ) : null}
                      {row.punctuality && (
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
                          row.punctuality === 'strict'
                            ? 'border-punct-strict bg-punct-strict-soft text-punct-strict'
                            : 'border-punct-flex bg-punct-flex-soft text-punct-flex',
                        )}>
                          {row.punctuality === 'strict' ? 'Strict' : 'Flexible'}
                        </span>
                      )}
                      <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize', statusChipClass(row.status))}>
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}

                {canManage && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-2.5 text-sm font-medium text-ink2 hover:border-ink2 transition-colors"
                  >
                    <Plus size={14} />
                    {t(lang, 'jpAddJob')}
                  </button>
                )}
              </div>
            </CollapseCard>
          </div>
        }
        team={
          <Card className="p-5 space-y-3 opacity-60 pointer-events-none select-none">
            <h3 className="text-sm font-medium text-ink">{t(lang, 'tabTeam')}</h3>
            <div className="flex items-center justify-center gap-2 py-6 text-muted text-sm">
              <Lock size={14} />
              {t(lang, 'jpNoTeamChat')}
            </div>
          </Card>
        }
        files={
          mode === 'edit' ? (
            <Card className="p-5">
              <AttachmentBuckets projectId={project!.id} userId={userId} lang={lang} readOnly={!['sales','scheduler','coordinator','admin'].includes(role)} />
            </Card>
          ) : (
            <Card className="p-5 space-y-2 opacity-60 pointer-events-none select-none">
              <h3 className="text-sm font-medium text-ink">{t(lang, 'tabFiles')}</h3>
              <div className="flex items-center gap-2 py-4 text-muted text-sm justify-center">
                <Lock size={14} />
                {t(lang, 'jpSaveFirstFiles')}
              </div>
            </Card>
          )
        }
        chat={
          <Card className="p-5 space-y-3 opacity-60 pointer-events-none select-none">
            <h3 className="text-sm font-medium text-ink">{t(lang, 'tabChat')}</h3>
            <div className="flex items-center justify-center gap-2 py-6 text-muted text-sm">
              <Lock size={14} />
              {t(lang, 'jpNoTeamChat')}
            </div>
          </Card>
        }
      />

      {/* ── Action bar (sticky bottom, same chrome as NewJobShell) ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line px-4 py-3 z-10">
        <div className="max-w-2xl lg:max-w-6xl mx-auto flex gap-2">
          {!canManage ? (
            // Round-1 fix (finding 5): designer/production are read-only on
            // projects — no Save/Push/Delete for them, just a note.
            <div className="flex-1 flex items-center justify-center px-4 py-3 rounded-[10px] border border-line bg-bg text-sm text-muted">
              View only — ask sales, scheduler, coordinator or admin to make changes.
            </div>
          ) : mode === 'new' ? (
            <>
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="flex items-center justify-center px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg disabled:opacity-50 transition-colors"
              >
                {t(lang, 'cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t(lang, 'jpSaveProject')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={saving}
                className="flex items-center justify-center px-3 py-2 rounded-[10px] border border-terracotta bg-terracotta-soft text-xs font-medium text-terracotta hover:brightness-95 disabled:opacity-50 transition-colors"
              >
                {t(lang, 'jpDeleteProject')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border border-line bg-paper text-sm font-semibold text-ink2 hover:bg-bg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t(lang, 'jpSaveProject')}
              </button>
              <button
                type="button"
                onClick={handlePush}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t(lang, 'jpPushToSchedule')}
              </button>
            </>
          )}
        </div>
      </div>

      <AddJobPicker
        open={canManage && pickerOpen}
        projectName={name}
        client={client}
        lang={lang}
        callerRole={role}
        callerId={userId}
        nestedIds={nestedIds}
        onNest={handleNest}
        onNewJobHere={mode === 'new' ? null : () => router.push(`/jobs/new?project=${project!.id}`)}
        onClose={() => setPickerOpen(false)}
      />

      {/* Empty-project prompt — pushing with zero nested jobs at all */}
      <Modal isOpen={emptyOpen} onClose={() => setEmptyOpen(false)}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">{t(lang, 'jpEmptyTitle')}</p>
          <p className="text-sm text-muted">{t(lang, 'jpEmptyBody')}</p>
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" className="flex-1" onClick={() => setEmptyOpen(false)}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn variant="accent" size="sm" className="flex-1" onClick={() => { setEmptyOpen(false); setPickerOpen(true) }}>
              {t(lang, 'jpAddJob')}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal isOpen={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">{t(lang, 'jpDeleteProject')}</p>
          <p className="text-sm text-muted">{t(lang, 'jpDeleteConfirm')}</p>
          <div className="flex gap-2">
            <Btn variant="secondary" size="sm" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={saving}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn variant="accent" size="sm" className="flex-1" onClick={handleDelete} disabled={saving}>
              {t(lang, 'jpDeleteProject')}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Push-result sheet — bottom sheet chrome matches AddJobPicker's */}
      {pushResult && (
        <div className="fixed inset-0 z-[60] flex items-end bg-ink/40" onClick={() => setPushResult(null)}>
          <div
            className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-paper p-4 pb-6"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Push result"
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
            <div className="flex items-baseline gap-2 mb-1">
              <span className="font-display text-2xl font-medium text-brand-green tabular-nums">
                {pushResult.pushed} / {pushResult.total}
              </span>
            </div>
            <p className="text-sm text-ink2 mb-3">{t(lang, 'jpPushedCount')}</p>

            {pushResult.held.length > 0 && (
              <>
                <p className="text-xs font-semibold text-brand-amber mb-1">
                  {pushResult.held.length} {t(lang, 'jpHeldCount')}
                </p>
                {pushResult.held.map(h => (
                  <div key={h.id} className="flex items-center justify-between gap-2 border-b border-line py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{h.title || 'Untitled job'}</p>
                      <p className="text-[11px] text-brand-amber">{h.reason}</p>
                    </div>
                    <Link
                      href={`/jobs/${h.id}`}
                      className="shrink-0 rounded-full border border-line bg-bg px-3 py-1 text-xs font-medium text-ink2 hover:bg-line/40 transition-colors"
                    >
                      Open
                    </Link>
                  </div>
                ))}
              </>
            )}

            <Btn variant="secondary" size="sm" className="mt-3 w-full" onClick={() => setPushResult(null)}>
              Done
            </Btn>
          </div>
        </div>
      )}
    </div>
  )
}
