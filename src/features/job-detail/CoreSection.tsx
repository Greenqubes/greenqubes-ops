'use client'

import { useState, useEffect, useRef } from 'react'
import { Phone, MapPin } from 'lucide-react'
import { UseFormRegister, FieldErrors, Control, Controller, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { SuggestField } from '@/components/SuggestField'
import { SearchableSelect, SelectOption } from '@/components/SearchableSelect'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { TimeSelect } from './TimeSelect'
import { LocationInput } from './LocationInput'
import { useTranslateText } from './useTranslateText'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import { extractDialNumber, mapsSearchUrl, endDateBeforeStart, canTickProductionFlags, type RequiredJobField } from '@/lib/utils/job-form-rules'
import { phoneAfterPick, sameName, type ClientPerson, type LastNumber, type PhoneHint } from '@/lib/utils/client-phone'
import { formatDate } from '@/lib/telegram/templates'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'
import type { Role } from '@/lib/supabase/types'

// Roles that may edit the core job fields (title, date, client, location, times, punctuality)
const CORE_EDIT_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']
// Who may tick "Production ready" / "DO issued" now lives in job-form-rules
// as canTickProductionFlags — sales joined on 2026-09-15, but only on jobs
// where they are the Person-in-Charge, so the answer needs more than the role.

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

interface Props {
  register:          UseFormRegister<FormValues>
  errors:            FieldErrors<FormValues>
  control:           Control<FormValues>
  watch:             UseFormWatch<FormValues>
  setValue:          UseFormSetValue<FormValues>
  readOnly:          boolean
  lang:              LangCode
  role:              Role
  /** Fields the last Push to Schedule found empty — each shows a red
   *  "* This field is required" beside its title until it is filled. */
  missingFields?:    RequiredJobField[]
  installerView?:    boolean
  bare?:             boolean
  /** Address the job was duplicated from — offered under an empty Location
   *  box as a one-tap fill (Nic, 2026-09-15). Null when not a fresh copy. */
  previousLocation?:          string | null
  onUsePreviousLocation?:     () => void
  onDismissPreviousLocation?: () => void
  /** Is the signed-in person this job's Person-in-Charge? Sales may tick
   *  "Production ready" / "DO issued" only on their own jobs (Nic,
   *  2026-09-15). Every other role ignores it. */
  isSalesPoc?:       boolean
  /** The job being edited (absent on New Job) — its own saved number is not
   *  "the client's last job" when a Client Name is picked. */
  jobId?:            string
}

// Frame for the section body: the page's CollapseCard supplies the card
// chrome when `bare`; standalone use keeps the original Card. Module-level
// so the frame's identity is stable and inputs never remount.
function CoreFrame({ bare, children }: { bare: boolean; children: React.ReactNode }) {
  return bare
    ? <div className="space-y-4">{children}</div>
    : <Card className="p-5 space-y-4">{children}</Card>
}

export function CoreSection({
  register, errors, control, watch, setValue,
  readOnly, lang, role, missingFields = [], installerView = false, bare = false,
  previousLocation = null, onUsePreviousLocation, onDismissPreviousLocation,
  isSalesPoc = false, jobId,
}: Props) {
  // A field's red message clears the moment it is filled, without waiting for
  // another push — so the form stops nagging as soon as it is satisfied.
  const isMissing = (field: RequiredJobField) =>
    missingFields.includes(field) && !(watch(field) ?? '').trim()
  const requiredMsg = (field: RequiredJobField) =>
    isMissing(field) ? t(lang, 'requiredField') : undefined

  // Translate the description into the viewer's profile language — every
  // role, read-only views included; never written back (Nic, 2026-09-28).
  const descriptionTranslate = useTranslateText(watch('description') ?? '', lang)

  // Designer / production see the core fields but cannot edit them.
  const coreLocked       = readOnly || !CORE_EDIT_ROLES.includes(role)
  // Production may still tick production-ready / DO even though the rest of
  // core is locked for them; sales may tick only on their own jobs.
  const flagsLocked      = !canTickProductionFlags({ role, isSalesPoc, readOnly })

  const [companies,        setCompanies]        = useState<SelectOption[]>([])
  const [contacts,         setContacts]         = useState<SelectOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [deleteTarget,     setDeleteTarget]     = useState<{ id: string; label: string } | null>(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const pendingResolve = useRef<((v: boolean) => void) | null>(null)

  // Client Contact No. auto-fill (Nic, 2026-10-27/30) — the rules live in
  // client-phone.ts. `prevPerson` remembers whose number the box holds once
  // the Client Name has been emptied: changing the company empties it, and
  // that still counts as switching person. `phoneLookup` drops an answer
  // that a later pick has overtaken.
  const [phoneHint, setPhoneHint] = useState<PhoneHint | null>(null)
  const prevPerson  = useRef<ClientPerson | null>(null)
  const phoneLookup = useRef(0)
  const phoneReg    = register('client_poc_phone')

  const dateValue    = watch('date')
  const dateEndValue = watch('date_end')
  const timeStart    = watch('time_start')
  const phoneValue   = watch('client_poc_phone')
  const dateDisplay = dateValue
    ? new Date(dateValue + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'
  const dateEndDisplay = dateEndValue
    ? new Date(dateEndValue + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  const endDateError = endDateBeforeStart(dateValue, dateEndValue)
    ? t(lang, 'endDateBeforeStart')
    : undefined

  // The call button dials whatever number is inside the free-text field, so
  // "Marvin 9123 4567 (site)" still works.
  const dialNumber = extractDialNumber(phoneValue)
  const mapsUrl    = mapsSearchUrl(watch('location'))

  // Punctuality only means something once there is a start time. Correcting a
  // legacy row on open must NOT dirty the form (it would light up Save on a
  // job nobody edited), but a person clearing the time themselves should see
  // the change as an edit — hence the first-run flag.
  const seenStart = useRef<string | null>(null)
  useEffect(() => {
    const first = seenStart.current === null
    seenStart.current = timeStart ?? ''
    if (!timeStart && watch('punctuality') !== 'flexible') {
      setValue('punctuality', 'flexible', { shouldDirty: !first })
    }
    // watch/setValue are stable; re-run only when the start time changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeStart])

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then((data: { id: string; name: string }[]) => {
        setCompanies(data.map(c => ({ id: c.id, label: c.name })))
        // A saved job opens with its company filled in, but the id behind it
        // was only ever set by picking — so its Client Name list stayed
        // locked on "Select a company first…" until the company was picked
        // again (found 2026-10-30, in the way of switching Cynthia → David).
        const match = data.find(c => sameName(c.name, watch('client')))
        if (match) setSelectedClientId(id => id ?? match.id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedClientId) { setContacts([]); return }
    fetch(`/api/clients/${selectedClientId}/contacts`)
      .then(r => r.json())
      .then((data: { id: string; name: string }[]) =>
        setContacts(data.map(c => ({ id: c.id, label: c.name }))),
      )
      .catch(() => {})
  }, [selectedClientId])

  async function handleAddCompany(name: string): Promise<SelectOption> {
    const res  = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json() as { id: string; name: string }
    const opt  = { id: data.id, label: data.name }
    setCompanies(prev => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)))
    return opt
  }

  async function handleDeleteCompany(id: string): Promise<void> {
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    setCompanies(prev => prev.filter(c => c.id !== id))
  }

  // Call BEFORE the Client Name is emptied, so the next pick knows whose
  // number is still sitting in the box.
  function rememberPerson() {
    const name = watch('client_poc_name')
    if (name?.trim()) prevPerson.current = { company: watch('client') ?? '', name }
    setPhoneHint(null)
  }

  async function pickContact(label: string) {
    const company  = watch('client') ?? ''
    const oldName  = watch('client_poc_name')
    const previous = oldName?.trim() ? { company, name: oldName } : prevPerson.current
    setValue('client_poc_name', label, { shouldDirty: true })
    prevPerson.current = null
    setPhoneHint(null)

    const current = watch('client_poc_phone') ?? ''
    const seq     = ++phoneLookup.current
    let found: LastNumber | null
    try {
      const qs  = new URLSearchParams({ company, name: label, ...(jobId ? { exclude: jobId } : {}) })
      const res = await fetch(`/api/clients/last-phone?${qs}`)
      if (!res.ok) return
      found = await res.json() as LastNumber | null
    } catch {
      return // a convenience only — on a failed lookup the box stays as it is
    }
    // A later pick, or someone typing in the box meanwhile, outranks this answer.
    if (seq !== phoneLookup.current || (watch('client_poc_phone') ?? '') !== current) return

    const out = phoneAfterPick({ previous, next: { company, name: label }, current, found })
    if (out.phone !== undefined) setValue('client_poc_phone', out.phone, { shouldDirty: true })
    setPhoneHint(out.hint)
  }

  function clearCompany() {
    prevPerson.current = null
    setPhoneHint(null)
    setSelectedClientId(null)
    setValue('client', '', { shouldDirty: true })
    setValue('client_poc_name', '', { shouldDirty: true })
    setValue('client_poc_phone', '', { shouldDirty: true })
    setContacts([])
  }

  async function handleAddContact(name: string): Promise<SelectOption> {
    if (!selectedClientId) throw new Error('No company selected')
    const res  = await fetch(`/api/clients/${selectedClientId}/contacts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const data = await res.json() as { id: string; name: string }
    const opt  = { id: data.id, label: data.name }
    setContacts(prev => [...prev, opt].sort((a, b) => a.label.localeCompare(b.label)))
    return opt
  }

  async function handleDeleteContact(id: string, label: string): Promise<void> {
    await fetch(`/api/clients/contacts/${id}`, { method: 'DELETE' })
    setContacts(prev => prev.filter(c => c.id !== id))
    if (watch('client_poc_name') === label) {
      rememberPerson()
      setValue('client_poc_name', '', { shouldDirty: true })
    }
  }

  async function confirmDeleteCompany(label: string): Promise<boolean> {
    return new Promise(resolve => {
      setDeleteTarget({ id: '', label })
      pendingResolve.current = resolve
    })
  }

  const doIssued = watch('do_issued')

  // Shared read-only display box for installer view
  const roBox = (value: string, bold = false) => (
    <div className={cn(
      'w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2',
      bold && 'font-semibold text-ink',
    )}>
      {value || '—'}
    </div>
  )

  return (
    <>
      {deleteTarget && (
        <Modal isOpen={!!deleteTarget} onClose={() => { setDeleteTarget(null); pendingResolve.current?.(false) }}>
          <div className="flex flex-col gap-4">
            <p className="font-display font-medium text-ink">Remove company?</p>
            <p className="text-sm text-ink2">
              This will remove <strong>{deleteTarget.label}</strong> and all associated client names as well. Are you sure?
            </p>
            <div className="flex gap-2 justify-end">
              <Btn variant="ghost" size="sm" disabled={deleteLoading}
                onClick={() => { setDeleteTarget(null); pendingResolve.current?.(false) }}>
                No
              </Btn>
              <Btn variant="accent" size="sm" disabled={deleteLoading}
                onClick={() => { pendingResolve.current?.(true); setDeleteTarget(null) }}>
                Yes
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <CoreFrame bare={bare}>

        {/* Project Title — the label shares its row with the Suggest button
            (Nic, 2026-09-10), so SuggestField draws its own label here. */}
        {installerView ? (
          <Field label={t(lang, 'projectTitle')}>{roBox(watch('project_title'))}</Field>
        ) : (
          <div data-required-field="project_title">
            <SuggestField
              label={t(lang, 'projectTitle')}
              error={requiredMsg('project_title')}
              value={watch('project_title')}
              onAccept={s => setValue('project_title', s, { shouldDirty: true })}
              readOnly={coreLocked}
              field="Project Title"
            >
              <Input
                {...register('project_title')}
                placeholder="e.g. Vivienne Westwood Installation"
                disabled={coreLocked}
                error={isMissing('project_title')}
              />
            </SuggestField>
          </div>
        )}

        {/* Date + End Date. The old read-only "Day" box was dropped for the
            end date (Nic, 2026-09-10) — jobs.date_end already existed and the
            schedule already spreads a job across its range. */}
        <div className="grid grid-cols-2 gap-4">
          <div data-required-field="date">
            <Field label={t(lang, 'date')} error={errors.date?.message ?? requiredMsg('date')}>
              {installerView ? roBox(dateDisplay, true) : (
                <Input
                  type="date"
                  // Not required here: a Draft or Ongoing job may have no date. The
                  // stage rules (job-stage-rules.ts) demand it at Push to Schedule.
                  {...register('date')}
                  error={!!errors.date || isMissing('date')}
                  disabled={coreLocked}
                />
              )}
            </Field>
          </div>
          <Field label={t(lang, 'dateEnd')} error={endDateError}>
            {installerView ? roBox(dateEndDisplay, true) : (
              <Input
                type="date"
                {...register('date_end')}
                min={dateValue || undefined}
                error={!!endDateError}
                disabled={coreLocked}
              />
            )}
          </Field>
        </div>

        {/* Company */}
        <div data-required-field="client">
        <Field label={t(lang, 'company')} error={errors.client?.message ?? requiredMsg('client')}>
          {installerView ? roBox(watch('client')) : (
            <SearchableSelect
              value={watch('client')}
              onChange={label => {
                const found = companies.find(c => c.label === label)
                rememberPerson()
                setSelectedClientId(found?.id ?? null)
                setValue('client', label, { shouldDirty: true })
                setValue('client_poc_name', '', { shouldDirty: true })
              }}
              options={companies}
              placeholder="Pick company…"
              disabled={coreLocked}
              onAddNew={handleAddCompany}
              onDeleteOption={handleDeleteCompany}
              onClearOption={clearCompany}
              confirmDelete={confirmDeleteCompany}
            />
          )}
        </Field>
        </div>

        {/* Contact Person */}
        <div data-required-field="client_poc_name">
        <Field label={t(lang, 'clientPOCName')} error={errors.client_poc_name?.message ?? requiredMsg('client_poc_name')}>
          {installerView ? roBox(watch('client_poc_name')) : (
            <SearchableSelect
              value={watch('client_poc_name')}
              onChange={label => { void pickContact(label) }}
              options={contacts}
              placeholder={selectedClientId ? 'Pick contact…' : 'Select a company first…'}
              disabled={coreLocked || !selectedClientId}
              onAddNew={selectedClientId ? handleAddContact : undefined}
              onDeleteOption={handleDeleteContact}
              onClearOption={() => { rememberPerson(); setValue('client_poc_name', '', { shouldDirty: true }) }}
            />
          )}
        </Field>
        </div>

        {/* Client Phone — free text with a call button that dials the number
            it finds inside it (Nic, 2026-09-10). Installers get the same
            button: they are the ones standing outside a locked shop. */}
        <div data-required-field="client_poc_phone">
        <Field label={t(lang, 'clientPOCPhone')} error={errors.client_poc_phone?.message ?? requiredMsg('client_poc_phone')}>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              {installerView ? roBox(watch('client_poc_phone')) : (
                <Input
                  type="tel"
                  {...phoneReg}
                  onChange={e => { setPhoneHint(null); return phoneReg.onChange(e) }}
                  disabled={coreLocked}
                  error={!!errors.client_poc_phone || isMissing('client_poc_phone')}
                />
              )}
            </div>
            <a
              href={dialNumber ? `tel:${dialNumber}` : undefined}
              aria-label={t(lang, 'callContact')}
              aria-disabled={!dialNumber}
              className={cn(
                'shrink-0 flex items-center justify-center gap-1.5 px-3 rounded-lg border text-sm font-medium transition-colors',
                dialNumber
                  ? 'border-line bg-paper text-ink2 hover:text-terracotta hover:border-terracotta hover:bg-terracotta/5'
                  : 'border-line bg-bg text-muted opacity-40 pointer-events-none',
              )}
            >
              <Phone size={15} />
              <span className="hidden sm:inline">{t(lang, 'callContact')}</span>
            </a>
          </div>
          {/* Where an auto-filled number came from, or a number offered back
              (same look as Location's "use the previous address"). Typing in
              the box clears it. Dates stay English (CLAUDE.md). */}
          {phoneHint && !installerView && !coreLocked && (phoneHint.kind === 'filled' ? (
            <p className="mt-1.5 text-xs text-muted">
              {t(lang, 'phoneFromLastJob').replace('{name}', phoneHint.name.trim()).replace('{date}', formatDate(phoneHint.date))}
            </p>
          ) : (
            <div className="mt-1.5 flex items-start gap-2">
              <button
                type="button"
                onClick={() => { setValue('client_poc_phone', phoneHint.phone, { shouldDirty: true }); setPhoneHint(null) }}
                className="flex-1 min-w-0 text-left text-xs text-muted hover:text-terracotta border border-dashed border-line hover:border-terracotta rounded-md px-2.5 py-1.5 transition-colors"
              >
                <span className="block font-medium">
                  {t(lang, phoneHint.kind === 'reuse' ? 'phoneReuse' : 'phoneOfferLast').replace('{name}', phoneHint.name.trim())}
                </span>
                <span className="block truncate text-muted">{phoneHint.phone}</span>
              </button>
              <button
                type="button"
                onClick={() => setPhoneHint(null)}
                aria-label={t(lang, 'dismiss')}
                className="text-muted hover:text-ink text-xs px-2 py-1.5 shrink-0 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </Field>
        </div>

        {/* Location — Open Maps on the label row, address suggestions in the
            box (both Nic, 2026-09-10). Suggestions need GOOGLE_MAPS_API_KEY;
            without it LocationInput is an ordinary text box. */}
        <div data-required-field="location">
        <Field
          label={t(lang, 'locationAddress')}
          error={errors.location?.message ?? requiredMsg('location')}
          action={
            <a
              href={mapsUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'text-xs font-medium border border-line bg-paper px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 shrink-0',
                mapsUrl
                  ? 'text-muted hover:text-terracotta hover:border-terracotta hover:bg-terracotta/5'
                  : 'text-muted opacity-40 pointer-events-none',
              )}
            >
              <MapPin size={12} />
              {t(lang, 'openMaps')}
            </a>
          }
        >
          {installerView ? roBox(watch('location')) : (
            <Controller
              control={control}
              name="location"
              render={({ field }) => (
                <LocationInput
                  value={field.value}
                  onChange={field.onChange}
                  disabled={coreLocked}
                  error={!!errors.location || isMissing('location')}
                  lang={lang}
                  previousLocation={previousLocation}
                  onUsePreviousLocation={onUsePreviousLocation}
                  onDismissPreviousLocation={onDismissPreviousLocation}
                  /* Coordinates of the picked place (migration 0061).
                     LocationInput sets them on a pick and clears them the
                     moment someone types, so a stale pin can never be saved
                     against a hand-edited address. Nothing reads them yet —
                     deliberate capture, Nic 2026-09-16. */
                  onCoords={c => {
                    setValue('lat', c?.lat ?? null, { shouldDirty: true })
                    setValue('lng', c?.lng ?? null, { shouldDirty: true })
                  }}
                />
              )}
            />
          )}
        </Field>
        </div>

        {/* Description — label shares its row with the Suggest button */}
        {installerView ? (
          <Field label={t(lang, 'jobDescription')} action={descriptionTranslate.button}>
            <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 min-h-[4.5rem] leading-relaxed">
              {watch('description') || '—'}
            </div>
            {descriptionTranslate.panel}
          </Field>
        ) : (
          <div>
            <SuggestField
              label={t(lang, 'jobDescription')}
              value={watch('description')}
              onAccept={s => setValue('description', s, { shouldDirty: true })}
              readOnly={coreLocked}
              field="Job Description"
              extraAction={descriptionTranslate.button}
            >
              <textarea {...register('description')} disabled={coreLocked} rows={3} className={TEXTAREA} />
            </SuggestField>
            {descriptionTranslate.panel}
          </div>
        )}

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'timeStart')} error={errors.time_start?.message}>
            {installerView ? roBox(watch('time_start') || '—', true) : (
              <Controller
                control={control}
                name="time_start"
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} disabled={coreLocked} error={!!errors.time_start} />
                )}
              />
            )}
          </Field>
          <Field label={t(lang, 'timeEnd')}>
            {installerView ? roBox(watch('time_end') || '—', true) : (
              <Controller
                control={control}
                name="time_end"
                render={({ field }) => (
                  <TimeSelect value={field.value} onChange={field.onChange} disabled={coreLocked} />
                )}
              />
            )}
          </Field>
        </div>

        {/* Punctuality — strict is meaningless with no start time to be on
            time for, so it greys out and the choice sits on Flexible
            (Nic, 2026-09-10). The value itself is corrected in the effect above. */}
        <Field label={t(lang, 'punctuality')} hint={!timeStart && !installerView ? t(lang, 'punctualityNeedsStart') : undefined}>
          <Controller
            control={control}
            name="punctuality"
            render={({ field }) => (
              <div className="flex gap-2">
                {([
                  { v: 'strict'   as const, label: t(lang, 'strictOnTime'),   activeBg: 'bg-punct-strict-soft', activeBorder: 'border-punct-strict', dot: 'bg-punct-strict'  },
                  { v: 'flexible' as const, label: t(lang, 'flexibleWindow'), activeBg: 'bg-punct-flex-soft', activeBorder: 'border-punct-flex', dot: 'bg-punct-flex' },
                ]).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    disabled={coreLocked || installerView || (opt.v === 'strict' && !timeStart)}
                    onClick={() => field.onChange(opt.v)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      field.value === opt.v
                        ? `${opt.activeBg} ${opt.activeBorder} text-ink`
                        : 'border-line bg-paper text-ink2 hover:bg-bg',
                    )}
                  >
                    <span className={cn('w-2.5 h-2.5 rounded-sm shrink-0', opt.dot)} />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          />
        </Field>

        {/* Production Ready + DO — or DO status button for installer */}
        {installerView ? (
          doIssued ? (
            <div className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-lg border border-amber-300 bg-amber-50 text-sm font-semibold text-amber-700">
              Please Sign DO Provided
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full px-3 py-3 rounded-lg border border-line bg-bg text-sm text-muted opacity-70">
              No DO Required
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {(['production_ready', 'do_issued'] as const).map((field, i) => (
              <label key={field} className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-lg text-sm text-ink2 select-none transition-colors',
                flagsLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg',
              )}>
                <input type="checkbox" {...register(field)} disabled={flagsLocked} className="rounded border-line accent-terracotta shrink-0" />
                {i === 0 ? t(lang, 'productionReady') : t(lang, 'doIssued')}
              </label>
            ))}
          </div>
        )}

      </CoreFrame>
    </>
  )
}
