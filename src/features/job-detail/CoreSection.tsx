'use client'

import { useState, useEffect, useRef } from 'react'
import { UseFormRegister, FieldErrors, Control, Controller, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { SuggestField } from '@/components/SuggestField'
import { SearchableSelect, SelectOption } from '@/components/SearchableSelect'
import { Modal } from '@/components/Modal'
import { Btn } from '@/components/Btn'
import { TimeSelect } from './TimeSelect'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  register:          UseFormRegister<FormValues>
  errors:            FieldErrors<FormValues>
  control:           Control<FormValues>
  watch:             UseFormWatch<FormValues>
  setValue:          UseFormSetValue<FormValues>
  readOnly:          boolean
  lang:              LangCode
  validateRequired?: boolean
  salesPocOptions?:  SelectOption[]
}

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

export function CoreSection({
  register, errors, control, watch, setValue,
  readOnly, lang, validateRequired = false,
  salesPocOptions,
}: Props) {
  const req          = validateRequired ? { required: 'Required' } : {}
  const useDropdowns = !!salesPocOptions

  const [companies,        setCompanies]        = useState<SelectOption[]>([])
  const [contacts,         setContacts]         = useState<SelectOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [deleteTarget,     setDeleteTarget]     = useState<{ id: string; label: string } | null>(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const pendingResolve = useRef<((v: boolean) => void) | null>(null)

  const dateValue = watch('date')
  const dayLabel  = dateValue
    ? DAYS[new Date(dateValue + 'T00:00:00').getDay()]
    : '—'

  useEffect(() => {
    if (!useDropdowns) return
    fetch('/api/clients')
      .then(r => r.json())
      .then((data: { id: string; name: string }[]) =>
        setCompanies(data.map(c => ({ id: c.id, label: c.name }))),
      )
      .catch(() => {})
  }, [useDropdowns])

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

  function clearCompany() {
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
    if (watch('client_poc_name') === label) setValue('client_poc_name', '', { shouldDirty: true })
  }

  async function confirmDeleteCompany(label: string): Promise<boolean> {
    return new Promise(resolve => {
      setDeleteTarget({ id: '', label })
      pendingResolve.current = resolve
    })
  }

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
                onClick={() => {
                  pendingResolve.current?.(true)
                  setDeleteTarget(null)
                }}>
                Yes
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      <Card className="p-5 space-y-4">

        {/* Project Title */}
        <Field label={t(lang, 'projectTitle')} error={errors.project_title?.message}>
          <SuggestField
            value={watch('project_title')}
            onAccept={s => setValue('project_title', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Project Title"
          >
            <Input
              {...register('project_title', req)}
              placeholder="e.g. Vivienne Westwood Installation"
              disabled={readOnly}
              error={!!errors.project_title}
            />
          </SuggestField>
        </Field>

        {/* Date row — new form: Date + Day; edit form: Date + End Date */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'date')} error={errors.date?.message}>
            <Input
              type="date"
              {...register('date', { required: true })}
              error={!!errors.date}
              disabled={readOnly}
            />
          </Field>
          {useDropdowns ? (
            <Field label="Day">
              <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm font-semibold text-amber-600 text-center">
                {dayLabel}
              </div>
            </Field>
          ) : (
            <Field label={t(lang, 'dateEnd')}>
              <Input type="date" {...register('date_end')} disabled={readOnly} />
            </Field>
          )}
        </div>

        {/* Company (dropdown on new form, plain input on edit) */}
        <Field label="Company" error={errors.client?.message}>
          {useDropdowns ? (
            <SearchableSelect
              value={watch('client')}
              onChange={label => {
                const found = companies.find(c => c.label === label)
                setSelectedClientId(found?.id ?? null)
                setValue('client', label, { shouldDirty: true })
                setValue('client_poc_name', '', { shouldDirty: true })
              }}
              options={companies}
              placeholder="Pick company…"
              disabled={readOnly}
              onAddNew={handleAddCompany}
              onDeleteOption={handleDeleteCompany}
              onClearOption={clearCompany}
              confirmDelete={confirmDeleteCompany}
            />
          ) : (
            <Input
              {...register('client', { required: true })}
              error={!!errors.client}
              disabled={readOnly}
            />
          )}
        </Field>

        {/* Client POC Name */}
        <Field label={t(lang, 'clientPOCName')} error={errors.client_poc_name?.message}>
          {useDropdowns ? (
            <SearchableSelect
              value={watch('client_poc_name')}
              onChange={label => setValue('client_poc_name', label, { shouldDirty: true })}
              options={contacts}
              placeholder={selectedClientId ? 'Pick contact…' : 'Select a company first…'}
              disabled={readOnly || !selectedClientId}
              onAddNew={selectedClientId ? handleAddContact : undefined}
              onDeleteOption={handleDeleteContact}
              onClearOption={() => setValue('client_poc_name', '', { shouldDirty: true })}
            />
          ) : (
            <Input {...register('client_poc_name')} disabled={readOnly} error={!!errors.client_poc_name} />
          )}
        </Field>

        {/* Client Phone — always plain input */}
        <Field label={t(lang, 'clientPOCPhone')} error={errors.client_poc_phone?.message}>
          <Input
            type="tel"
            {...register('client_poc_phone')}
            disabled={readOnly || (useDropdowns && !selectedClientId && !watch('client_poc_phone'))}
            error={!!errors.client_poc_phone}
          />
        </Field>

        {/* Location */}
        <Field label={t(lang, 'locationAddress')} error={errors.location?.message}>
          <Input {...register('location', req)} disabled={readOnly} error={!!errors.location} />
        </Field>

        {/* Description */}
        <Field label={t(lang, 'jobDescription')}>
          <SuggestField
            value={watch('description')}
            onAccept={s => setValue('description', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Job Description"
          >
            <textarea {...register('description')} disabled={readOnly} rows={3} className={TEXTAREA} />
          </SuggestField>
        </Field>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t(lang, 'timeStart')} error={errors.time_start?.message}>
            <Controller
              control={control}
              name="time_start"
              rules={req}
              render={({ field }) => (
                <TimeSelect value={field.value} onChange={field.onChange} disabled={readOnly} error={!!errors.time_start} />
              )}
            />
          </Field>
          <Field label={t(lang, 'timeEnd')}>
            <Controller
              control={control}
              name="time_end"
              render={({ field }) => (
                <TimeSelect value={field.value} onChange={field.onChange} disabled={readOnly} />
              )}
            />
          </Field>
        </div>

        {/* Punctuality */}
        <Field label={t(lang, 'punctuality')}>
          <Controller
            control={control}
            name="punctuality"
            render={({ field }) => (
              <div className="flex gap-2">
                {([
                  { v: 'strict'   as const, label: t(lang, 'strictOnTime'),   activeBg: 'bg-terracotta-soft', activeBorder: 'border-terracotta', dot: 'bg-terracotta'  },
                  { v: 'flexible' as const, label: t(lang, 'flexibleWindow'), activeBg: 'bg-brand-blue-soft', activeBorder: 'border-brand-blue', dot: 'bg-brand-blue' },
                ]).map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    disabled={readOnly}
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

        {/* Production ready + DO issued */}
        <div className="grid grid-cols-2 gap-2">
          {(['production_ready', 'do_issued'] as const).map((field, i) => (
            <label key={field} className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-lg text-sm text-ink2 select-none transition-colors',
              readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg',
            )}>
              <input type="checkbox" {...register(field)} disabled={readOnly} className="rounded border-line accent-terracotta shrink-0" />
              {i === 0 ? t(lang, 'productionReady') : t(lang, 'doIssued')}
            </label>
          ))}
        </div>

        {/* Sales / POC — new form only */}
        {useDropdowns && salesPocOptions && (
          <Field label="Sales / POC">
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
          </Field>
        )}

        {/* Notes */}
        <Field label={t(lang, 'notes')}>
          <SuggestField
            value={watch('notes')}
            onAccept={s => setValue('notes', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Notes"
          >
            <textarea {...register('notes')} disabled={readOnly} rows={2} className={TEXTAREA} />
          </SuggestField>
        </Field>

        {/* Production Instructions */}
        <Field label="Production instructions">
          <SuggestField
            value={watch('production_instructions')}
            onAccept={s => setValue('production_instructions', s, { shouldDirty: true })}
            readOnly={readOnly}
            field="Production Instructions"
          >
            <textarea {...register('production_instructions')} disabled={readOnly} rows={2} className={TEXTAREA} />
          </SuggestField>
        </Field>

      </Card>
    </>
  )
}
