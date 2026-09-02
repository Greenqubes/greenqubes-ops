'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { useLiveChannel, type LivePayload } from '@/lib/supabase/useLiveChannel'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Btn } from '@/components/Btn'
import { Pill } from '@/components/Pill'
import { Field } from '@/components/Field'
import { SearchableSelect, SelectOption } from '@/components/SearchableSelect'
import { MultiUserSelect } from '@/components/MultiUserSelect'
import { SuggestField } from '@/components/SuggestField'
import { CoreSection } from './CoreSection'
import { AttachmentBuckets } from './AttachmentBuckets'
import { DesignRatingSlider } from './DesignRatingSlider'
import { DesignBriefSection } from './DesignBriefSection'
import { JobFormLayout } from './JobFormLayout'
import { CollapseCard } from './CollapseCard'
import { ChatSection } from './ChatSection'
import { ProductionReadySection } from './ProductionReadySection'
import { InstallerGrid, type InstallerCardState } from './InstallerGrid'
import { DesignerGrid } from './DesignerGrid'
import { SubInstallerBucket } from './SubInstallerBucket'
import { TaskListSection } from './TaskListSection'
import { ExternalPOCBucket } from './ExternalPOCBucket'
import { ClashResolutionModal } from '@/features/approvals/ClashResolutionModal'
import { EditClashModal, type CheckClash } from './EditClashModal'
import { Modal } from '@/components/Modal'
import { CompanyBar } from '@/components/CompanyBar'
import { briefRequiredError } from '@/lib/utils/design-brief-rules'
import { daysBetween, addDaysISO, todaySGT } from '@/lib/utils/design-urgency'
import { timingOnJobTimeEdit } from '@/lib/utils/project-timing'
import type { ClashesResponse } from '@/app/api/jobs/[id]/clashes/route'
import type { JobDetail, InstallerUser, JobMessage, AttachmentBucket } from '@/lib/supabase/queries/jobs'
import type { Role, JobStatus, Punctuality } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'
import { ArrowLeft, Bell, Trash2, CheckCircle, Copy, RotateCcw } from 'lucide-react'
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

const formValuesFromJob = (job: JobDetail): FormValues => ({
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
})

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
  initialDesignerIds?:    string[]
  designerOptions?:       Array<{ id: string; label: string }>
  // Addendum §3 — creator's display name, fetched by the page via a
  // follow-up users query. Null for every pre-existing job.
  createdByName?:         string | null
  backHref?:              string
  initialTab?:            'chat'
  // Workflow V3 container core (Task 13) — the nested job's project's own
  // times, fetched server-side by the page (never client-side here). Null
  // for a non-nested job or one whose project has no times of its own.
  projectTimes?:          { time_start: string | null; time_end: string | null } | null
}

export function JobDetailShell({
  job, role, userId, userName, lang, installers, initialMessages, salesPocOptions,
  initialCoordinatorIds = [], coordinatorOptions = [],
  initialDesignerIds = [], designerOptions = [], createdByName = null,
  backHref = '/schedule', initialTab, projectTimes = null,
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

  // Sales suggest installers; only scheduler/admin formally assign them.
  // Smoke feedback edit 8 (Nic explicit, 2026-08-27): coordinator LOSES
  // formal installer assignment — reverses part of Workflow V2 Phase 2
  // (coordinator used to sit in this set alongside scheduler). Every use of
  // `canAssign` in this file is installer/sub-installer specific (formal
  // assign write, grid state, sub bucket) — narrowing it here is enough to
  // demote coordinator to suggest-only everywhere it's read below.
  const isSales       = role === 'sales'
  const isCoordinator = role === 'coordinator'
  const canAssign      = role === 'scheduler'
  // Who may edit the core / team fields (title, dates, POC, coordinators, notes).
  const canEditCore = (['sales', 'scheduler', 'coordinator', 'admin'] as Role[]).includes(role)
  // Edit 6: assigned designers may reopen a completed design themselves —
  // membership mirrors the design-reopen route's own job_designers check.
  // initialDesignerIds (not the possibly-edited selectedDesignerIds) is the
  // source of truth here: a plain designer can't edit that list anyway.
  const isAssignedDesigner = initialDesignerIds.includes(userId)
  // Edit 9: production's attachment buckets go view-only (below).
  const isProduction = role === 'production'

  const [saving,               setSaving]              = useState(false)
  const [status,               setStatus]              = useState<JobStatus>(job.status)

  const readOnly  = completed
  const [clashData,            setClashData]           = useState<ClashesResponse | null>(null)
  // Clash-on-edit of a scheduled job (Workflow V2 Task 19, extended to scheduler)
  const [editClashes,          setEditClashes]         = useState<CheckClash[] | null>(null)
  const pendingValuesRef = useRef<FormValues | null>(null)
  // Due-date-conflict decision made BEFORE the installer clash check (below)
  // ran — carried alongside pendingValuesRef so resumeSaveAfterClash can
  // still apply it once the clash is resolved (Task 14 addendum §1).
  const pendingKeepManualDueRef = useRef(false)
  const [showSuccessModal,     setShowSuccessModal]    = useState(false)
  const [showPushAnywaysModal, setShowPushAnywaysModal]= useState(false)
  const [showDeleteModal,      setShowDeleteModal]     = useState(false)
  const [deleting,             setDeleting]            = useState(false)
  const [showRevertModal,      setShowRevertModal]     = useState(false)
  const [reverting,            setReverting]           = useState(false)
  const [duplicating,          setDuplicating]         = useState(false)
  const [selectedInstallerIds,    setSelectedInstallerIds]   = useState<string[]>(initialAssigneeIds)
  const [suggestedInstallerIds,   setSuggestedInstallerIds]  = useState<string[]>(initialSuggestedIds)
  const [selectedSubIds,          setSelectedSubIds]         = useState<string[]>(initialSubAssignedIds)
  const [suggestedSubIds,         setSuggestedSubIds]        = useState<string[]>(initialSubSuggestedIds)
  const [selectedCoordinatorIds, setSelectedCoordinatorIds] = useState<string[]>(initialCoordinatorIds)
  const [selectedDesignerIds,    setSelectedDesignerIds]    = useState<string[]>(initialDesignerIds)
  const [staleBanner,       setStaleBanner]       = useState(false)
  const [bucketsRefreshKey, setBucketsRefreshKey] = useState(0)
  const [tasksRefreshKey,   setTasksRefreshKey]   = useState(0)
  const suppressUntilRef = useRef(0)
  const forceApplyRef    = useRef(false)
  const dirtyRef         = useRef(false)

  // Design brief card (Task 6) — parent-owned state per the brief's props
  // contract; briefError drives the red field state + phone tab jump below.
  const [briefText,  setBriefText]  = useState(job.design_brief ?? '')
  const [dueDate,    setDueDate]    = useState<string | null>(job.design_due_date ?? null)
  const [dueManual,  setDueManual]  = useState(job.design_due_manual ?? false)
  const [briefError, setBriefError] = useState(false)
  const [jumpToDetails, setJumpToDetails] = useState(0)
  const briefCardRef = useRef<HTMLDivElement>(null)
  // What isBriefDirty's due-date half diffs against. Normally mirrors
  // job.design_due_date, but the server-side auto-shift can compute a
  // due date different from whatever we sent — the moment the PATCH route
  // tells us the actual persisted value, both dueDate AND this baseline move
  // together, so the just-applied shift doesn't itself read as an unsaved
  // edit (which would otherwise re-arm the leave guard and re-enable Save
  // right after a successful save, and — worse — let a second save PATCH the
  // stale pre-shift date back over the server's own shift).
  const [dueDateBaseline, setDueDateBaseline] = useState<string | null>(job.design_due_date ?? null)

  // Design-completed flow (Task 8). `buckets` is AttachmentBuckets' own
  // fetched state, lifted up via onBucketsChange — the designer completion
  // button gates on the real DESIGNER JO bucket's file count this way,
  // without a second, possibly-stale buckets query living in the shell too.
  const [designCompletedAt,       setDesignCompletedAt]       = useState<string | null>(job.design_completed_at ?? null)
  const [buckets,                 setBuckets]                 = useState<AttachmentBucket[]>([])
  const [designSliderOpen,        setDesignSliderOpen]        = useState(false)
  const [designSubmitting,        setDesignSubmitting]        = useState(false)
  const [showDesignCompleteModal, setShowDesignCompleteModal] = useState(false)
  const [designCompleteSubmitting, setDesignCompleteSubmitting] = useState(false)
  const [showDesignReopenModal,   setShowDesignReopenModal]   = useState(false)
  const [designReopening,         setDesignReopening]         = useState(false)

  // Same-save due-date conflict (Task 14 addendum §1). dueEditedThisSession
  // tracks whether the user typed a due date THIS session — vs it merely
  // being loaded from the DB, which must never trigger the prompt. A ref
  // (not state) because it drives a plain condition check, not a render.
  // Reset inside saveDesignBriefFields on a successful save — the single
  // choke point both performSave and handlePushToSchedule funnel through —
  // so the decision is "consumed" for both paths without duplicating the
  // reset.
  const dueEditedThisSessionRef = useRef(false)
  const handleDueDate = (v: string | null) => { setDueDate(v); setDueManual(true); dueEditedThisSessionRef.current = true }
  const handleBriefText = (v: string) => {
    setBriefText(v)
    if (briefError && v.trim().length > 0) setBriefError(false)
  }

  // Static-English date display for the conflict modal — never
  // toLocaleDateString (the /schedule hydration saga; CLAUDE.md hard rule
  // on date labels always being English). Mirrors DesignerBar's fmtDate /
  // NotificationDrawer's fmtOverdueDate.
  const DUE_CONFLICT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const fmtConflictDate = (iso: string): string => {
    const [y, m, d] = iso.split('-')
    return `${+d} ${DUE_CONFLICT_MONTHS[+m - 1]} ${y}`
  }

  // Resolves the keepManualDue flag a save should use. Resolves immediately
  // with false (no modal) unless the trigger condition holds: a due date
  // typed this session AND this save also changes the install date. Keep →
  // true (server skips the auto-shift and keeps the typed date); decline or
  // dismiss (backdrop/X) → false, the safe default — automatic shift wins.
  const [dueConflictPrompt, setDueConflictPrompt] = useState<{ typed: string; shifted: string } | null>(null)
  const dueConflictResolveRef = useRef<((keep: boolean) => void) | null>(null)
  const resolveDueConflict = (newDate: string): Promise<boolean> => {
    if (!dueEditedThisSessionRef.current || dueDate == null || newDate === job.date || dueDateBaseline == null) {
      return Promise.resolve(false)
    }
    // Base the preview on dueDateBaseline (mirrors the DB's current
    // design_due_date), NOT the just-typed `dueDate` — on decline, the
    // route's shift block (byte-identical, above) computes from its own
    // fresh `job.design_due_date` read and overwrites whatever due date the
    // body carried, so shifting from `dueDate` here would preview a number
    // the server would never actually produce. When there's no baseline
    // due date at all, the route's shift block never runs either way
    // (`if (job.design_due_date && ...)`), so keep vs. shift are the same
    // save — the guard above skips the prompt rather than show a false choice.
    const shiftedRaw = addDaysISO(dueDateBaseline, daysBetween(job.date, newDate))
    const today      = todaySGT()
    const shifted    = shiftedRaw < today ? today : shiftedRaw
    return new Promise<boolean>(resolve => {
      dueConflictResolveRef.current = resolve
      setDueConflictPrompt({ typed: dueDate, shifted })
    })
  }
  const settleDueConflict = (keep: boolean) => {
    dueConflictResolveRef.current?.(keep)
    dueConflictResolveRef.current = null
    setDueConflictPrompt(null)
  }

  // Own writes echo back as realtime events; a short window swallows them so
  // the user never sees a banner for their own save.
  const bumpSuppression = () => { suppressUntilRef.current = Date.now() + 5000 }

  const {
    register, handleSubmit, getValues, setValue, reset, control, watch,
    formState: { isDirty, errors },
  } = useForm<FormValues>({
    defaultValues: formValuesFromJob(job),
  })

  const saveValues = async (values: FormValues) => {
    // Workflow V3 container core (Task 13) — a nested job (job.project_id
    // set) that gets its own time fields cleared falls back to its
    // project's time (time_inherited: true) instead of saving as blank; a
    // non-nested job (project_id null) is untouched — timingOnJobTimeEdit
    // with isNested=false returns newStart/newEnd unchanged, so this is a
    // no-op for every job outside a project (time_inherited: false is a new
    // column write, but the values saved are byte-identical to before).
    const timing = timingOnJobTimeEdit(
      values.time_start || null,
      values.time_end   || null,
      !!job.project_id,
      projectTimes,
    )
    await supabase.from('jobs').update({
      project_title:           values.project_title || null,
      date:                    values.date,
      date_end:                values.date_end || null,
      time_start:              timing.time_start,
      time_end:                timing.time_end,
      time_inherited:          timing.time_inherited,
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
    bumpSuppression()
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

  // Design brief fields + due-date auto-shift (Task 6). Shared by performSave
  // AND handlePushToSchedule — both write `date` and both must persist the
  // brief. Callers must run this BEFORE any local jobs.update() of their own
  // that also touches `date` — the route reads the job's CURRENT `date` and
  // `design_due_date` from the database to compute the shift delta, so it has
  // to see the pre-save row. Telegram needs the server-only bot token, so
  // this can't be a plain client-side jobs.update() like the rest of this
  // form's fields.
  //
  // Applies the response's design_due_date back into local state (and its
  // dirty-diff baseline) — the auto-shift can compute a due date different
  // from whatever we sent, and skipping this would (a) leave the shift
  // invisible in the UI until the next full reload and (b) let a second save
  // PATCH the stale pre-shift date straight back over the server's shift.
  const saveDesignBriefFields = async (
    newDate: string,
    opts: { keepManualDue?: boolean } = {},
  ): Promise<void> => {
    const designRes = await fetch(`/api/jobs/${job.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        design_brief:      briefText || null,
        design_due_date:   dueDate,
        design_due_manual: dueManual,
        ...(newDate !== job.date ? { date: newDate } : {}),
        ...(opts.keepManualDue ? { keepManualDue: true } : {}),
      }),
    })
    if (!designRes.ok) throw new Error()
    const { design_due_date } = await designRes.json() as { ok: boolean; design_due_date: string | null }
    setDueDate(design_due_date)
    setDueDateBaseline(design_due_date)
    // The due-conflict decision (if any) is consumed on a successful save —
    // a later save with no further due-date edits must not re-prompt.
    dueEditedThisSessionRef.current = false
  }

  const performSave = async (values: FormValues, keepManualDue = false) => {
    bumpSuppression()
    setSaving(true)
    try {
      if (isBriefDirty || values.date !== job.date) {
        await saveDesignBriefFields(values.date, { keepManualDue })
      }

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

      // Design-team assignment (sales / scheduler / coordinator / admin).
      // Unlike coordinators, this has a dedicated route — it diffs against
      // job_designers itself and notifies newly added designers (bell +
      // Telegram), so no separate notify call is needed here. Gated on
      // canEditCore too: the route 403s for roles that can't edit the list
      // (designer / production), and their selection never changes anyway.
      if (canEditCore && isDesignerDirty) {
        const res = await fetch(`/api/jobs/${job.id}/designers`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ userIds: selectedDesignerIds }),
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
  // Phase 1). Scheduler saves are checked for both an installer change and a
  // time change; coordinator (edit 8: suggest-only, can no longer touch the
  // formal installer list) is still checked when THEY move the job's time —
  // that can double-book the already-assigned installers regardless of who
  // assigned them. Coordinator can alert the schedulers via the modal;
  // scheduler can save anyway.
  const onSubmit = async (values: FormValues) => {
    // Smoke feedback edit 1 (Nic, 2026-08-27): scheduler bypasses the brief-
    // required rule entirely — the habit nudge is aimed at sales/coordinator,
    // who stay forced. `role` is already the effective role (getEffectiveRole
    // never returns 'admin' — admin previewing as scheduler is covered too;
    // admin with no override defaults to 'scheduler' as well).
    // Push-to-schedule (below) never needs the same guard: it only runs while
    // `status` is still 'pending', and briefRequiredError already exempts any
    // non-'scheduled' status — so it's a no-op there for every role already.
    const briefBlocked = role !== 'scheduler' && briefRequiredError({
      isNewJob:      false,
      status,
      designerCount: selectedDesignerIds.length,
      briefText,
    })
    if (briefBlocked) {
      setBriefError(true)
      setJumpToDetails(n => n + 1)   // phone: the Details tab holds the card
      showError(t(lang, 'designBriefRequired'))
      requestAnimationFrame(() => briefCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }

    // Same-save due-date conflict (Task 14 addendum §1) — detected before
    // ANY save path runs (including the installer clash check below), so
    // whichever branch eventually calls performSave already has the
    // decision. Resolves instantly with false when the trigger condition
    // isn't met — no modal, no behaviour change.
    const keepManualDue = await resolveDueConflict(values.date)

    const timeChanged =
      values.date        !== (job.date ?? '') ||
      values.time_start  !== (job.time_start?.slice(0, 5) ?? '') ||
      values.time_end    !== (job.time_end?.slice(0, 5) ?? '') ||
      values.punctuality !== job.punctuality

    // canAssign is scheduler-only since edit 8, so the installer-dirty half
    // of this check is scheduler-only too (a coordinator's save can never
    // dirty the formal installer list — their grid interactions write
    // suggestions instead). But the TIME-change half is NOT assignment-
    // gated: coordinator can still edit date/time on a scheduled job
    // (canEditCore), and moving the time can double-book installers who are
    // already formally assigned, regardless of who assigned them or who's
    // saving now. So coordinator still gets the checkOnly pre-flight (and
    // EditClashModal's "Alert Scheduler & Save" / "Re-assign" branch is
    // reachable for them again) on a time change; assign-installers' route
    // gate keeps the checkOnly branch readable for coordinator while the
    // write branch (below, in performSave) stays scheduler/admin-only —
    // see that route for the exact ordering.
    const needsCheck =
      status === 'scheduled' && selectedInstallerIds.length > 0 &&
      ((canAssign && isInstallerDirty) || ((canAssign || isCoordinator) && timeChanged))

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
            pendingKeepManualDueRef.current = keepManualDue
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

    await performSave(values, keepManualDue)
  }

  const resumeSaveAfterClash = async (alertSchedulers: boolean) => {
    const values         = pendingValuesRef.current
    const keepManualDue  = pendingKeepManualDueRef.current
    const names  = [...new Set((editClashes ?? []).map(c => c.installerName).filter(Boolean))]
    setEditClashes(null)
    pendingValuesRef.current = null
    pendingKeepManualDueRef.current = false
    if (!values) return
    if (alertSchedulers) {
      // Best-effort — the save must not fail because a Telegram send did.
      fetch(`/api/jobs/${job.id}/notify-clash`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ clashNames: names }),
      }).catch(() => {})
    }
    await performSave(values, keepManualDue)
  }

  const handleStatusChange = async (newStatus: JobStatus, newDate?: string) => {
    bumpSuppression()
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

  // Undo an accidental completion: server route (RLS blocks sales/designer
  // from updating completed jobs client-side) puts the job back on the
  // schedule and keeps its original FCFS rank. router.refresh() re-renders
  // the server component so the form unlocks without a manual reload.
  const handleRevertComplete = async () => {
    setReverting(true)
    bumpSuppression()
    try {
      const res = await fetch(`/api/jobs/${job.id}/revert-complete`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setStatus('scheduled')
      setShowRevertModal(false)
      showSuccess(t(lang, 'savedSuccessfully'))
      router.refresh()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setReverting(false)
    }
  }

  // Reads a JSON { error } body off a failed response, if there is one —
  // used to turn a 409 no-jo-file into the same hint text as the disabled
  // button, instead of the generic save-failed toast.
  const errorCodeOf = async (res: Response): Promise<string | null> => {
    try {
      const body = await res.json() as { error?: string }
      return body.error ?? null
    } catch {
      return null
    }
  }

  // Designer path: POSTs the confirmed rating from the inline slider panel.
  const handleDesignComplete = async (rating: number) => {
    setDesignSubmitting(true)
    bumpSuppression()
    try {
      const res = await fetch(`/api/jobs/${job.id}/design-complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rating }),
      })
      if (!res.ok) {
        if (res.status === 409 && await errorCodeOf(res) === 'no-jo-file') {
          showError(t(lang, 'designCompletedNeedsJo'))
          return
        }
        throw new Error()
      }
      setDesignCompletedAt(new Date().toISOString())
      setDesignSliderOpen(false)
      showSuccess(t(lang, 'savedSuccessfully'))
      router.refresh()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setDesignSubmitting(false)
    }
  }

  // Scheduler/admin override path — no rating, straight confirm.
  const handleDesignCompleteOverride = async () => {
    setDesignCompleteSubmitting(true)
    bumpSuppression()
    try {
      const res = await fetch(`/api/jobs/${job.id}/design-complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({}),
      })
      if (!res.ok) {
        if (res.status === 409 && await errorCodeOf(res) === 'no-jo-file') {
          showError(t(lang, 'designCompletedNeedsJo'))
          setShowDesignCompleteModal(false)
          return
        }
        throw new Error()
      }
      setDesignCompletedAt(new Date().toISOString())
      setShowDesignCompleteModal(false)
      showSuccess(t(lang, 'savedSuccessfully'))
      router.refresh()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setDesignCompleteSubmitting(false)
    }
  }

  // Scheduler/admin only — clears the completion + rating, job reappears on
  // the Design Load board (design_completed_at is null there).
  const handleDesignReopen = async () => {
    setDesignReopening(true)
    bumpSuppression()
    try {
      const res = await fetch(`/api/jobs/${job.id}/design-reopen`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setDesignCompletedAt(null)
      setShowDesignReopenModal(false)
      showSuccess(t(lang, 'savedSuccessfully'))
      router.refresh()
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setDesignReopening(false)
    }
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json() as { id: string; skippedFiles: number }
      showSuccess(data.skippedFiles > 0
        ? `${t(lang, 'duplicateSuccess')} (${data.skippedFiles} file(s) skipped)`
        : t(lang, 'duplicateSuccess'))
      router.push(`/jobs/${data.id}`)
    } catch {
      showError(t(lang, 'saveError'))
      setDuplicating(false)
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
    // Same due-date-conflict detection as onSubmit, before touching saving
    // state — this path shares saveDesignBriefFields (Task 14 addendum §1).
    const pushDate       = getValues().date
    const keepManualDue  = await resolveDueConflict(pushDate)

    bumpSuppression()
    setSaving(true)
    try {
      // Same design-brief persistence + auto-shift performSave gets — this
      // path also writes `date` (below, via saveValues) and previously
      // skipped both entirely (react-hook-form's isDirty knows nothing about
      // briefText/dueDate/dueManual, which live outside the form).
      if (isBriefDirty || pushDate !== job.date) await saveDesignBriefFields(pushDate, { keepManualDue })
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
    bumpSuppression()
    try {
      for (const [oldId, newId] of Object.entries(replacements)) {
        if (newId === 'keep') continue
        await supabase.from('job_assignees').delete().eq('job_id', job.id).eq('user_id', oldId)
        // Edit 8: coordinator substitutes as a suggestion too, same as sales
        // — /api/jobs/[id]/clashes (above) doesn't filter is_suggestion, so
        // this same substitute flow already ran for sales' suggested picks
        // pre-edit-8; coordinator now gets the identical suggest-only write.
        await supabase.from('job_assignees').insert({
          job_id: job.id, user_id: newId,
          is_suggestion: isSales || isCoordinator, suggested_by: (isSales || isCoordinator) ? userId : null,
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
    bumpSuppression()
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
  // Coordinator gains sales-level delete on pending jobs only (Addendum §2) —
  // scheduled-job behaviour for coordinator is unchanged (still no delete;
  // that's scheduler-only). NOTE: sales' delete likely silently no-ops today
  // (no jobs DELETE RLS policy for sales — the DELETE call returns ok with
  // zero rows affected rather than an error). Coordinator inherits that same
  // pre-existing gap by parity; not fixed here (out of scope, RLS-level).
  const showDelete         = (['sales', 'coordinator'].includes(role) && status === 'pending') || role === 'scheduler'
  const showMarkComplete   = role === 'scheduler' && status === 'scheduled'
  const originalSalesPocId = job.sales_poc_id ?? ''

  // Design-completed flow (Task 8). hasJoFile mirrors the route's own
  // `ilike '%designer jo%'` + files-count check, so the button's disabled
  // state and the server's 409 always agree.
  const joBucket = buckets.find(b => /designer\s*jo/i.test(b.name))
  const hasJoFile = !!joBucket && joBucket.files.length > 0
  // Smoke feedback edit 13 (Nic, 2026-08-28): sales/coordinator join the
  // override allow-list — they complete on the designer's behalf after
  // client confirmation (e.g. sales uploads the confirmed JO). No rating is
  // ever written on this path (route-enforced); buttons below sit in the
  // shared top action row, rendered for every non-installer role, so no
  // extra placement wiring is needed beyond this flag.
  const canOverrideDesign = (['scheduler', 'sales', 'coordinator'] as Role[]).includes(role)   // effective role — covers admin (getEffectiveRole never returns 'admin' itself)

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

  const isCoordDirty = useMemo(() => {
    const a = new Set(selectedCoordinatorIds)
    const b = new Set(initialCoordinatorIds)
    if (a.size !== b.size) return true
    for (const id of a) if (!b.has(id)) return true
    return false
  }, [selectedCoordinatorIds, initialCoordinatorIds])

  const isDesignerDirty = useMemo(() => {
    const a = new Set(selectedDesignerIds)
    const b = new Set(initialDesignerIds)
    if (a.size !== b.size) return true
    for (const id of a) if (!b.has(id)) return true
    return false
  }, [selectedDesignerIds, initialDesignerIds])

  const isBriefDirty =
    briefText  !== (job.design_brief ?? '') ||
    dueDate    !== dueDateBaseline ||
    dueManual  !== (job.design_due_manual ?? false)

  const isAnyDirty = isDirty || isInstallerDirty || isSubDirty || isCoordDirty || isDesignerDirty || isBriefDirty
  dirtyRef.current = isAnyDirty

  // Leave guard (Task 6): native "leave page?" prompt on refresh/close while
  // anything is unsaved. The in-app back arrow already goes through
  // router.back() untouched — this only covers refresh/close, per spec.
  useEffect(() => {
    if (!isAnyDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isAnyDirty])

  // Live updates for this job. Hybrid rule ("clean syncs, dirty warns"):
  // section data (files, tasks, team) applies silently — it never collides
  // with typing; a jobs-row change only applies silently when the form has
  // no unsaved edits, otherwise the amber banner offers an explicit reload.
  const handleLiveEvent = (payload: LivePayload) => {
    if (Date.now() < suppressUntilRef.current) return
    const row = (payload.new ?? payload.old) as { kind?: string; bucket_id?: string | null } | null
    if (payload.table === 'files') {
      if (row?.kind === 'attachment' && !row?.bucket_id) return   // chat's domain (ChatSection handles)
      if (row?.bucket_id) { setBucketsRefreshKey(k => k + 1); return }
      router.refresh()                                            // production / DO / completion photos (prop-driven)
      return
    }
    if (payload.table === 'job_tasks')     { setTasksRefreshKey(k => k + 1); return }
    if (payload.table === 'job_assignees') { router.refresh(); return }
    // jobs row — typed fields + status
    if (dirtyRef.current) setStaleBanner(true)
    else router.refresh()
  }

  useLiveChannel({
    name:   `job-form-live-${job.id}`,
    tables: [
      { table: 'jobs',          event: 'UPDATE', filter: `id=eq.${job.id}` },
      { table: 'job_assignees',                  filter: `job_id=eq.${job.id}` },
      { table: 'job_tasks',                      filter: `job_id=eq.${job.id}` },
      { table: 'files',                          filter: `job_id=eq.${job.id}` },
    ],
    onEvent: handleLiveEvent,
  })

  // router.refresh() delivers a fresh `job` prop, but react-hook-form and the
  // selection states only read it at mount. Re-baseline whenever fresh data
  // arrives AND nothing is dirty (or the banner tap forced it). This also runs
  // after the user's own save — keeping the assignment baselines honest.
  const firstJobApply = useRef(true)
  useEffect(() => {
    if (firstJobApply.current) { firstJobApply.current = false; return }
    if (dirtyRef.current && !forceApplyRef.current) return
    forceApplyRef.current = false
    reset(formValuesFromJob(job))
    setStatus(job.status)
    setSelectedInstallerIds(job.job_assignees.filter(a => !a.is_suggestion && !a.is_sub_installer).map(a => a.user_id))
    setSuggestedInstallerIds(job.job_assignees.filter(a => a.is_suggestion && !a.is_sub_installer).map(a => a.user_id))
    setSelectedSubIds(job.job_assignees.filter(a => !a.is_suggestion && a.is_sub_installer).map(a => a.user_id))
    setSuggestedSubIds(job.job_assignees.filter(a => a.is_suggestion && a.is_sub_installer).map(a => a.user_id))
    setSelectedCoordinatorIds(initialCoordinatorIds)
    setSelectedDesignerIds(initialDesignerIds)
    setBriefText(job.design_brief ?? '')
    setDueDate(job.design_due_date ?? null)
    setDueDateBaseline(job.design_due_date ?? null)
    setDueManual(job.design_due_manual ?? false)
    setBriefError(false)
    setStaleBanner(false)
    setDesignCompletedAt(job.design_completed_at ?? null)
  }, [job])  // eslint-disable-line react-hooks/exhaustive-deps

  // Banner tap — the only path that discards unsaved edits, and it's explicit.
  const reloadFresh = () => {
    forceApplyRef.current = true
    router.refresh()
  }

  // ── Installer grid: per-role behaviour ──────────────────────────────────────
  const toggleFormal = (id: string) =>
    setSelectedInstallerIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const salesCanSuggest = isSales && !readOnly && status !== 'scheduled'
  // Coordinator suggests at ANY job status (edit 8) — unlike sales, whose
  // suggest window closes once a job is scheduled, coordinator stays active
  // on scheduled jobs (Addendum §2's "Save & notify" bar), just downgraded
  // from formally assigning to suggesting only.
  const coordinatorCanSuggest = isCoordinator && !readOnly

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
    canAssign && !readOnly                        ? toggleFormal :
    (salesCanSuggest || coordinatorCanSuggest)     ? toggleSuggestion :
    undefined

  // Sales/coordinator cannot un-assign a formally assigned installer — only
  // their own suggestions (edit 8 extends this lock to coordinator).
  const installerDisabledOf = (isSales || isCoordinator) ? (id: string) => initialAssigneeIds.includes(id) : undefined

  const installerNoteOf = (id: string): string | null => {
    if (canAssign) {
      return (initialSuggestedIds.includes(id) && !selectedInstallerIds.includes(id)) ? 'Suggested' : null
    }
    if (isSales || isCoordinator) return suggestedInstallerIds.includes(id) ? 'You suggested' : null
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
    canAssign && !readOnly                    ? toggleSubFormal :
    (salesCanSuggest || coordinatorCanSuggest) ? toggleSubSuggestion :
    undefined

  // Sales/coordinator cannot un-assign a confirmed sub — only their own suggestions.
  const subDisabledOf = (isSales || isCoordinator) ? (id: string) => initialSubAssignedIds.includes(id) : undefined

  const subNoteOf = (id: string): string | null => {
    if (canAssign) {
      return (initialSubSuggestedIds.includes(id) && !selectedSubIds.includes(id)) ? 'Suggested' : null
    }
    if (isSales || isCoordinator) return suggestedSubIds.includes(id) ? 'You suggested' : null
    return null
  }

  // Sub pool = everyone not already engaged on the main grid (mockup rule:
  // main picks disappear from the sub bucket to prevent double assignment).
  const mainEngagedIds = new Set(
    canAssign
      ? [...selectedInstallerIds, ...initialSuggestedIds]
      : [...initialAssigneeIds, ...((isSales || isCoordinator) ? suggestedInstallerIds : initialSuggestedIds)],
  )
  const subPool = installers.filter(i => !mainEngagedIds.has(i.id))

  const subCount = canAssign
    ? new Set([...selectedSubIds, ...initialSubSuggestedIds]).size
    : (isSales || isCoordinator)
      ? new Set([...initialSubAssignedIds, ...suggestedSubIds]).size
      : initialSubAssignedIds.length

  const subBucketDefaultOpen =
    initialSubAssignedIds.length + initialSubSuggestedIds.length > 0

  // "Remove" — clear this role's sub picks; assigners persist on Save & notify.
  const clearSubs = () => {
    if (canAssign) {
      setSelectedSubIds([])
    } else if (salesCanSuggest || coordinatorCanSuggest) {
      for (const id of [...suggestedSubIds]) void toggleSubSuggestion(id)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-28">

      <CompanyBar lang={lang} />

      {staleBanner && (
        <button
          type="button"
          onClick={reloadFresh}
          className="sticky top-[45px] z-40 w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-amber-soft border-b border-brand-amber/40 text-xs font-semibold text-brand-amber"
        >
          <Bell size={12} />
          {t(lang, 'jobUpdatedBanner')} — {t(lang, 'jobUpdatedReload')}
        </button>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-5 pb-1">
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

      <JobFormLayout
        lang={lang}
        initialTab={initialTab}
        jumpToDetails={jumpToDetails}
        details={
          <div className="flex flex-col gap-4">
            <CollapseCard title={t(lang, 'jobDetails')} storageKey="gq-jobcard-details">
              {createdByName && (
                <p className="text-xs text-muted mb-3">{t(lang, 'createdByLabel')} {createdByName}</p>
              )}
              <CoreSection
                bare
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
            </CollapseCard>
            {!isInstaller && (
              <DesignBriefSection
                ref={briefCardRef}
                jobId={job.id}
                lang={lang}
                readOnly={readOnly}
                canManage={canEditCore}
                userId={userId}
                briefText={briefText}
                onBriefText={handleBriefText}
                dueDate={dueDate}
                dueManual={dueManual}
                onDueDate={handleDueDate}
                briefError={briefError}
                files={job.files.filter(f => f.kind === 'design_brief')}
                designerOptions={designerOptions}
                selectedDesignerIds={selectedDesignerIds}
                onToggleDesigner={id => setSelectedDesignerIds(prev =>
                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
                )}
              />
            )}
            <CollapseCard title={t(lang, 'productionReadyInstructions')} storageKey="gq-jobcard-production">
              <ProductionReadySection
                bare
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
            </CollapseCard>
          </div>
        }
        team={
          <div className="flex flex-col gap-4">
        {/* ── Team card ───────────────────────────────────────────── */}
        <CollapseCard title={t(lang, 'tabTeam')} storageKey="gq-jobcard-team" bodyClassName="p-0">
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
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">Installers</p>
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

          {/* Designers grid moved into the Design Brief card, Details tab, for
              every role that can reach that card (edit 14, smoke feedback
              2026-08-28) — see DesignBriefSection. selectedDesignerIds/
              setSelectedDesignerIds still live here; the brief card just
              hosts DesignerGrid via props now. installer NEVER sees the
              brief card at all (`{!isInstaller && <DesignBriefSection/>}`
              a few screens up, unrelated to this edit) — they used to see
              this same grid read-only right here in the Team tab, so that
              one carve-out stays put to avoid regressing their view. */}
          {isInstaller && (
            <div className="border-t border-line px-4 pt-3 pb-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-3">{t(lang, 'designersLabel')}</p>
              {designerOptions.length === 0 ? (
                <p className="text-sm text-muted">{t(lang, 'noDesigners')}</p>
              ) : (
                <DesignerGrid designers={designerOptions} selectedIds={selectedDesignerIds} />
              )}
            </div>
          )}

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
              canEdit={(canAssign && !readOnly) || salesCanSuggest || coordinatorCanSuggest}
            />
          )}

          {/* External installer bucket (Phase 4) — every office role sees it;
              managers assign, sales suggest, designer/production view-only */}
          {!isInstaller && (
            <ExternalPOCBucket jobId={job.id} lang={lang} role={role} readOnly={readOnly} />
          )}
        </CollapseCard>

        {/* ── Notifications placeholder (non-installer only) ────────  */}
        {!isInstaller && (
          <CollapseCard title="Notifications" storageKey="gq-jobcard-notifications" bodyClassName="p-0">
            <div className="px-4 py-5 flex flex-col items-center gap-2 text-center">
              <Bell size={20} className="text-line" />
              <p className="text-sm font-medium text-ink2">Coming soon</p>
              <p className="text-xs text-muted">Telegram notification tracker</p>
            </div>
          </CollapseCard>
        )}
          </div>
        }
        files={
          <div className="flex flex-col gap-4">
            <CollapseCard title={t(lang, 'attachments')} storageKey="gq-jobcard-attachments">
              {/* Designers get FULL Files access here — uploads, URL links,
                  add bucket — identical to sales (Task 8, 2026-08-26). No
                  designer-specific readOnly flag: `completed` (job status),
                  `isInstaller`, and (edit 9, 2026-08-27) `isProduction` are
                  the gates — production is view/download-only here; their
                  separate ProductionReadySection (production photos etc.)
                  stays fully editable, untouched by this flag. The Designer
                  JO bucket's own rename/delete controls are protected for
                  every role inside AttachmentBuckets itself. */}
              <AttachmentBuckets
                jobId={job.id}
                userId={userId}
                lang={lang}
                readOnly={readOnly || isInstaller || isProduction}
                refreshKey={bucketsRefreshKey}
                onBucketsChange={setBuckets}
              />
            </CollapseCard>
            <TaskListSection
              jobId={job.id}
              role={role}
              lang={lang}
              readOnly={readOnly}
              refreshKey={tasksRefreshKey}
            />
          </div>
        }
        chat={
          <ChatSection
            jobId={job.id}
            userId={userId}
            userName={userName}
            lang={lang}
            completedAt={job.completed_at}
            initialMessages={initialMessages}
            chatFiles={job.files.filter(f => f.kind === 'attachment' && !f.bucket_id)}
            preScheduleLocked={status === 'pending' || status === 'awaiting_approval'}
          />
        }
      />

      {/* ── Action bar (sticky bottom) ───────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-line px-4 py-3 z-10">
        <div className="max-w-2xl lg:max-w-6xl mx-auto space-y-2">
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
                {completed && (
                  <button
                    type="button"
                    onClick={() => setShowRevertModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors"
                  >
                    <RotateCcw size={12} />
                    {t(lang, 'revertJob')}
                  </button>
                )}
                {canOverrideDesign && initialDesignerIds.length > 0 && !designCompletedAt && (
                  <button
                    type="button"
                    onClick={() => setShowDesignCompleteModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors"
                  >
                    <CheckCircle size={12} />
                    {t(lang, 'designCompletedBtn')}
                  </button>
                )}
                {canOverrideDesign && designCompletedAt && (
                  <button
                    type="button"
                    onClick={() => setShowDesignReopenModal(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors"
                  >
                    <RotateCcw size={12} />
                    {t(lang, 'designReopenBtn')}
                  </button>
                )}
                {canEditCore && (
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    disabled={duplicating}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-line bg-paper text-xs font-medium text-ink2 hover:bg-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Copy size={12} />
                    {duplicating ? '…' : t(lang, 'duplicateJob')}
                  </button>
                )}
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
              {readOnly ? null : role === 'designer' ? (
                <div>
                  {/* Inline rating panel — height-animated, stays inside this
                      sticky action-bar container so it layers above BottomNav
                      (z-50) without a modal/popup (Nic, 2026-08-26). */}
                  <div className={cn(
                    'overflow-hidden transition-[max-height] duration-300 ease-in-out',
                    designSliderOpen ? 'max-h-[240px]' : 'max-h-0',
                  )}>
                    <DesignRatingSlider
                      lang={lang}
                      busy={designSubmitting}
                      onCancel={() => setDesignSliderOpen(false)}
                      onConfirm={handleDesignComplete}
                    />
                  </div>
                  {!designSliderOpen && (
                    designCompletedAt ? (
                      <div className="flex gap-2">
                        <div className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-[10px] bg-brand-green-soft text-brand-green text-sm font-semibold">
                          {t(lang, 'designCompletedDone')}
                        </div>
                        {/* Edit 6 (Nic, 2026-08-27): the ASSIGNED designer may
                            also reopen (last-minute artwork changes) — mirrors
                            scheduler/admin's reopen button above, same modal +
                            handler. Reopen always clears the rating; re-
                            completing re-rates fresh (unchanged). */}
                        {isAssignedDesigner && (
                          <button
                            type="button"
                            onClick={() => setShowDesignReopenModal(true)}
                            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-[10px] border border-line bg-paper text-sm font-medium text-ink2 hover:bg-bg transition-colors"
                          >
                            <RotateCcw size={14} />
                            {t(lang, 'designReopenBtn')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setDesignSliderOpen(true)}
                          disabled={!hasJoFile}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[10px] bg-brand-green text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {t(lang, 'designCompletedBtn')}
                        </button>
                        {!hasJoFile && (
                          <p className="text-center text-xs text-muted mt-1.5">{t(lang, 'designCompletedNeedsJo')}</p>
                        )}
                      </>
                    )
                  )}
                </div>
              ) : (role === 'sales' || (role === 'coordinator' && status !== 'scheduled')) ? (
                // Addendum §2: coordinator gets the sales pending bar (Save
                // Changes / Push to Schedule) on pending/awaiting_approval
                // jobs only — status !== 'scheduled' above hands scheduled
                // jobs to the else-branch below. That branch's label is now
                // canAssign-driven ("Save & notify" vs "Save Changes"), and
                // canAssign is scheduler-only since edit 8 — so a coordinator
                // on a SCHEDULED job now sees "Save Changes" there too (no
                // installer-assignment semantics implied), even though the
                // rest of that bar (core fields, coordinators, designers)
                // still saves normally for them.
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit(onSubmit)}
                    disabled={saving || (!isDirty && !isInstallerDirty && !isCoordDirty && !isDesignerDirty && !isBriefDirty)}
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
                  disabled={saving || (!isDirty && !isInstallerDirty && !isSubDirty && !isCoordDirty && !isDesignerDirty && !isBriefDirty)}
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
        onClose={() => { setEditClashes(null); pendingValuesRef.current = null; pendingKeepManualDueRef.current = false }}
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

      <Modal isOpen={showRevertModal} onClose={() => setShowRevertModal(false)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'revertJobConfirmTitle')}
          </h2>
          <p className="text-sm text-muted">{t(lang, 'revertJobConfirmBody')}</p>
          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => setShowRevertModal(false)} disabled={reverting}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleRevertComplete} disabled={reverting}>
              {reverting ? t(lang, 'loading') : t(lang, 'revertJob')}
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDesignCompleteModal} onClose={() => setShowDesignCompleteModal(false)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'designCompleteConfirmTitle')}
          </h2>
          <p className="text-sm text-muted">{t(lang, 'designCompleteConfirmBody')}</p>
          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => setShowDesignCompleteModal(false)} disabled={designCompleteSubmitting}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleDesignCompleteOverride} disabled={designCompleteSubmitting}>
              {designCompleteSubmitting ? t(lang, 'loading') : t(lang, 'confirm')}
            </Btn>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showDesignReopenModal} onClose={() => setShowDesignReopenModal(false)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'designReopenConfirmTitle')}
          </h2>
          <p className="text-sm text-muted">{t(lang, 'designReopenConfirmBody')}</p>
          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => setShowDesignReopenModal(false)} disabled={designReopening}>
              {t(lang, 'cancel')}
            </Btn>
            <Btn variant="primary" size="sm" onClick={handleDesignReopen} disabled={designReopening}>
              {designReopening ? t(lang, 'loading') : t(lang, 'designReopenBtn')}
            </Btn>
          </div>
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

      {/* Same-save due-date conflict (Task 14 addendum §1). Dismiss (X /
          backdrop) resolves via Modal's onClose — routed to "use shifted",
          the safe default per Nic ("if no, automatic wins"). */}
      <Modal isOpen={!!dueConflictPrompt} onClose={() => settleDueConflict(false)}>
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-ink">
            {t(lang, 'dueConflictTitle')}
          </h2>
          <p className="text-sm text-muted">
            {dueConflictPrompt && t(lang, 'dueConflictBody')
              .replace('{typed}', fmtConflictDate(dueConflictPrompt.typed))
              .replace('{shifted}', fmtConflictDate(dueConflictPrompt.shifted))}
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <Btn variant="secondary" size="sm" onClick={() => settleDueConflict(false)}>
              {t(lang, 'dueConflictShift')}
            </Btn>
            <Btn variant="primary" size="sm" onClick={() => settleDueConflict(true)}>
              {t(lang, 'dueConflictKeep')}
            </Btn>
          </div>
        </div>
      </Modal>

    </div>
  )
}
