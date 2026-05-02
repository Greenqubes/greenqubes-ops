'use client'

import { UseFormRegister, FieldErrors } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { Select } from '@/components/Select'
import { t } from '@/lib/i18n'
import type { Role } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'

interface Props {
  register:  UseFormRegister<FormValues>
  errors:    FieldErrors<FormValues>
  readOnly:  boolean
  role:      Role
  lang:      LangCode
}

export function CoreSection({ register, errors, readOnly, role, lang }: Props) {
  const salesOrScheduler = role === 'sales' || role === 'scheduler'

  return (
    <Card className="p-5 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'date')} error={errors.date?.message}>
          <Input
            type="date"
            {...register('date', { required: true })}
            error={!!errors.date}
            disabled={readOnly}
          />
        </Field>

        <Field label={t(lang, 'punctuality')}>
          <Select {...register('punctuality')} disabled={readOnly}>
            <option value="strict">{t(lang, 'strictOnTime')}</option>
            <option value="flexible">{t(lang, 'flexibleWindow')}</option>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'timeStart')}>
          <Input
            type="time"
            {...register('time_start')}
            disabled={readOnly}
          />
        </Field>

        <Field label={t(lang, 'timeEnd')}>
          <Input
            type="time"
            {...register('time_end')}
            disabled={readOnly}
          />
        </Field>
      </div>

      <Field label={t(lang, 'client')} error={errors.client?.message}>
        <Input
          {...register('client', { required: true })}
          error={!!errors.client}
          disabled={readOnly}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'clientPOCName')}>
          <Input {...register('client_poc_name')} disabled={readOnly} />
        </Field>

        <Field label={t(lang, 'clientPOCPhone')}>
          <Input type="tel" {...register('client_poc_phone')} disabled={readOnly} />
        </Field>
      </div>

      <Field label={t(lang, 'locationAddress')}>
        <Input {...register('location')} disabled={readOnly} />
      </Field>

      <Field label={t(lang, 'jobDescription')}>
        <textarea
          {...register('description')}
          disabled={readOnly}
          rows={3}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none"
        />
      </Field>

      {salesOrScheduler && (
        <Field label={t(lang, 'productionInstructions')}>
          <textarea
            {...register('production_instructions')}
            disabled={readOnly}
            rows={2}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none"
          />
        </Field>
      )}

      <Field label={t(lang, 'notes')}>
        <textarea
          {...register('notes')}
          disabled={readOnly}
          rows={2}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none"
        />
      </Field>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            {...register('production_ready')}
            disabled={readOnly}
            className="rounded border-line accent-terracotta"
          />
          {t(lang, 'productionReady')}
        </label>

        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input
            type="checkbox"
            {...register('do_issued')}
            disabled={readOnly}
            className="rounded border-line accent-terracotta"
          />
          {t(lang, 'doIssued')}
        </label>
      </div>
    </Card>
  )
}
