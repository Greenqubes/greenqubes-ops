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
import type { Role } from '@/lib/supabase/types'

const TEXTAREA = 'w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:border-terracotta focus:ring-terracotta/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 resize-none'

const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv)$/i

interface Props {
  register:  UseFormRegister<FormValues>
  watch?:    UseFormWatch<FormValues>
  setValue?: UseFormSetValue<FormValues>
  readOnly:  boolean
  role:      Role
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

interface UploadSectionProps {
  label:     string
  kind:      'production_instructions' | 'do' | 'completion'
  files:     JobFile[]
  canUpload: boolean
  jobId:     string
  userId:    string
  lang:      LangCode
  accept?:   string
}

function UploadSection({ label, kind, files, canUpload, jobId, userId, lang, accept = 'image/*,video/*' }: UploadSectionProps) {
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, kind, filename: file.name, contentType: file.type || 'application/octet-stream' }),
        })
        const { url, key } = await urlRes.json() as { url: string; key: string }
        await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
        await supabase.from('files').insert({
          job_id: jobId, kind, r2_key: key, uploader_id: userId, visibility: ['public-internal'],
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
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-2">{label}</p>
      {files.length > 0 && (
        <ul className="divide-y divide-line mb-2">
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
      {canUpload && (
        <>
          <input type="file" ref={fileRef} onChange={handleFiles} multiple accept={accept} className="hidden" />
          <Btn variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera size={13} />
            {uploading ? t(lang, 'uploading') : t(lang, 'attachFiles')}
          </Btn>
        </>
      )}
      {!canUpload && files.length === 0 && (
        <p className="text-sm text-muted italic">None</p>
      )}
    </div>
  )
}

export function ProductionReadySection({ register, watch, setValue, readOnly, role, lang, jobId, userId, files }: Props) {
  const isInstaller         = role === 'installer'
  const instructionsLocked  = readOnly || isInstaller
  const canUploadProduction = !readOnly && !isInstaller
  const canUploadDo         = !readOnly
  const canUploadCompletion = !readOnly

  const productionPhotos = files.filter(f => f.kind === 'production_instructions')
  const signedDoFiles    = files.filter(f => f.kind === 'do')
  const completionPhotos = files.filter(f => f.kind === 'completion')

  return (
    <Card className="p-5 space-y-5">
      <h3 className="text-sm font-medium text-ink">{t(lang, 'productionReadyInstructions')}</h3>

      {/* Production Instructions */}
      <Field label={t(lang, 'productionInstructions')}>
        {isInstaller ? (
          <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 min-h-[3rem] leading-relaxed">
            {watch?.('production_instructions') || <span className="italic text-muted">None</span>}
          </div>
        ) : (
          <SuggestField
            value={watch?.('production_instructions') ?? ''}
            onAccept={s => setValue?.('production_instructions', s, { shouldDirty: true })}
            readOnly={instructionsLocked}
            field="Production Instructions"
          >
            <textarea
              {...register('production_instructions')}
              disabled={instructionsLocked}
              rows={2}
              className={TEXTAREA}
            />
          </SuggestField>
        )}
      </Field>

      {/* Production Photos (kind='production_instructions' — existing kind reused for backwards compat) */}
      <UploadSection
        label="Production Photos"
        kind="production_instructions"
        files={productionPhotos}
        canUpload={canUploadProduction}
        jobId={jobId}
        userId={userId}
        lang={lang}
      />

      {/* Signed DO (Optional) */}
      <UploadSection
        label="Signed DO (Optional)"
        kind="do"
        files={signedDoFiles}
        canUpload={canUploadDo}
        jobId={jobId}
        userId={userId}
        lang={lang}
        accept="image/*,.pdf"
      />

      {/* Completion Photos */}
      <UploadSection
        label="Completion Photos"
        kind="completion"
        files={completionPhotos}
        canUpload={canUploadCompletion}
        jobId={jobId}
        userId={userId}
        lang={lang}
      />
    </Card>
  )
}
