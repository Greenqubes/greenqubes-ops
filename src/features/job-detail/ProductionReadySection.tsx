'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Field } from '@/components/Field'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Camera, Download, Image as ImageIcon, FileVideo } from 'lucide-react'
import type { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { SuggestField } from '@/components/SuggestField'
import type { LangCode } from '@/lib/i18n'
import type { JobFile } from '@/lib/supabase/queries/jobs'
import type { FormValues } from './JobDetailShell'

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv)$/i

interface Props {
  register:  UseFormRegister<FormValues>
  watch?:    UseFormWatch<FormValues>
  setValue?: UseFormSetValue<FormValues>
  readOnly:  boolean
  lang:      LangCode
  jobId:     string
  userId:    string
  files:     JobFile[]
}

function DownloadButton({ r2Key, lang }: { r2Key: string; lang: LangCode }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key }),
      })
      const { url } = await res.json() as { url: string }
      window.open(url, '_blank', 'noopener')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Btn variant="ghost" size="sm" onClick={handleDownload} disabled={loading}>
      <Download size={13} />
      {t(lang, 'downloadFile')}
    </Btn>
  )
}

export function ProductionReadySection({ register, watch, setValue, readOnly, lang, jobId, userId, files }: Props) {
  const { success: showSuccess, error: showError } = useToast()
  const supabase = createClient()
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    e.target.value = ''

    setUploading(true)
    try {
      for (const file of selected) {
        const urlRes = await fetch('/api/r2/upload-url', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            jobId,
            kind:        'production_instructions',
            filename:    file.name,
            contentType: file.type || 'application/octet-stream',
          }),
        })
        const { url, key } = await urlRes.json() as { url: string; key: string }

        await fetch(url, {
          method:  'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body:    file,
        })

        await supabase.from('files').insert({
          job_id:      jobId,
          kind:        'production_instructions',
          r2_key:      key,
          uploader_id: userId,
          visibility:  ['public-internal'],
        } as never).throwOnError()
      }
      router.refresh()
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'productionReadyInstructions')}</h3>

      {/* Instructions comment */}
      <Field label={t(lang, 'productionInstructions')}>
        <SuggestField
          value={watch?.('production_instructions') ?? ''}
          onAccept={s => setValue?.('production_instructions', s, { shouldDirty: true })}
          readOnly={readOnly}
          field="Production Instructions"
        >
          <textarea
            {...register('production_instructions')}
            disabled={readOnly}
            rows={2}
            className={TEXTAREA}
          />
        </SuggestField>
      </Field>

      {/* Photo / video upload */}
      {!readOnly && (
        <div>
          <input
            type="file"
            ref={fileRef}
            onChange={handleFiles}
            multiple
            accept="image/*,video/*"
            className="hidden"
          />
          <Btn
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Camera size={13} />
            {uploading ? t(lang, 'uploading') : t(lang, 'attachFiles')}
          </Btn>
        </div>
      )}

      {/* Existing files */}
      {files.length > 0 && (
        <ul className="divide-y divide-line">
          {files.map(file => {
            const filename = file.r2_key.split('/').pop() ?? file.r2_key
            const isVideo  = VIDEO_EXT.test(filename)
            return (
              <li key={file.id} className="flex items-center gap-3 py-2.5">
                {isVideo
                  ? <FileVideo size={14} className="text-muted shrink-0" />
                  : <ImageIcon size={14} className="text-muted shrink-0" />
                }
                <p className="flex-1 min-w-0 text-sm text-ink truncate">{filename}</p>
                <DownloadButton r2Key={file.r2_key} lang={lang} />
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
