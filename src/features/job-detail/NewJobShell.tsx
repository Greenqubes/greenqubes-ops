'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { SuggestField } from '@/components/SuggestField'
import { SearchableSelect } from '@/components/SearchableSelect'
import { CoreSection } from './CoreSection'
import { InstallerGrid } from './InstallerGrid'
import { DesignBriefSection } from './DesignBriefSection'
import { JobFormLayout } from './JobFormLayout'
import { CollapseCard } from './CollapseCard'
import { Lock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { FormValues } from './JobDetailShell'
import type { InstallerUser } from '@/lib/supabase/queries/jobs'
import type { LangCode } from '@/lib/i18n'
import type { SelectOption } from '@/components/SearchableSelect'
import { CompanyBar } from '@/components/CompanyBar'
import { MultiUserSelect } from '@/components/MultiUserSelect'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { ClashResolutionModal } from '@/features/approvals/ClashResolutionModal'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'
import type { Role } from '@/lib/supabase/types'

interface Props {
  userId:          string
  userName:        string
  lang:            LangCode
  salesPocOptions:     SelectOption[]
  allInstallers:       InstallerUser[]
  role:                Role
  coordinatorOptions?: Array<{ id: string; label: string }>
  designerOptions?:    Array<{ id: string; label: string }>
}

export function NewJobShell({ userId, lang, salesPocOptions, allInstallers, role, coordinatorOptions = [], designerOptions = [] }: Props) {
  const router = useRouter()
  const { error: showError, success: showSuccess } = useToast()
  const [saving,                setSaving]               = useState(false)
  const [selectedIds,           setSelectedIds]          = useState<string[]>([])
  const [selectedCoordIds,      setSelectedCoordIds]     = useState<string[]>([])
  const [selectedDesignerIds,   setSelectedDesignerIds]  = useState<string[]>([])
  // Design brief card (Task 6) — pre-book is exempt from the required rule.
  // Brief text, and a picked due date (with dueManual, per handleDueDate
  // below), all ride into the create payload; dueManual is only ever true
  // once the user has actually touched the date field, so an untouched due
  // date rides in as null/false exactly as if the fields were omitted.
  const [briefText,             setBriefText]            = useState('')
  const [dueDate,                setDueDate]             = useState<string | null>(null)
  const [dueManual,              setDueManual]           = useState(false)
  const handleDueDate = (v: string | null) => { setDueDate(v); setDueManual(true) }
  const [showPushedModal,       setShowPushedModal]      = useState(false)
  const [clashData,             setClashData]            = useState<ClashesResponse | null>(null)
  const [pushJobId,             setPushJobId]            = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Sales AND coordinator pick installers as tentative suggestions (yellow);
  // only scheduler/admin creating a job assign them formally (green). Smoke
  // feedback edit 8 (Nic explicit, 2026-08-27): coordinator loses formal
  // installer assignment everywhere, including here at job creation.
  const suggestMode = role === 'sales' || role === 'coordinator'

  // Designers picker: editable for sales/scheduler/coordinator/admin,
  // read-only chips for designer/production — matches the edit form's
  // canEditCore gate on the Team card (JobDetailShell).
  const canEditDesigners = (['sales', 'scheduler', 'coordinator', 'admin'] as Role[]).includes(role)

  const { register, control, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      project_title:           '',
      date:                    today,
      date_end:                '',
      time_start:              '',
      time_end:                '',
      client:                  '',
      location:                '',
      description:             '',
      client_poc_name:         '',
      client_poc_phone:        '',
      production_ready:        false,
      do_issued:               false,
      punctuality:             'strict',
      production_instructions: '',
      notes:                   '',
      quote_amount:            '',
      supplier_cost:           '',
      margin_notes:            '',
      sales_poc_id:            userId,
    },
  })

  async function saveJob(mode: 'pending' | 'push_to_schedule') {
    const values = watch()
    setSaving(true)
    const supabase = createClient()
    try {
      const { data: job, error: insertError } = await (supabase
        .from('jobs')
        .insert({
          // Always insert as pending — the submit route flips it to
          // scheduled and notifies schedulers when pushing.
          status: 'pending',
          sales_poc_id:            values.sales_poc_id || userId,
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
          design_brief:            briefText || null,
          design_due_date:         dueDate,
          design_due_manual:       dueManual,
          visibility:              ['role:sales', 'role:scheduler'],
        } as never)
        .select('id')
        .single() as unknown as Promise<{ data: { id: string } | null; error: Error | null }>)

      if (insertError || !job) throw insertError

      // Create default attachment buckets
      await supabase.from('attachment_buckets').insert([
        { job_id: job.id, name: 'PERMIT-TO-WORK', position: 0 },
        { job_id: job.id, name: 'BCA',            position: 1 },
        { job_id: job.id, name: 'DESIGNER JO',    position: 2 },
        { job_id: job.id, name: 'OTHERS',         position: 3 },
      ] as never)

      // Insert selected installers — suggestions for sales, formal otherwise
      if (selectedIds.length > 0) {
        await supabase.from('job_assignees').insert(
          selectedIds.map(uid => ({
            job_id:        job.id,
            user_id:       uid,
            is_suggestion: suggestMode,
            suggested_by:  suggestMode ? userId : null,
          })) as never,
        )
      }

      // Insert selected coordinators
      if (selectedCoordIds.length > 0) {
        await supabase.from('job_coordinators').insert(
          selectedCoordIds.map(uid => ({ job_id: job.id, user_id: uid })) as never,
        )
        await fetch(`/api/jobs/${job.id}/notify-assigned`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installerIds: [], coordinatorIds: selectedCoordIds }),
        })
      }

      // Attach selected designers — the route itself notifies each one
      // (bell + Telegram), same as the edit form's save handler.
      if (selectedDesignerIds.length > 0) {
        await fetch(`/api/jobs/${job.id}/designers`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: selectedDesignerIds }),
        })
      }

      // Push onto the schedule — but first check for installer
      // double-bookings, exactly like the edit form does.
      if (mode === 'push_to_schedule') {
        const clashRes = await fetch(`/api/jobs/${job.id}/clashes`)
        if (!clashRes.ok) {
          showError(t(lang, 'saveError'))
          router.push(`/jobs/${job.id}`)
          return
        }
        const clash: ClashesResponse = await clashRes.json()
        if (clash.clashes.length > 0 || clash.softClashes.length > 0 || clash.travelWarnings.length > 0) {
          // Hold the push and let the user resolve the clash. The job is
          // already saved as pending, so nothing is lost if they cancel.
          setPushJobId(job.id)
          setClashData(clash)
          setSaving(false)
          return
        }

        // No clashes — push straight through. Sets status to scheduled and
        // notifies all schedulers to assign installers.
        const res = await fetch(`/api/jobs/${job.id}/submit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          // Job was created but stayed pending — surface the failure and
          // land on the edit form so the user can retry the push there.
          showError(t(lang, 'saveError'))
          router.push(`/jobs/${job.id}`)
          return
        }
        setShowPushedModal(true)
        return
      }

      router.push(`/jobs/${job.id}`)
    } catch {
      showError(t(lang, 'saveError'))
      setSaving(false)
    }
  }

  // Resolve a clash from the modal: apply any installer substitutions /
  // time changes to the already-created job, then push it through.
  async function handleSendToScheduler(
    replacements: Record<string, string | 'keep'>,
    timeStart: string,
    timeEnd: string,
  ) {
    if (!pushJobId) return
    const supabase = createClient()
    try {
      for (const [oldId, newId] of Object.entries(replacements)) {
        if (newId === 'keep') continue
        await supabase.from('job_assignees').delete().eq('job_id', pushJobId).eq('user_id', oldId)
        await supabase.from('job_assignees').insert({
          job_id: pushJobId, user_id: newId,
          is_suggestion: suggestMode, suggested_by: suggestMode ? userId : null,
        } as never)
      }
      const curStart = (watch('time_start') ?? '').slice(0, 5)
      const curEnd   = (watch('time_end')   ?? '').slice(0, 5)
      if (timeStart !== curStart || timeEnd !== curEnd) {
        await supabase.from('jobs')
          .update({ time_start: timeStart || null, time_end: timeEnd || null } as never)
          .eq('id', pushJobId)
      }
      const res = await fetch(`/api/jobs/${pushJobId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error()
      setClashData(null)
      setShowPushedModal(true)
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  // Clash modal "Notify Scheduler" — the job is already saved as pending; flag
  // the schedulers and leave it for them to resolve.
  async function handleNotifyClash(clashNames: string[]) {
    if (!pushJobId) return
    try {
      const res = await fetch(`/api/jobs/${pushJobId}/notify-clash`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clashNames }),
      })
      if (!res.ok) throw new Error()
      setClashData(null)
      showSuccess('Scheduler notified — job kept pending')
      router.push('/schedule')
    } catch {
      showError(t(lang, 'saveError'))
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-28">
      <CompanyBar lang={lang} />

      {/* Back + title — same container width as the columns */}
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-5 pb-1">
        <div className="flex items-center gap-3">
          <Link href="/schedule" className="text-ink2 hover:text-ink shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="font-display text-xl font-semibold text-ink">{t(lang, 'newJob')}</h1>
        </div>
      </div>

      <JobFormLayout
        lang={lang}
        lockedTabs={['files', 'chat']}
        details={
          <div className="flex flex-col gap-4">
            <div data-tour="job-details">
              <CollapseCard title={t(lang, 'jobDetails')} storageKey="gq-jobcard-details">
                <CoreSection
                  bare
                  register={register}
                  errors={errors}
                  control={control}
                  watch={watch}
                  setValue={setValue}
                  readOnly={false}
                  lang={lang}
                  role={role}
                  validateRequired
                />
              </CollapseCard>
            </div>

            <DesignBriefSection
              jobId={null}
              lang={lang}
              readOnly={false}
              canManage={canEditDesigners}
              userId={userId}
              briefText={briefText}
              onBriefText={setBriefText}
              dueDate={dueDate}
              dueManual={dueManual}
              onDueDate={handleDueDate}
              briefError={false}
              files={[]}
              designerOptions={designerOptions}
              selectedDesignerIds={selectedDesignerIds}
              onToggleDesigner={id => setSelectedDesignerIds(prev =>
                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
              )}
            />

            {/* Production — instructions now, photos/DO after the job is saved */}
            <CollapseCard title={t(lang, 'productionReadyInstructions')} storageKey="gq-jobcard-production">
              <div className="space-y-3">
                <Field label={t(lang, 'productionInstructions')}>
                  <SuggestField
                    value={watch('production_instructions')}
                    onAccept={s => setValue('production_instructions', s, { shouldDirty: true })}
                    field="Production Instructions"
                  >
                    <textarea
                      {...register('production_instructions')}
                      rows={2}
                      className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 transition-colors duration-150 resize-none"
                    />
                  </SuggestField>
                </Field>
                <div className="flex items-center gap-2 text-muted text-xs">
                  <Lock size={12} />
                  Save the job first to add production photos and DO.
                </div>
              </div>
            </CollapseCard>
          </div>
        }
        team={
          <CollapseCard title={t(lang, 'tabTeam')} storageKey="gq-jobcard-team" bodyClassName="p-0">
            <div className="p-4 space-y-4">
              <Field label="Person-in-Charge">
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
                      disabled={false}
                    />
                  )}
                />
              </Field>
              <Field label="Sub POC / Coordinators">
                <MultiUserSelect
                  options={coordinatorOptions}
                  value={selectedCoordIds}
                  onChange={setSelectedCoordIds}
                />
              </Field>
              <Field label="Notes">
                <SuggestField
                  value={watch('notes')}
                  onAccept={s => setValue('notes', s, { shouldDirty: true })}
                  field="Notes"
                >
                  <textarea
                    {...register('notes')}
                    rows={2}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 transition-colors duration-150 resize-none"
                  />
                </SuggestField>
              </Field>
            </div>

            {/* Installers — same sub-section framing as the edit page */}
            <div className="border-t border-line px-4 pt-3 pb-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">Installers</p>
              {allInstallers.length === 0 ? (
                <p className="text-sm text-muted">No installers found.</p>
              ) : (
                <InstallerGrid
                  installers={allInstallers}
                  lang={lang}
                  stateOf={id => selectedIds.includes(id) ? (suggestMode ? 'suggested' : 'assigned') : 'none'}
                  onToggle={id => setSelectedIds(prev =>
                    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                  )}
                  noteOf={id => (suggestMode && selectedIds.includes(id)) ? 'Suggested' : null}
                />
              )}
            </div>

            {/* Designers grid moved into the Design Brief card, Details tab
                (edit 14, smoke feedback 2026-08-28) — see DesignBriefSection
                below. selectedDesignerIds/setSelectedDesignerIds still live
                here; it still rides into the post-create designers-assign
                call in saveJob above, unchanged. */}
          </CollapseCard>
        }
        files={
          <Card className="p-5 space-y-2 opacity-60 pointer-events-none select-none">
            <h3 className="text-sm font-medium text-ink">{t(lang, 'attachments')}</h3>
            <div className="flex items-center gap-2 py-4 text-muted text-sm justify-center">
              <Lock size={14} />
              Save the job first to add attachments.
            </div>
          </Card>
        }
        chat={
          <Card className="p-5 space-y-3 opacity-60 pointer-events-none select-none">
            <h3 className="text-sm font-medium text-ink">{t(lang, 'jobChatTitle')}</h3>
            <div className="flex items-center justify-center gap-2 py-6 text-muted text-sm">
              <Lock size={14} />
              {t(lang, 'chatPreScheduleMessage')}
            </div>
          </Card>
        }
      />

      {/* ── Action bar (sticky bottom, same chrome as the edit page) ── */}
      <div data-tour="job-actions" className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line px-4 py-3 z-10">
        <div className="max-w-2xl lg:max-w-6xl mx-auto flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="flex items-center justify-center px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveJob('pending')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] border border-amber-400 bg-amber-50 text-sm font-semibold text-amber-800 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save as pending'}
          </button>
          <button
            type="button"
            onClick={() => saveJob('push_to_schedule')}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-terracotta text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Pushing…' : 'Push to Schedule'}
          </button>
        </div>
      </div>

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
          onCancel={() => {
            // Job is already saved as pending — drop the user on its edit
            // page so they can adjust the installer or time and retry.
            setClashData(null)
            if (pushJobId) router.push(`/jobs/${pushJobId}`)
          }}
        />
      )}

      <Modal isOpen={showPushedModal} onClose={() => { setShowPushedModal(false); router.push('/schedule') }}>
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-medium text-ink">Pushed to Schedule!</p>
          <p className="text-sm text-muted">The Scheduler has been notified to assign installers.</p>
          <Btn variant="primary" size="sm" onClick={() => { setShowPushedModal(false); router.push('/schedule') }}>
            OK
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
