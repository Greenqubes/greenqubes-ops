'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/Card'
import { Btn } from '@/components/Btn'
import { Field } from '@/components/Field'
import { t } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import { Camera, Download, Image as ImageIcon, FileVideo, Trash2 } from 'lucide-react'
import type { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import { SuggestField } from '@/components/SuggestField'
import type { LangCode } from '@/lib/i18n'
import type { JobFile } from '@/lib/supabase/queries/jobs'
import type { FormValues } from './JobDetailShell'
import type { Role } from '@/lib/supabase/types'
import { showSignedDoSection } from '@/lib/utils/completion-rules'
import { useUnsavedWork } from '@/features/app-version/unsaved-work'
import { checkUpload, bytesToMb } from '@/lib/storage/upload-rules'

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
  bare?:     boolean
}

// Frame for the section body: the page's CollapseCard supplies the card
// chrome (and the title) when `bare`; standalone use keeps the original Card.
function ProductionFrame({ bare, children }: { bare: boolean; children: React.ReactNode }) {
  return bare
    ? <div className="space-y-5">{children}</div>
    : <Card className="p-5 space-y-5">{children}</Card>
}

function DownloadButton({ r2Key, filename, lang }: { r2Key: string; filename: string | null; lang: LangCode }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/download-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: r2Key, filename: filename ?? undefined }),
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
  /** Which of these files this person may remove. Mirrors the server rule in
   *  job-file-permissions; the server is still the authority. */
  canDelete?: (file: JobFile) => boolean
}

function UploadSection({ label, kind, files, canUpload, jobId, userId, lang, accept = 'image/*,video/*', canDelete }: UploadSectionProps) {
  const { success: showSuccess, error: showError } = useToast()
  const supabase = createClient()
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Photos still going up count as unsaved work, so a post-deploy auto-refresh
  // waits rather than cutting the transfer off.
  useUnsavedWork('production-upload', uploading)

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    e.target.value = ''

    // Check every file BEFORE uploading anything — nobody should sit through
    // a 100MB transfer on site only to be told the type was wrong.
    for (const file of selected) {
      const verdict = checkUpload(kind, file.type || 'application/octet-stream', file.size)
      if (!verdict.ok) {
        showError(verdict.reason === 'size'
          ? t(lang, 'uploadTooLarge').replace('{mb}', String(bytesToMb(verdict.limitBytes)))
          : t(lang, 'uploadTypeRejected'))
        return
      }
    }

    setUploading(true)
    try {
      for (const file of selected) {
        const contentType = file.type || 'application/octet-stream'
        const urlRes = await fetch('/api/r2/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, kind, filename: file.name, contentType }),
        })
        // A refusal here used to be read straight through as { url, key },
        // giving `fetch(undefined)` and a bare "Save failed" that hid the
        // real reason (Nic, 2026-09-14).
        if (!urlRes.ok) {
          const { error } = await urlRes.json().catch(() => ({ error: '' })) as { error?: string }
          throw new Error(error || `${urlRes.status}`)
        }
        const { url, key } = await urlRes.json() as { url: string; key: string }

        // fetch only rejects on network failure, so an HTTP error here was
        // silently ignored and the row written anyway — leaving a file in the
        // list that opened to nothing.
        const putRes = await fetch(url, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
        if (!putRes.ok) throw new Error(`storage ${putRes.status}`)

        await supabase.from('files').insert({
          job_id: jobId, kind, r2_key: key, name: file.name, uploader_id: userId, visibility: ['public-internal'],
        } as never).throwOnError()
      }
      router.refresh()
      showSuccess(t(lang, 'savedSuccessfully'))
    } catch (err) {
      const reason = err instanceof Error && err.message ? err.message : t(lang, 'saveError')
      showError(t(lang, 'uploadFailed').replace('{reason}', reason))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!window.confirm(t(lang, 'deleteFileConfirm'))) return
    setDeletingId(fileId)
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: '' })) as { error?: string }
        showError(error || t(lang, 'saveError'))
        return
      }
      router.refresh()
      showSuccess(t(lang, 'fileDeleted'))
    } catch {
      showError(t(lang, 'saveError'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-muted mb-2">{label}</p>
      {files.length > 0 && (
        <ul className="divide-y divide-line mb-2">
          {files.map(file => {
            const filename = file.name ?? (file.r2_key.split('/').pop() ?? file.r2_key)
            const isVideo  = VIDEO_EXT.test(filename)
            return (
              <li key={file.id} className="flex items-center gap-3 py-2.5">
                {isVideo
                  ? <FileVideo size={14} className="text-muted shrink-0" />
                  : <ImageIcon size={14} className="text-muted shrink-0" />
                }
                <p className="flex-1 min-w-0 text-sm text-ink truncate">{filename}</p>
                <DownloadButton r2Key={file.r2_key} filename={file.name} lang={lang} />
                {canDelete?.(file) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    disabled={deletingId === file.id}
                    aria-label={t(lang, 'delete')}
                    title={t(lang, 'delete')}
                    className="shrink-0 p-1.5 rounded text-muted hover:text-bad hover:bg-bad-soft transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
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

export function ProductionReadySection({ register, watch, setValue, readOnly, role, lang, jobId, userId, files, bare = false }: Props) {
  const isInstaller         = role === 'installer'
  const isDesigner          = role === 'designer'
  // Designer is view-only; installer reads instructions but cannot edit them.
  const instructionsLocked  = readOnly || isInstaller || isDesigner
  // Production team (and office roles) manage production photos; installer/designer cannot.
  const canUploadProduction = !readOnly && !isInstaller && !isDesigner
  // Installer signs the DO; designer never uploads.
  const canUploadDo         = !readOnly && !isDesigner
  const canUploadCompletion = !readOnly && !isDesigner

  const productionPhotos = files.filter(f => f.kind === 'production_instructions')
  const signedDoFiles    = files.filter(f => f.kind === 'do')
  const completionPhotos = files.filter(f => f.kind === 'completion')

  // Who sees a bin (Nic, 2026-09-14). Office roles could always delete on the
  // server — only the button was missing. Installers are the new, narrow case:
  // their OWN completion uploads, never a colleague's. `readOnly` is true once
  // the job is completed, so both are locked then, and /api/files/[id] checks
  // all of this again regardless of what the screen offers.
  const isOfficeRole        = !isInstaller && !isDesigner
  const canDeleteProduction = canUploadProduction && isOfficeRole ? () => true : undefined
  const canDeleteCompletion = !readOnly && !isDesigner
    ? (file: JobFile) => isOfficeRole || file.uploader_id === userId
    : undefined

  return (
    <ProductionFrame bare={bare}>
      {!bare && (
        <h3 className="text-sm font-medium text-ink">{t(lang, 'productionReadyInstructions')}</h3>
      )}

      {/* Production Instructions — label shares its row with the Suggest button */}
      {isInstaller ? (
        <Field label={t(lang, 'productionInstructions')}>
          <div className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink2 min-h-[3rem] leading-relaxed">
            {watch?.('production_instructions') || <span className="italic text-muted">None</span>}
          </div>
        </Field>
      ) : (
        <SuggestField
          label={t(lang, 'productionInstructions')}
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

      {/* Production Photos (kind='production_instructions' — existing kind reused for backwards compat) */}
      <UploadSection
        label="Production Photos"
        kind="production_instructions"
        files={productionPhotos}
        canUpload={canUploadProduction}
        canDelete={canDeleteProduction}
        jobId={jobId}
        userId={userId}
        lang={lang}
      />

      {/* Signed DO — only once production ticks "DO issued" (no DO means
          nothing to sign); an already-uploaded file always stays visible */}
      {showSignedDoSection({ doIssued: !!watch?.('do_issued'), signedDoFileCount: signedDoFiles.length }) && (
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
      )}

      {/* Completion Photos */}
      <UploadSection
        label="Completion Photos"
        kind="completion"
        files={completionPhotos}
        canUpload={canUploadCompletion}
        canDelete={canDeleteCompletion}
        jobId={jobId}
        userId={userId}
        lang={lang}
      />
    </ProductionFrame>
  )
}
