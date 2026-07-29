'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Btn } from '@/components/Btn'
import { Pill } from '@/components/Pill'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { SearchableSelect, SelectOption } from '@/components/SearchableSelect'
import { MultiUserSelect } from '@/components/MultiUserSelect'
import { SuggestField } from '@/components/SuggestField'
import { CoreSection } from './CoreSection'
import { AttachmentBuckets } from './AttachmentBuckets'
import { ChatSection } from './ChatSection'
import { ProductionReadySection } from './ProductionReadySection'
import { InstallerGrid, type InstallerCardState } from './InstallerGrid'
import { SubInstallerBucket } from './SubInstallerBucket'
import { TaskListSection } from './TaskListSection'
import { ExternalPOCBucket } from './ExternalPOCBucket'
import { ClashResolutionModal } from '@/features/approvals/ClashResolutionModal'
import { EditClashModal, type CheckClash } from './EditClashModal'
import { Modal } from '@/components/Modal'
import { CompanyBar } from '@/components/CompanyBar'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'
import type { JobDetail, InstallerUser, JobMessage } from '@/lib/supabase/queries/jobs'
import type { Role, JobStatus, Punctuality } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'
import { ArrowLeft, Bell, Trash2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type FormValues = {
  project_title:           string
  date:                    string
  date_end:                string
  time_start:              string
  time_end:                string
  client:                  string
  location:                string
  description:             string
  client_poc_name:         string
  client_poc_phone:        string
  production_ready:        boolean
  do_issued:               boolean
  punctuality:             Punctuality
  production_instructions: string
  notes:                   string
  sales_poc_id:            string
  quote_amount:            string
  supplier_cost:           string
  margin_notes:            string
}

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

interface Props {
  job:             JobDetail
  role:            Role
  userId:          string
  userName:        string
  lang:            LangCode
  installers:             InstallerUser[]
  initialMessages:        JobMessage[]
  salesPocOptions:        SelectOption[]
  initialCoordinatorIds?: string[]
  coordinatorOptions?:    Array<{ id: string; label: string }>
  backHref?:              string
}

export function JobDetailShell({
  job, role, userId, userName, lang, installers, initialMessages, salesPocOptions,
  initialCoordinatorIds = [], coordinatorOptions = [], backHref = '/schedule',
}: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const router   = useRouter()
  const supabase = createClient()

  const completed = job.status === 'completed'

  // Formal assignments (green) vs sales suggestions (yellow). Sub-installers
  // (Phase 4) live in their own bucket — keep them out of the main grid sets.
  const initialAssigneeIds = job.job_assignees
    .filter(a => !a.is_suggestion && !a.is_sub_installer)
    .map(a => a.user_id)
  const initialSuggestedIds = job.job_assignees
    .filter(a => a.is_suggestion && !a.is_sub_installer)
    .map(a => a.user_id)
  const initialSubAssignedIds = job.job_assignees
    .filter(a => !a.is_suggestion && a.is_sub_installer)
    .map(a => a.user_id)
  const initialSubSuggestedIds = job.job_assignees
    .filter(a => a.is_suggestion && a.is_sub_installer)
    .map(a => a.user_id)

  // Sales suggest installers; coordinator / scheduler / admin formally assign them.
  const isSales   = role === 'sales'
  const canAssign = (['scheduler', 'coordinator', 'admin'] as Role[]).includes(role)
  // Who may edit the core / team fields (title, dates, POC, coordinators, notes).
  const canEditCore = (['sales', 'scheduler', 'coordinator', 'admin'] as Role[]).includes(role)

  const [saving,               setSaving]              = useState(false)
  const [status,               setStatus]              = useState<JobStatus>(job.status)

  const readOnly  = completed
  const [clashData,            setClashData]           = useState<ClashesResponse | null>(null)
  // Clash-on-edit of a scheduled job (Workflow V2 Task 19, extended to scheduler)
  const [editClashes,          setEditClashes]         = useState<CheckClash[] | null>(null)
  const pendingValuesRef = useRef<FormValues | null>(null)
  const [showSuccessModal,     setShowSuccessModal]    = useState(false)
  const [showPushAnywaysModal, setShowPushAnywaysModal]= useState(false)
  const [showDeleteModal,      setShowDeleteModal]     = useState(false)
  const [deleting,             setDeleting]            = useState(false)
  const [selectedInstallerIds,    setSelectedInstallerIds]   = useState<string[]>(initialAssigneeIds)
  const [suggestedInstallerIds,   setSuggestedInstallerIds]  = useState<string[]>(initialSuggestedIds)
  const [selectedSubIds,          setSelectedSubIds]         = useState<string[]>(initialSubAssignedIds)
  const [suggestedSubIds,         setSuggestedSubIds]        = useState<string[]>(initialSubSuggestedIds)
  const [selectedCoordinatorIds, setSelectedCoordinatorIds] = useState<string[]>(initialCoordinatorIds)

  const {
    register, handleSubmit, getValues, setValue, reset, control, watch,
    formState: { isDirty, errors },
  } = useForm<FormValues>({
    defaultValues: {
      project_title:           job.project_title ?? '',
      date:                    job.date ?? '',
      date_end:                job.date_end ?? '',
      time_start:              job.time_start?.slice(0, 5) ?? '',
      time_end:                job.time_end?.slice(0, 5) ?? '',
      client:                  job.client ?? '',
      location:                job.location ?? '',
      description:             job.description ?? '',
      client_poc_name:         job.client_poc_name ?? '',
      client_poc_phone:        job.client_poc_phone ?? '',
      production_ready:        job.production_ready,
      do_issued:               job.do_issued,
      punctuality:             job.punctuality,
      production_instructions: job.production_instructions ?? '',
      notes:                   job.notes ?? '',
      sales_poc_id:            job.sales_poc_id ?? '',
      quote_amount:            job.job_financials?.quote_amount?.toString() ?? '',
      supplier_cost:           job.job_financials?.supplier_cost?.toString() ?? '',
      margin_notes:            job.job_financials?.margin_notes ?? '',
    },
  })

  const saveValues = async (values: FormValues) => {
    await supabase.from('jobs').update({
      project_title:           values.project_title || null,
      date:                    values.date,
      date_end:                values.date_end || null,
      time_start:              values.time_start || null,
      time_end:                values.time_end || null,
      client:                  values.client,
      location:                values.location,
      description:             values.description || null,
      client_poc_name:         values.client_poc_name || null,
      client_poc_phone:        values.client_poc_phone || null,
      production_ready:        values.production_ready,
      do_issued:               values.do_issued,
      punctuality:             values.punctuality,
      production_instructions: values.production_instructions || null,
      notes:                   values.notes || null,
      sales_poc_id:            values.sales_poc_id || null,
    } as never).eq('id', job.id).throwOnError()
    reset(values)
  }

  // Sales toggles a tentative suggestion (yellow). Persists immediately via the
  // suggest-installer route so nothing depends on the Save button. The same
  // route also handles SUB-installer suggestions (is_sub — Phase 4 bucket).
  const toggleSuggestionFor = async (
    installerId: string,
    isSub: boolean,
    ids: string[],
    setIds: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const wasSuggested = ids.includes(installerId)
    const action = wasSuggested ? 'remove' : 'add'
    setIds(prev =>
      wasSuggested ? prev.filter(id => id !== installerId) : [...prev, installerId],
    )
    try {
      const res = await fetch(`/api/jobs/${job.id}/suggest-installer`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: installerId, action, is_sub: isSub }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // revert optimistic update
      setIds(prev =>
        wasSuggested ? [...prev, installerId] : prev.filter(id => id !== installerId),
      )
      showError(t(lang, 'saveError'))
    }
  }

  const toggleSuggestion    = (id: string) => toggleSuggestionFor(id, false, suggestedInstallerIds, setSuggestedInstallerIds)
  const toggleSubSuggestion = (id: string) => toggleSuggestionFor(id, true,  suggestedSubIds,       setSuggestedSubIds)

  const saveCoordinatorDiff = async (): Promise<string[]> => {
    const added   = selectedCoordinatorIds.filter(id => !initialCoordinatorIds.includes(id))
    const removed = initialCoordinatorIds.filter(id => !selectedCoordinatorIds.includes(id))
    for (const id of removed) {
      await supabase.from('job_coordinators').delete().eq('job_id', job.id).eq('user_id', id).throwOnError()
    }
    for (const id of added) {
      await supabase.from('job_coordinators').insert({ job_id: job.id, user_id: id } as never).throwOnError()
    }
    return added
  }

  const performSave = async (values: FormValues) => {
    setSaving(true)
    try {
      const [, addedCoordinatorIds] = await Promise.all([
        saveValues(values), saveCoordinatorDiff(),
      ])

      // Formal installer assignment (coordinator / scheduler / admin). The route
      // clears sales suggestions, sets the formal list, and notifies installers
      // + sales POC + coordinators.
      if (canAssign && isInstallerDirty) {
        const res = await fetch(`/api/jobs/${job.id}/assign-installers`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ installer_ids: selectedInstallerIds }),
        })
        if (!res.ok) throw new Error()
      }

      // Sub-installer bucket (Phase 4) — separate route, sub rows only.
      // Newly-confirmed subs get their job link via Telegram.
      if (canAssign && isSubDirty) {
        const res = await fetch(`/api/jobs/${job.id}/sub-installers`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ installer_ids: selectedSubIds }),
        })
        if (!res.ok) throw new Error()
      }

      // Newly-added coordinators still get their own notification.
      if (addedCoordinatorIds.length > 0) {
        await fetch(`/api/jobs/${job.id}/notify-assigned`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ installerIds: [], coordinatorIds: addedCoordinatorIds }),
        })
      }

      showSuccess(t(lang, 'savedSuccessfully'))
      router.refresh()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
  }

  // Editing an already-scheduled job used to run NO clash check — moving its
  // time or installer onto another booking saved silently (deferred from
  // Phase 1). Now scheduler/coordinator/admin saves are checked first;
  // coordinators can alert the schedulers, schedulers can save anyway.
  const onSubmit = async (values: FormValues) => {
    const timeChanged =
      values.date        !== (job.date ?? '') ||
      values.time_start  !== (job.time_start?.slice(0, 5) ?? '') ||
      values.time_end    !== (job.time_end?.slice(0, 5) ?? '') ||
      values.punctuality !== job.punctuality

    const needsCheck =
      status === 'scheduled' && canAssign && selectedInstallerIds.length > 0 &&
      (isInstallerDirty || timeChanged)

    if (needsCheck) {
      setSaving(true)
      try {
        const res = await fetch(`/api/jobs/${job.id}/assign-installers?checkOnly=true`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            installer_ids: selectedInstallerIds,
            date:          values.date,
            time_start:    values.time_start,
            time_end:      values.time_end,
            punctuality:   values.punctuality,
          }),
        })
        if (res.ok) {
          const data: { hasClash: boolean; clashes: CheckClash[] } = await res.json()
          if (data.hasClash) {
            pendingValuesRef.current = values
            setEditClashes(data.clashes)
            setSaving(false)
            return
          }
        }
        // A failed check never blocks the save — fall through.
      } catch {
        // ignore — fall through to the normal save
      }
      setSaving(false)
    }

    await performSave(values)
  }

  const resumeSaveAfterClash = async (alertSchedulers: boolean) => {
    const values = pendingValuesRef.current
    const names  = [...new Set((editClashes ?? []).map(c => c.installerName).filter(Boolean))]
    setEditClashes(null)
    pendingValuesRef.current = null
    if (!values) return
    if (alertSchedulers) {
      // Best-effort — the save must not fail because a Telegram send did.
      fetch(`/api/jobs/${job.id}/notify-clash`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clashNames: names }),
      }).catch(() => {})
    }
    await performSave(values)
  }

  const handleStatusChange = async (newStatus: JobStatus, newDate?: string) => {
    try {
      const patch: Record<string, unknown> = { status: newStatus }
      if (newStatus === 'completed') patch.completed_at = new Date().toISOString()
      if (newDate) patch.date = newDate
      await supabase.from('jobs').update(patch as never).eq('id', job.id).throwOnError()
      setStatus(newStatus)
      if (newDate) setValue('date', newDate)
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.push(backHref)
    } catch {
      showError(t(lang, 'saveError'))
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  const handlePushToSchedule = async () => {
    setSaving(true)
    try {
      if (isDirty) await saveValues(getValues())
      const res = await fetch(`/api/jobs/${job.id}/clashes`)
      if (!res.ok) throw new Error()
      const data: ClashesResponse = await res.json()
      if (data.clashes.length === 0 && data.softClashes.length === 0 && data.travelWarnings.length === 0) {
        const submitRes = await fetch(`/api/jobs/${job.id}/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!submitRes.ok) throw new Error()
        setStatus('scheduled')
        setShowSuccessModal(true)
      } else {
        setClashData(data)
      }
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSendToScheduler = async (
    replacements: Record<string, string | 'keep'>,
    timeStart: string,
    timeEnd: string,
  ) => {
    try {
      for (const [oldId, newId] of Object.entries(replacements)) {
        if (newId === 'keep') continue
        await supabase.from('job_assignees').delete().eq('job_id', job.id).eq('user_id', oldId)
        await supabase.from('job_assignees').insert({
          job_id: job.id, user_id: newId,
          is_suggestion: isSales, suggested_by: isSales ? userId : null,
        } as never)
      }
      if (timeStart !== (job.time_start ?? '').slice(0, 5) || timeEnd !== (job.time_end ?? '').slice(0, 5)) {
        await supabase.from('jobs').update({ time_start: timeStart || null, time_end: timeEnd || null } as never).eq('id', job.id)
        if (timeStart) setValue('time_start', timeStart)
        if (timeEnd)   setValue('time_end', timeEnd)
      }
      const res = await fetch(`/api/jobs/${job.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      setStatus('scheduled')
      setClashData(null)
      setShowSuccessModal(true)
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  // Clash modal "Notify Scheduler" — leaves the job pending and flags schedulers.
  const handleNotifyClash = async (clashNames: string[]) => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/notify-clash`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clashNames }),
      })
      if (!res.ok) throw new Error()
      setClashData(null)
      showSuccess('Scheduler notified — job kept pending')
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const handlePushAnyways = async () => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      setStatus('scheduled')
      setClashData(null)
      setShowPushAnywaysModal(true)
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  const isInstaller        = role === 'installer'
  const showDelete         = (role === 'sales' && status === 'pending') || role === 'scheduler'
  const showMarkComplete   = role === 'scheduler' && status === 'scheduled'
  const originalSalesPocId = job.sales_poc_id ?? ''

  const isInstallerDirty = useMemo(() => {
    const a = new Set(selectedInstallerIds)
    const b = new Set(initialAssigneeIds)
    if (a.size !== b.size) return true
    for (const id of a) if (!b.has(id)) return true
    return false
  }, [selectedInstallerIds, initialAssigneeIds])

  const isSubDirty = useMemo(() => {
    const a = new Set(selectedSubIds)
    const b = new Set(initialSubAssignedIds)
    if (a.size !== b.size) return true
    for (const id of a) if (!b.has(id)) return true
    return false
  }, [selectedSubIds, initialSubAssignedIds])

  // ── Installer grid: per-role behaviour ──────────────────────────────────────
  const toggleFormal = (id: string) =>
    setSelectedInstallerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const salesCanSuggest = isSales && !readOnly && status !== 'scheduled'

  const installerStateOf = (id: string): InstallerCardState => {
    if (canAssign) {
      if (selectedInstallerIds.includes(id)) return 'assigned'
      if (initialSuggestedIds.includes(id))  return 'suggested'
      return 'none'
    }
    if (initialAssigneeIds.includes(id))    return 'assigned'
    if (suggestedInstallerIds.includes(id)) return 'suggested'
    return 'none'
  }

  const installerOnToggle =
    canAssign && !readOnly ? toggleFormal :
    salesCanSuggest        ? toggleSuggestion :
    undefined

  // Sales cannot un-assign a formally assigned installer — only their own suggestions.
  const installerDisabledOf = isSales ? (id: string) => initialAssigneeIds.includes(id) : undefined

  const installerNoteOf = (id: string): string | null => {
    if (canAssign) {
      return (initialSuggestedIds.includes(id) && !selectedInstallerIds.includes(id)) ? 'Sales suggested' : null
    }
    if (isSales) return suggestedInstallerIds.includes(id) ? 'You suggested' : null
    return null
  }

  // ── Sub-installer bucket (Phase 4): same rules, separate bucket ─────────────
  const toggleSubFormal = (id: string) =>
    setSelectedSubIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const subStateOf = (id: string): InstallerCardState => {
    if (canAssign) {
      if (selectedSubIds.includes(id))         return 'assigned'
      if (initialSubSuggestedIds.includes(id)) return 'suggested'
      return 'none'
    }
    if (initialSubAssignedIds.includes(id)) return 'assigned'
    if (suggestedSubIds.includes(id))       return 'suggested'
    return 'none'
  }

  const subOnToggle =
    canAssign && !readOnly ? toggleSubFormal :
    salesCanSuggest        ? toggleSubSuggestion :
    undefined

  // Sales cannot un-assign a confirmed sub — only their own suggestions.
  const subDisabledOf = isSales ? (id: string) => initialSubAssignedIds.includes(id) : undefined

  const subNoteOf = (id: string): string | null => {
    if (canAssign) {
      return (initialSubSuggestedIds.includes(id) && !selectedSubIds.includes(id)) ? 'Sales suggested' : null
    }
    if (isSales) return suggestedSubIds.includes(id) ? 'You suggested' : null
    return null
  }

  // Sub pool = everyone not already engaged on the main grid (mockup rule:
  // main picks disappear from the sub bucket to prevent double assignment).
  const mainEngagedIds = new Set(
    canAssign
      ? [...selectedInstallerIds, ...initialSuggestedIds]
      : [...initialAssigneeIds, ...(isSales ? suggestedInstallerIds : initialSuggestedIds)],
  )
  const subPool = installers.filter(i => !mainEngagedIds.has(i.id))

  const subCount = canAssign
    ? new Set([...selectedSubIds, ...initialSubSuggestedIds]).size
    : isSales
      ? new Set([...initialSubAssignedIds, ...suggestedSubIds]).size
      : initialSubAssignedIds.length

  const subBucketDefaultOpen =
    initialSubAssignedIds.length + initialSubSuggestedIds.length > 0

  // "Remove" — clear this role's sub picks; assigners persist on Save & notify.
  const clearSubs = () => {
    if (canAssign) {
      setSelectedSubIds([])
    } else if (salesCanSuggest) {
      for (const id of [...suggestedSubIds]) void toggleSubSuggestion(id)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-28">

      <CompanyBar lang={lang} />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-ink2 hover:text-ink mb-2"
        >
          <ArrowLeft size={14} />
          {isInstaller ? 'Back to Jobs' : 'Back to Schedule'}
        </button>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-display text-xl font-semibold text-ink">
            {isInstaller ? 'View job' : 'Edit job'}
          </h1>
          <Pill variant={status} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* ── Core card ───────────────────────────────────────────── */}
        <CoreSection
          register={register}
          errors={errors}
          control={control}
          watch={watch}
          setValue={setValue}
          readOnly={readOnly}
          lang={lang}
          role={role}
          installerView={isInstaller}
        />

        {/* ── Production section (all roles; installer = read-only) ─ */}
        <ProductionReadySection
          register={register}
          watch={watch}
          setValue={setValue}
          readOnly={readOnly}
          role={role}
          lang={lang}
          jobId={job.id}
          userId={userId}
          files={job.files.filter(f =>
            f.kind === 'production_instructions' || f.kind === 'do' || f.kind === 'completion'
          )}
        />

        {/* ── Team card ───────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="p-4 space-y-4">

            {/* Person-in-Charge */}
            <Field label="Person-in-Charge">
              {isInstaller ? (
                <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2">
                  {salesPocOptions.find(o => o.id === watch('sales_poc_id'))?.label ?? '—'}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Controller
                      control={control}
                      name="sales_poc_id"
                      render={({ field }) => (
                        <SearchableSelect
                          value={salesPocOptions.find(o => o.id === field.value)?.label ?? ''}
                          onChange={label => {
                            const found = salesPocOptions.find(o => o.label === label)
                            if (found) field.onChange(found.id)
                          }}
                          options={salesPocOptions}
                          disabled={readOnly || !canEditCore}
                        />
                      )}
                    />
                  </div>
                  {watch('sales_poc_id') !== originalSalesPocId && !readOnly && canEditCore && (
                    <button
                      type="button"
                      onClick={() => setValue('sales_poc_id', originalSalesPocId, { shouldDirty: true })}
                      className="w-7 h-7 flex items-center justify-center rounded-full border border-line bg-bg text-muted hover:text-terracotta hover:border-terracotta transition-colors shrink-0 text-base leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </Field>

            {/* Sub POC / Coordinators */}
            <Field label="Sub POC / Coordinators">
              <MultiUserSelect
                options={coordinatorOptions}
                value={selectedCoordinatorIds}
                onChange={setSelectedCoordinatorIds}
                disabled={readOnly || !canEditCore}
              />
            </Field>

            {/* Notes */}
            <Field label={t(lang, 'notes')}>
              {isInstaller ? (
                <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 min-h-[3rem] leading-relaxed">
                  {watch('notes') || <span className="italic text-muted">No notes</span>}
                </div>
              ) : (
                <SuggestField
                  value={watch('notes')}
                  onAccept={s => setValue('notes', s, { shouldDirty: true })}
                  readOnly={readOnly || !canEditCore}
                  field="Notes"
                >
                  <textarea
                    {...register('notes')}
                    disabled={readOnly || !canEditCore}
                    rows={2}
                    className={TEXTAREA}
                  />
                </SuggestField>
              )}
            </Field>

          </div>

          {/* Installers sub-section */}
          <div className="border-t border-line px-4 pt-3 pb-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-3">Installers</p>
            {isInstaller ? (
              /* installer sees only the confirmed (formal) assignees, read-only */
              <InstallerGrid
                installers={installers.filter(i => initialAssigneeIds.includes(i.id))}
                stateOf={() => 'assigned'}
              />
            ) : (
              <InstallerGrid
                installers={installers}
                stateOf={installerStateOf}
                onToggle={installerOnToggle}
                disabledOf={installerDisabledOf}
                noteOf={installerNoteOf}
              />
            )}
          </div>

          {/* Sub-installer bucket (Phase 4) — same pool, separate bucket */}
          {!isInstaller && (
            <SubInstallerBucket
              lang={lang}
              installers={subPool}
              subCount={subCount}
              stateOf={subStateOf}
              onToggle={subOnToggle}
              disabledOf={subDisabledOf}
              noteOf={subNoteOf}
              onClear={clearSubs}
              defaultOpen={subBucketDefaultOpen}
              canEdit={(canAssign && !readOnly) || salesCanSuggest}
            />
          )}

          {/* External installer bucket (Phase 4) — scheduler/coordinator/admin */}
          {canAssign && (
            <ExternalPOCBucket jobId={job.id} lang={lang} readOnly={readOnly} />
          )}
        </Card>

        {/* ── Attachments ─────────────────────────────────────────── */}
        <AttachmentBuckets
          jobId={job.id}
          userId={userId}
          lang={lang}
          readOnly={readOnly || isInstaller}
        />

        {/* ── Task list (Phase 4) ─────────────────────────────────── */}
        <TaskListSection
          jobId={job.id}
          role={role}
          lang={lang}
          readOnly={readOnly}
        />

        {/* ── Chat (unchanged) ────────────────────────────────────── */}
        <ChatSection
          jobId={job.id}
          userId={userId}
          userName={userName}
          lang={lang}
          completedAt={job.completed_at}
          initialMessages={initialMessages}
          chatFiles={job.files.filter(f => f.kind === 'attachment')}
          preScheduleLocked={status === 'pending' || status === 'awaiting_approval'}
        />

        {/* ── Notifications placeholder (non-installer only) ────────  */}
        {!isInstaller && (
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <Bell size={12} className="text-muted" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-muted">
                Notifications
              </span>
            </div>
            <div className="px-4 py-5 flex flex-col items-center gap-2 text-center">
              <Bell size={20} className="text-line" />
              <p className="text-sm font-medium text-ink2">Coming soon</p>
              <p className="text-xs text-muted">Telegram notification tracker</p>
            </div>
          </Card>
        )}

      </div>

      {/* ── Action bar (sticky bottom) ───────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto space-y-2">
          {isInstaller ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold"
            >
              <ArrowLeft size={14} />
              Back to Jobs
            </button>
          ) : (
            <>
              <div className="flex gap-2">
                {showDelete && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:text-terracotta hover:border-terracotta transition-colors"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
                {showMarkComplete && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('completed')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors"
                  >
                    <CheckCircle size={12} />
                    Mark job complete
                  </button>
                )}
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center px-3 py-2 rounded-[10px] border border-dashed border-line bg-paper text-xs font-medium text-muted opacity-50 cursor-not-allowed"
                >
                  Duplicate (WIP)
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className={cn(
                    'flex items-center justify-center px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors',
                    !showDelete && !showMarkComplete && 'flex-1',
                  )}
                >
                  Cancel
                </button>
              </div>
              {readOnly || role === 'designer' ? null : role === 'sales' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={saving || (!isDirty && !isInstallerDirty)}
                    className={cn(
                      'flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border border-amber-400 bg-amber-50 text-sm font-semibold text-amber-800 disabled:opacity-40 disabled:cursor-not-allowed',
                      status === 'scheduled' ? 'w-full' : 'flex-1',
                    )}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {status !== 'scheduled' && (
                    <button
                      type="button"
                      onClick={handlePushToSchedule}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Bell size={14} />
                      {saving ? t(lang, 'loading') : 'Push to Schedule'}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={saving || (!isDirty && !isInstallerDirty && !isSubDirty)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Bell size={14} />
                  {saving ? t(lang, 'loading') : (canAssign ? 'Save & notify' : 'Save Changes')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      <EditClashModal
        isOpen={editClashes !== null}
        clashes={editClashes ?? []}
        role={role}
        lang={lang}
        onAlertScheduler={() => resumeSaveAfterClash(true)}
        onProceed={() => resumeSaveAfterClash(false)}
        onClose={() => { setEditClashes(null); pendingValuesRef.current = null }}
      />
      {clashData && (
        <ClashResolutionModal
          jobDate={clashData.jobDate}
          jobTimeStart={clashData.jobTimeStart}
          jobTimeEnd={clashData.jobTimeEnd}
          clashes={clashData.clashes}
          softClashes={clashData.softClashes}
          travelWarnings={clashData.travelWarnings}
          substitutes={clashData.substitutes}
          weekDays={clashData.weekDays}
          lang={lang}
          onSendToScheduler={handleSendToScheduler}
          onNotifyScheduler={handleNotifyClash}
          onCancel={() => setClashData(null)}
        />
      )}

      <Modal isOpen={showSuccessModal} onClose={() => { setShowSuccessModal(false); router.push('/schedule') }}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">Pushed to Schedule!</p>
          <Btn variant="primary" size="sm" onClick={() => { setShowSuccessModal(false); router.push('/schedule') }}>
            OK
          </Btn>
        </div>
      </Modal>

      <Modal isOpen={showPushAnywaysModal} onClose={() => { setShowPushAnywaysModal(false); router.push('/schedule') }}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">Pushed to Schedule!</p>
          <p className="text-sm text-muted">The Scheduler has been notified to assign installers.</p>
          <Btn variant="primary" size="sm" onClick={() => { setShowPushAnywaysModal(false); router.push('/schedule') }}>
            OK
          </Btn>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'deleteJobConfirmTitle')}
          </h2>
          <p className="text-sm text-muted">{t(lang, 'deleteJobConfirmBody')}</p>
          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleDelete} disabled={deleting}>
              {deleting ? t(lang, 'loading') : t(lang, 'deleteJob')}
            </Btn>
          </div>
        </div>
      </Modal>



    </div>
  )
}
