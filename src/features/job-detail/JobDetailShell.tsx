'use client'

import { useState } from 'react'
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
import { SuggestField } from '@/components/SuggestField'
import { CoreSection } from './CoreSection'
import { AttachmentBuckets } from './AttachmentBuckets'
import { ChatSection } from './ChatSection'
import { ProductionReadySection } from './ProductionReadySection'
import { InstallerGrid } from './InstallerGrid'
import { ClashResolutionModal } from '@/features/approvals/ClashResolutionModal'
import { SendBackModal } from '@/features/approvals/SendBackModal'
import { Modal } from '@/components/Modal'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'
import type { JobDetail, InstallerUser, JobMessage } from '@/lib/supabase/queries/jobs'
import type { Role, JobStatus, Punctuality } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'
import { ArrowLeft, Bell, Inbox, Trash2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
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
  installers:      InstallerUser[]
  initialMessages: JobMessage[]
  salesPocOptions: SelectOption[]
  backHref?:       string
}

export function JobDetailShell({
  job, role, userId, userName, lang, installers, initialMessages, salesPocOptions, backHref = '/schedule',
}: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const router   = useRouter()
  const supabase = createClient()

  const completed = job.status === 'completed'
  const readOnly  = completed

  const initialAssigneeIds = job.job_assignees
    .map(a => a.users?.id)
    .filter(Boolean) as string[]

  const [saving,               setSaving]              = useState(false)
  const [status,               setStatus]              = useState<JobStatus>(job.status)
  const [clashData,            setClashData]           = useState<ClashesResponse | null>(null)
  const [showSuccessModal,     setShowSuccessModal]    = useState(false)
  const [showPushAnywaysModal, setShowPushAnywaysModal]= useState(false)
  const [showDeleteModal,      setShowDeleteModal]     = useState(false)
  const [deleting,             setDeleting]            = useState(false)
  const [showSendBackModal,    setShowSendBackModal]   = useState(false)
  const [selectedInstallerIds, setSelectedInstallerIds]= useState<string[]>(initialAssigneeIds)

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

  const saveInstallerDiff = async () => {
    const added   = selectedInstallerIds.filter(id => !initialAssigneeIds.includes(id))
    const removed = initialAssigneeIds.filter(id => !selectedInstallerIds.includes(id))
    for (const id of removed) {
      await supabase.from('job_assignees').delete().eq('job_id', job.id).eq('user_id', id).throwOnError()
    }
    for (const id of added) {
      await supabase.from('job_assignees').insert({ job_id: job.id, user_id: id } as never).throwOnError()
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
      await Promise.all([saveValues(values), saveInstallerDiff()])
      showSuccess(t(lang, 'savedSuccessfully'))
      router.refresh()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
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

  const handleApprove = async () => {
    setSaving(true)
    try {
      if (isDirty) await saveValues(getValues())
      const res = await fetch(`/api/jobs/${job.id}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error()
      showSuccess(t(lang, 'approvedSuccess'))
      router.push('/schedule')
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSendBackFromDetail = async (note: string) => {
    setShowSendBackModal(false)
    setSaving(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/send-back`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ note }),
      })
      if (!res.ok) throw new Error()
      showSuccess(t(lang, 'sentBack'))
      router.push('/approvals')
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSubmitForApproval = async () => {
    setSaving(true)
    try {
      if (isDirty) await saveValues(getValues())
      const res = await fetch(`/api/jobs/${job.id}/clashes`)
      if (!res.ok) throw new Error()
      const data: ClashesResponse = await res.json()
      if (data.clashes.length === 0 && data.travelWarnings.length === 0) {
        const submitRes = await fetch(`/api/jobs/${job.id}/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!submitRes.ok) throw new Error()
        setStatus('awaiting_approval')
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
        await supabase.from('job_assignees').insert({ job_id: job.id, user_id: newId } as never)
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
      setStatus('awaiting_approval')
      setClashData(null)
      setShowSuccessModal(true)
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
      setStatus('awaiting_approval')
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

  return (
    <div className="min-h-screen bg-bg pb-28">

      {/* ── Header (non-sticky) ─────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-sm text-ink2 hover:text-ink mb-2"
        >
          <ArrowLeft size={14} />
          {isInstaller ? 'Back to Jobs' : 'Schedule'}
        </Link>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="font-display text-xl font-semibold text-ink">
            {isInstaller ? 'View job' : 'Edit job'}
          </h1>
          <Pill variant={status} />
        </div>
      </div>

      {/* Awaiting-approval banner */}
      {status === 'awaiting_approval' && (
        <div className="mx-4 mb-2 rounded-card border border-terracotta bg-terracotta-soft px-4 py-3 flex gap-3 items-start">
          <div className="w-7 h-7 rounded-full bg-paper flex items-center justify-center shrink-0 mt-0.5">
            <Inbox size={14} className="text-terracotta" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest font-medium text-terracotta mb-0.5">
              {t(lang, 'awaitingApproval')}
            </p>
            <p className="text-sm text-ink2">{t(lang, 'awaitingApprovalDetail')}</p>
          </div>
        </div>
      )}

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
          installerView={isInstaller}
        />

        {/* ── Production section (all roles; installer = read-only) ─ */}
        <ProductionReadySection
          register={register}
          watch={watch}
          setValue={setValue}
          readOnly={readOnly || status === 'pending' || status === 'awaiting_approval' || status === 'scheduled'}
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
                          disabled={readOnly}
                        />
                      )}
                    />
                  </div>
                  {watch('sales_poc_id') !== originalSalesPocId && !readOnly && (
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

            {/* Sub POC / Coordinators — multi-select (UI placeholder; wiring deferred to next session) */}
            <Field label="Sub POC / Coordinators">
              {isInstaller ? (
                <div className="flex flex-wrap gap-2">
                  {/* populated when multi-select feature ships */}
                </div>
              ) : (
                <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-muted italic cursor-not-allowed">
                  Coming soon — multi-select
                </div>
              )}
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
                  readOnly={readOnly}
                  field="Notes"
                >
                  <textarea
                    {...register('notes')}
                    disabled={readOnly}
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
              /* installer sees only assigned installers */
              <InstallerGrid
                allInstallers={installers.filter(i => initialAssigneeIds.includes(i.id))}
                initialSelectedIds={initialAssigneeIds}
                onChange={() => {}}
              />
            ) : (
              <InstallerGrid
                allInstallers={installers}
                initialSelectedIds={initialAssigneeIds}
                onChange={setSelectedInstallerIds}
              />
            )}
          </div>
        </Card>

        {/* ── Attachments ─────────────────────────────────────────── */}
        <AttachmentBuckets
          jobId={job.id}
          lang={lang}
          readOnly={readOnly || isInstaller}
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
              {!readOnly && role === 'sales' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={saving || !isDirty}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border border-amber-400 bg-amber-50 text-sm font-semibold text-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitForApproval}
                    disabled={saving || status === 'awaiting_approval'}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Bell size={14} />
                    {saving ? t(lang, 'loading') : 'Push for Approval'}
                  </button>
                </div>
              ) : !readOnly && role === 'scheduler' && status === 'awaiting_approval' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSendBackModal(true)}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border border-amber-400 bg-amber-50 text-sm font-semibold text-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Send Back to Sales
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Bell size={14} />
                    {saving ? t(lang, 'loading') : 'Approve & Notify'}
                  </button>
                </div>
              ) : !readOnly ? (
                <button
                  type="button"
                  onClick={handleSubmit(onSubmit)}
                  disabled={saving || !isDirty}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Bell size={14} />
                  {saving ? t(lang, 'loading') : 'Save & notify'}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {clashData && (
        <ClashResolutionModal
          jobDate={clashData.jobDate}
          jobTimeStart={clashData.jobTimeStart}
          jobTimeEnd={clashData.jobTimeEnd}
          clashes={clashData.clashes}
          travelWarnings={clashData.travelWarnings}
          substitutes={clashData.substitutes}
          weekDays={clashData.weekDays}
          lang={lang}
          onSendToScheduler={handleSendToScheduler}
          onCancel={() => setClashData(null)}
        />
      )}

      <Modal isOpen={showSuccessModal} onClose={() => { setShowSuccessModal(false); router.push('/schedule') }}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">Pushed for Approval!</p>
          <Btn variant="primary" size="sm" onClick={() => { setShowSuccessModal(false); router.push('/schedule') }}>
            OK
          </Btn>
        </div>
      </Modal>

      <Modal isOpen={showPushAnywaysModal} onClose={() => { setShowPushAnywaysModal(false); router.push('/schedule') }}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">Pushed for Approval!</p>
          <p className="text-sm text-muted">Please check with the Scheduler for approval directly.</p>
          <Btn variant="primary" size="sm" onClick={() => { setShowPushAnywaysModal(false); router.push('/schedule') }}>
            OK
          </Btn>
        </div>
      </Modal>

      {showSendBackModal && (
        <SendBackModal
          client={watch('client') || job.client}
          lang={lang}
          onConfirm={handleSendBackFromDetail}
          onClose={() => setShowSendBackModal(false)}
        />
      )}

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
