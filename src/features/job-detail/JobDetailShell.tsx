'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Btn } from '@/components/Btn'
import { Pill } from '@/components/Pill'
import { CoreSection } from './CoreSection'
import { AssigneeSection } from './AssigneeSection'
import { AttachmentSection } from './AttachmentSection'
import { StatusSection } from './StatusSection'
import { ChatSection } from './ChatSection'
import { PendingFilesSection } from './PendingFilesSection'
import { ProductionReadySection } from './ProductionReadySection'
import { WorkloadPreviewModal } from '@/features/approvals/WorkloadPreviewModal'
import type { JobDetail, InstallerUser, JobMessage } from '@/lib/supabase/queries/jobs'
import type { Role, JobStatus, Punctuality } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'
import { ArrowLeft, Inbox } from 'lucide-react'
import Link from 'next/link'

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
  quote_amount:            string
  supplier_cost:           string
  margin_notes:            string
}

interface Props {
  job:              JobDetail
  role:             Role
  userId:           string
  lang:             LangCode
  installers:       InstallerUser[]
  initialMessages:  JobMessage[]
  backHref?:        string
}

export function JobDetailShell({ job, role, userId, lang, installers, initialMessages, backHref = '/schedule' }: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const router = useRouter()
  const supabase = createClient()

  const completed = job.status === 'completed'
  const readOnly  = completed

  const [saving,          setSaving]          = useState(false)
  const [status,          setStatus]          = useState<JobStatus>(job.status)
  const [showWorkload,    setShowWorkload]     = useState(false)
  const [assignees, setAssignees] = useState(
    job.job_assignees.map(a => a.users).filter(Boolean) as InstallerUser[]
  )

  const { register, handleSubmit, setValue, reset, control, watch, formState: { isDirty, errors } } = useForm<FormValues>({
    defaultValues: {
      project_title:           job.project_title ?? '',
      date:                    job.date ?? '',
      date_end:                job.date_end ?? '',
      time_start:              job.time_start ?? '',
      time_end:                job.time_end ?? '',
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
      quote_amount:            job.job_financials?.quote_amount?.toString() ?? '',
      supplier_cost:           job.job_financials?.supplier_cost?.toString() ?? '',
      margin_notes:            job.job_financials?.margin_notes ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    try {
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
      } as never).eq('id', job.id).throwOnError()

      reset(values)
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

  const handleWorkloadConfirm = async (finalDate: string) => {
    setShowWorkload(false)
    try {
      const res = await fetch(`/api/jobs/${job.id}/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ date: finalDate }),
      })
      if (!res.ok) throw new Error()
      setStatus('awaiting_approval')
      if (finalDate !== job.date) setValue('date', finalDate)
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Sticky header — client name + pill + save */}
      <div className="sticky top-0 z-10 bg-bg border-b border-line px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={backHref} className="text-ink2 hover:text-ink shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <span className="font-display text-sm font-medium text-ink truncate">{watch('project_title') || job.client}</span>
          <Pill variant={status} />
        </div>

        {!readOnly && (
          <Btn
            size="sm"
            onClick={handleSubmit(onSubmit)}
            disabled={saving || !isDirty}
          >
            {saving ? t(lang, 'loading') : t(lang, 'save')}
          </Btn>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Page title */}
        <div>
          <p className="text-[11px] text-muted uppercase tracking-widest mb-1">
            {t(lang, 'companySchedule')}
          </p>
          <h1 className="font-display text-2xl font-medium text-ink tracking-tight leading-none">
            {t(lang, 'editJob')}
          </h1>
        </div>

        {/* Awaiting-approval banner */}
        {status === 'awaiting_approval' && (
          <div className="rounded-card border border-terracotta bg-terracotta-soft px-4 py-3 flex gap-3 items-start">
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

        <CoreSection
          register={register}
          errors={errors}
          control={control}
          readOnly={readOnly}
          lang={lang}
        />

        {role !== 'installer' && (
          <ProductionReadySection
            register={register}
            readOnly={readOnly || status === 'pending' || status === 'awaiting_approval' || status === 'scheduled'}
            lang={lang}
            jobId={job.id}
            userId={userId}
            files={job.files.filter(f => f.kind === 'production_instructions')}
          />
        )}

        <AssigneeSection
          jobId={job.id}
          role={role}
          lang={lang}
          assignees={assignees}
          allInstallers={installers}
          onAssigneesChange={setAssignees}
          readOnly={readOnly}
        />

        {(status === 'pending' || status === 'scheduled') && (
          <PendingFilesSection
            jobId={job.id}
            userId={userId}
            lang={lang}
          />
        )}

        <AttachmentSection
          files={job.files.filter(f => f.kind !== 'voice' && f.kind !== 'attachment' && f.kind !== 'production_instructions')}
          lang={lang}
        />

        <ChatSection
          jobId={job.id}
          userId={userId}
          lang={lang}
          completedAt={job.completed_at}
          initialMessages={initialMessages}
          chatFiles={job.files.filter(f => f.kind === 'attachment')}
          preScheduleLocked={status === 'pending' || status === 'awaiting_approval'}
        />

        <StatusSection
          status={status}
          role={role}
          lang={lang}
          onStatusChange={async (s) => {
            if (role === 'sales' && s === 'awaiting_approval') {
              setShowWorkload(true)
            } else {
              await handleStatusChange(s)
            }
          }}
        />

      </div>

      {showWorkload && (
        <WorkloadPreviewModal
          jobId={job.id}
          currentDate={job.date}
          lang={lang}
          onConfirm={handleWorkloadConfirm}
          onClose={() => setShowWorkload(false)}
        />
      )}
    </div>
  )
}
