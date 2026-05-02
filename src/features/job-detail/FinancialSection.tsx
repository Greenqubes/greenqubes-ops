'use client'

import { UseFormRegister, FieldErrors } from 'react-hook-form'
import { Card } from '@/components/Card'
import { Field } from '@/components/Field'
import { Input } from '@/components/Input'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'
import type { FormValues } from './JobDetailShell'

interface Props {
  register: UseFormRegister<FormValues>
  errors:   FieldErrors<FormValues>
  readOnly: boolean
  lang:     LangCode
}

export function FinancialSection({ register, errors, readOnly, lang }: Props) {
  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'financials')}</h3>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t(lang, 'quoteAmount')} error={errors.quote_amount?.message}>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register('quote_amount')}
            error={!!errors.quote_amount}
            disabled={readOnly}
            placeholder="0.00"
          />
        </Field>

        <Field label={t(lang, 'supplierCost')} error={errors.supplier_cost?.message}>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register('supplier_cost')}
            error={!!errors.supplier_cost}
            disabled={readOnly}
            placeholder="0.00"
          />
        </Field>
      </div>

      <Field label={t(lang, 'marginNotes')}>
        <textarea
          {...register('margin_notes')}
          disabled={readOnly}
          rows={2}
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none"
        />
      </Field>
    </Card>
  )
}
