'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Btn } from '@/components/Btn'
import { CoreSection } from './CoreSection'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { FormValues } from './JobDetailShell'
import type { Role } from '@/lib/supabase/types'
import type { LangCode } from '@/lib/i18n'

interface Props {
  role:   Role
  userId: string
  lang:   LangCode
}

export function NewJobShell({ role, userId, lang }: Props) {
  const router = useRouter()
  const { error: showError } = useToast()
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      project_title:           '',
      date:                    today,
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
    },
  })

  const onSubmit = async (values: FormValues) => {
    setSaving(true)
    const supabase = createClient()
    try {
      const { data: job, error: insertError } = await (supabase
        .from('jobs')
        .insert({
          status:                  'pending',
          sales_poc_id:            userId,
          project_title:           values.project_title || null,
          date:                    values.date,
          time_start:              values.time_start  || null,
          time_end:                values.time_end    || null,
          client:                  values.client,
          location:                values.location,
          description:             values.description || null,
          client_poc_name:         values.client_poc_name  || null,
          client_poc_phone:        values.client_poc_phone || null,
          production_ready:        values.production_ready,
          do_issued:               values.do_issued,
          punctuality:             values.punctuality,
          production_instructions: values.production_instructions || null,
          notes:                   values.notes || null,
          visibility:              ['role:sales', 'role:scheduler'],
        } as never)
        .select('id')
        .single() as unknown as Promise<{ data: { id: string } | null; error: Error | null }>)

      if (insertError || !job) throw insertError
      const jobId = job.id

      if (values.quote_amount || values.supplier_cost || values.margin_notes) {
        await supabase.from('job_financials').insert({
          job_id:        jobId,
          quote_amount:  values.quote_amount  ? parseFloat(values.quote_amount)  : null,
          supplier_cost: values.supplier_cost ? parseFloat(values.supplier_cost) : null,
          margin_notes:  values.margin_notes || null,
        } as never)
      }

      router.push(`/jobs/${jobId}`)
    } catch {
      showError(t(lang, 'saveError'))
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-10 bg-bg border-b border-line px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/schedule" className="text-ink2 hover:text-ink shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] text-muted uppercase tracking-widest leading-none mb-0.5">
              {t(lang, 'companySchedule')}
            </p>
            <span className="font-display text-sm font-medium text-ink">
              {t(lang, 'newJob')}
            </span>
          </div>
        </div>

        <Btn
          variant="accent"
          size="sm"
          onClick={handleSubmit(onSubmit)}
          disabled={saving}
        >
          {saving ? t(lang, 'loading') : t(lang, 'createJob')}
        </Btn>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 pb-16">
        <CoreSection
          register={register}
          errors={errors}
          control={control}
          readOnly={false}
          lang={lang}
        />
      </div>
    </div>
  )
}
