'use client'

import { UseFormRegister, FieldErrors, Control, Controller } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils/cn'
import type { Role } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'

interface Props {
  register: UseFormRegister<FormValues>
  errors:   FieldErrors<FormValues>
  control:  Control<FormValues>
  readOnly: boolean
  role:     Role
  lang:     LangCode
}

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

export function CoreSection({ register, errors, control, readOnly, role, lang }: Props) {
  const salesOrScheduler = role === 'sales' || role === 'scheduler'

  return (
    <Card className="p-5 space-y-4">

      {/* Project Title */}
      <Field label={t(lang, 'projectTitle')}>
        <Input
          {...register('project_title')}
          placeholder="e.g. Vivienne Westwood Installation"
          disabled={readOnly}
        />
      </Field>

      {/* Date */}
      <Field label={t(lang, 'date')} error={errors.date?.message}>
        <Input
          type="date"
          {...register('date', { required: true })}
          error={!!errors.date}
          disabled={readOnly}
        />
      </Field>

      {/* Times */}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'timeStart')}>
          <Input type="time" {...register('time_start')} disabled={readOnly} />
        </Field>
        <Field label={t(lang, 'timeEnd')}>
          <Input type="time" {...register('time_end')} disabled={readOnly} />
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
        <Field label={t(lang, 'clientPOCName')}>
          <Input {...register('client_poc_name')} disabled={readOnly} />
        </Field>
        <Field label={t(lang, 'clientPOCPhone')}>
          <Input type="tel" {...register('client_poc_phone')} disabled={readOnly} />
        </Field>
      </div>

      {/* Location */}
      <Field label={t(lang, 'locationAddress')}>
        <Input {...register('location')} disabled={readOnly} />
      </Field>

      {/* Description */}
      <Field label={t(lang, 'jobDescription')}>
        <textarea {...register('description')} disabled={readOnly} rows={3} className={TEXTAREA} />
      </Field>

      {/* Production instructions — sales/scheduler only */}
      {salesOrScheduler && (
        <Field label={t(lang, 'productionInstructions')}>
          <textarea {...register('production_instructions')} disabled={readOnly} rows={2} className={TEXTAREA} />
        </Field>
      )}

      {/* Notes */}
      <Field label={t(lang, 'notes')}>
        <textarea {...register('notes')} disabled={readOnly} rows={2} className={TEXTAREA} />
      </Field>

      {/* Punctuality — toggle buttons matching prototype */}
      <Field label={t(lang, 'punctuality')}>
        <Controller
          control={control}
          name="punctuality"
          render={({ field }) => (
            <div className="flex gap-2">
              {([
                { v: 'strict'   as const, label: t(lang, 'strictOnTime'),   activeBg: 'bg-terracotta-soft',    activeBorder: 'border-terracotta',    dot: 'bg-terracotta'   },
                { v: 'flexible' as const, label: t(lang, 'flexibleWindow'), activeBg: 'bg-brand-blue-soft',    activeBorder: 'border-brand-blue',    dot: 'bg-brand-blue'   },
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

      {/* Production ready + DO issued — bordered card checkboxes */}
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
