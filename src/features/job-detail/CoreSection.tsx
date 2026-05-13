'use client'

import { UseFormRegister, FieldErrors, Control, Controller, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { SuggestField } from '@/components/SuggestField'
import { TimeSelect } from './TimeSelect'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'

interface Props {
  register:          UseFormRegister<FormValues>
  errors:            FieldErrors<FormValues>
  control:           Control<FormValues>
  watch:             UseFormWatch<FormValues>
  setValue:          UseFormSetValue<FormValues>
  readOnly:          boolean
  lang:              LangCode
  validateRequired?: boolean
}

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

export function CoreSection({ register, errors, control, watch, setValue, readOnly, lang, validateRequired = false }: Props) {
  const req = validateRequired ? { required: 'Required' } : {}

  return (
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

      {/* Date + End Date */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'date')} error={errors.date?.message}>
          <Input
            type="date"
            {...register('date', { required: true })}
            error={!!errors.date}
            disabled={readOnly}
          />
        </Field>
        <Field label={t(lang, 'dateEnd')}>
          <Input
            type="date"
            {...register('date_end')}
            disabled={readOnly}
          />
        </Field>
      </div>

      {/* Times — fully custom dropdown, no native browser time picker */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'timeStart')} error={errors.time_start?.message}>
          <Controller
            control={control}
            name="time_start"
            rules={req}
            render={({ field }) => (
              <TimeSelect
                value={field.value}
                onChange={field.onChange}
                disabled={readOnly}
                error={!!errors.time_start}
              />
            )}
          />
        </Field>
        <Field label={t(lang, 'timeEnd')}>
          <Controller
            control={control}
            name="time_end"
            render={({ field }) => (
              <TimeSelect
                value={field.value}
                onChange={field.onChange}
                disabled={readOnly}
              />
            )}
          />
        </Field>
      </div>

      {/* Client */}
      <Field label={t(lang, 'client')} error={errors.client?.message}>
        <Input
          {...register('client', { required: true })}
          error={!!errors.client}
          disabled={readOnly}
        />
      </Field>

      {/* Client contact */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'clientPOCName')} error={errors.client_poc_name?.message}>
          <Input
            {...register('client_poc_name')}
            disabled={readOnly}
            error={!!errors.client_poc_name}
          />
        </Field>
        <Field label={t(lang, 'clientPOCPhone')} error={errors.client_poc_phone?.message}>
          <Input
            type="tel"
            {...register('client_poc_phone')}
            disabled={readOnly}
            error={!!errors.client_poc_phone}
          />
        </Field>
      </div>

      {/* Location */}
      <Field label={t(lang, 'locationAddress')} error={errors.location?.message}>
        <Input
          {...register('location', req)}
          disabled={readOnly}
          error={!!errors.location}
        />
      </Field>

      {/* Description */}
      <Field label={t(lang, 'jobDescription')}>
        <SuggestField
          value={watch('description')}
          onAccept={s => setValue('description', s, { shouldDirty: true })}
          readOnly={readOnly}
          field="Job Description"
        >
          <textarea
            {...register('description')}
            disabled={readOnly}
            rows={3}
            className={TEXTAREA}
          />
        </SuggestField>
      </Field>

      {/* Notes — always optional */}
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

      {/* Punctuality — always optional, has default */}
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
                      : 'border-line bg-paper text-ink2 hover:bg-bg'
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
        <label className={cn(
          'flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-lg text-sm text-ink2 select-none transition-colors',
          readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg'
        )}>
          <input
            type="checkbox"
            {...register('production_ready')}
            disabled={readOnly}
            className="rounded border-line accent-terracotta shrink-0"
          />
          {t(lang, 'productionReady')}
        </label>
        <label className={cn(
          'flex items-center gap-2.5 px-3 py-2.5 border border-line rounded-lg text-sm text-ink2 select-none transition-colors',
          readOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-bg'
        )}>
          <input
            type="checkbox"
            {...register('do_issued')}
            disabled={readOnly}
            className="rounded border-line accent-terracotta shrink-0"
          />
          {t(lang, 'doIssued')}
        </label>
      </div>

    </Card>
  )
}
