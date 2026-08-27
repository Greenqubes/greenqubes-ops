'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/Toast'
import { ImageLightbox } from '@/components/ImageLightbox'
import {
  Image as ImageIcon, Paperclip, Link as LinkIcon, Trash2, Plus,
  FileText, FileSpreadsheet, FileArchive, Download, FolderInput,
} from 'lucide-react'
import { MoveFileModal } from './MoveFileModal'
import { cn } from '@/lib/utils/cn'
import type { AttachmentBucket, BucketFile } from '@/lib/supabase/queries/jobs'
import { t } from '@/lib/i18n'
import type { LangCode } from '@/lib/i18n'

// The Designer JO bucket is protected from rename/delete for every role
// (Task 8) — the design-complete route and the Task 9 3-day reminder both
// find it by name (`ilike '%designer jo%'`), so an unprotected rename or
// delete would silently break both.
const isDesignerJoBucket = (name: string) => /designer\s*jo/i.test(name)

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

function isImage(filename: string) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return IMAGE_EXTS.has(ext)
}

function fileExtLabel(filename: string) {
  return filename.slice(filename.lastIndexOf('.') + 1).toUpperCase() || 'FILE'
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase()
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={14} />
  if (['zip', 'rar', '7z'].includes(ext))   return <FileArchive size={14} />
  return <FileText size={14} />
}

interface Props {
  jobId:       string
  userId:      string   // app users.id — the FK target for files.uploader_id
  lang:        LangCode
  readOnly?:   boolean
  refreshKey?: number   // bump to re-pull from the server (live job-form events)
  // Lifts this component's own fetched bucket state up to the host (Task 8:
  // JobDetailShell needs to know whether the DESIGNER JO bucket has >=1 file
  // to gate the designer's completion button) — cheaper and never out of
  // sync vs. the host running its own separate buckets query.
  onBucketsChange?: (buckets: AttachmentBucket[]) => void
}

export function AttachmentBuckets({ jobId, userId, lang, readOnly = false, refreshKey, onBucketsChange }: Props) {
  const [buckets,    setBuckets]    = useState<AttachmentBucket[]>([])
  const [loading,    setLoading]    = useState(true)
  const [lightbox,   setLightbox]   = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState<BucketFile | null>(null)
  const supabase = createClient()
  const { success: showSuccess, error: showError } = useToast()

  useEffect(() => { onBucketsChange?.(buckets) }, [buckets])  // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('attachment_buckets')
        .select('id, job_id, name, position, created_at, files(id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts)')
        .eq('job_id', jobId)
        .order('position')
      if (error) throw error
      setBuckets((data ?? []) as unknown as AttachmentBucket[])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [jobId, refreshKey])  // eslint-disable-line react-hooks/exhaustive-deps

  async function addBucket() {
    const maxPos = buckets.reduce((m, b) => Math.max(m, b.position), -1)
    const { data, error } = await supabase
      .from('attachment_buckets')
      .insert({ job_id: jobId, name: 'NEW BUCKET', position: maxPos + 1 } as never)
      .select('id, job_id, name, position, created_at')
      .single()
    if (error) return
    setBuckets(prev => [...prev, { ...(data as unknown as AttachmentBucket), files: [] }])
  }

  async function renameBucket(id: string, name: string) {
    const { error } = await supabase.from('attachment_buckets').update({ name } as never).eq('id', id)
    if (error) { showError('Could not rename the bucket.'); return }
    setBuckets(prev => prev.map(b => b.id === id ? { ...b, name } : b))
  }

  // Deletes go through the server: RLS has no DELETE policy on files, so a
  // browser-side delete silently removes nothing and the file "comes back".
  // The server route also deletes the R2 object (browser deletes never did).
  async function deleteBucket(id: string) {
    try {
      const res = await fetch(`/api/buckets/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: '' })) as { error?: string }
        showError(`Could not delete the bucket${error ? ` — ${error}` : ''}.`)
        return
      }
    } catch {
      showError('Could not delete the bucket — no connection.')
      return
    }
    setBuckets(prev => prev.filter(b => b.id !== id))
    showSuccess('Bucket deleted.')
  }

  async function uploadFile(bucket: AttachmentBucket, file: File, isImage: boolean) {
    if (!userId) { showError('Not signed in.'); return }

    const contentType = file.type || 'application/octet-stream'

    // Step 1 — get a signed upload URL from our server.
    let url: string, key: string
    try {
      const res = await fetch('/api/r2/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, kind: 'attachment', filename: file.name, contentType }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        console.error('[upload] step 1 (upload-url) failed', res.status, detail)
        showError(`Upload failed — couldn't get an upload link (server ${res.status}).`)
        return
      }
      ;({ url, key } = await res.json() as { url: string; key: string })
    } catch (e) {
      console.error('[upload] step 1 (upload-url) threw', e)
      showError('Upload failed — could not reach the upload service.')
      return
    }

    // Step 2 — PUT the file straight to R2. A CORS block (e.g. this preview URL
    // not allowed on the bucket) surfaces as a thrown TypeError here.
    try {
      const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } })
      if (!putRes.ok) {
        console.error('[upload] step 2 (R2 PUT) non-ok', putRes.status)
        showError(`Upload failed — file storage rejected it (status ${putRes.status}).`)
        return
      }
    } catch (e) {
      console.error('[upload] step 2 (R2 PUT) threw — likely CORS on this preview URL', e)
      showError('Upload failed — storage blocked the file (likely a CORS setting for this preview URL).')
      return
    }

    // Step 3 — record the file row.
    const { data: fileRow, error } = await supabase
      .from('files')
      .insert({
        job_id:      jobId,
        bucket_id:   bucket.id,
        kind:        'attachment',
        r2_key:      key,
        name:        file.name,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never)
      .select('id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts')
      .single()
    if (error) {
      console.error('[upload] step 3 (files insert) failed', error)
      showError(`Upload failed — could not save the record (${error.message}).`)
      return
    }
    setBuckets(prev => prev.map(b =>
      b.id === bucket.id ? { ...b, files: [...b.files, fileRow as unknown as BucketFile] } : b,
    ))
    showSuccess(isImage ? 'Image uploaded.' : 'Attachment uploaded.')
  }

  async function addUrl(bucket: AttachmentBucket, url: string) {
    if (!userId) { showError('Not signed in.'); return }
    const { data: fileRow, error } = await supabase
      .from('files')
      .insert({
        job_id:      jobId,
        bucket_id:   bucket.id,
        kind:        'url_link',
        r2_key:      '',
        url_text:    url,
        uploader_id: userId,
        visibility:  ['public-internal'],
      } as never)
      .select('id, job_id, bucket_id, kind, r2_key, name, url_text, uploader_id, ts')
      .single()
    if (error) { showError('Failed to save URL. Please try again.'); return }
    setBuckets(prev => prev.map(b =>
      b.id === bucket.id ? { ...b, files: [...b.files, fileRow as unknown as BucketFile] } : b,
    ))
    showSuccess('URL uploaded.')
  }

  async function deleteFile(bucketId: string, fileId: string) {
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: '' })) as { error?: string }
        showError(`Could not delete the file${error ? ` — ${error}` : ''}.`)
        return
      }
    } catch {
      showError('Could not delete the file — no connection.')
      return
    }
    setBuckets(prev => prev.map(b =>
      b.id === bucketId ? { ...b, files: b.files.filter(f => f.id !== fileId) } : b,
    ))
    showSuccess('File deleted.')
  }

  // A move is just the bucket_id column changing — re-home the file in state.
  function handleMoved(fileId: string, toBucketId: string) {
    setBuckets(prev => {
      let moved: BucketFile | undefined
      const stripped = prev.map(b => {
        const found = b.files.find(f => f.id === fileId)
        if (found) moved = { ...found, bucket_id: toBucketId }
        return { ...b, files: b.files.filter(f => f.id !== fileId) }
      })
      return stripped.map(b => (b.id === toBucketId && moved) ? { ...b, files: [...b.files, moved] } : b)
    })
  }

  async function getDownloadUrl(r2Key: string, filename?: string): Promise<string> {
    const res = await fetch('/api/r2/download-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: r2Key, filename }),
    })
    const { url } = await res.json() as { url: string }
    return url
  }

  if (loading) return <p className="text-sm text-muted py-4">Loading attachments…</p>

  return (
    <div className="space-y-3">
      {lightbox && <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {moveTarget && (
        <MoveFileModal
          file={moveTarget}
          buckets={buckets.map(b => ({ id: b.id, name: b.name }))}
          lang={lang}
          onClose={() => setMoveTarget(null)}
          onMoved={handleMoved}
        />
      )}

      {buckets.map(bucket => (
        <BucketCard
          key={bucket.id}
          bucket={bucket}
          lang={lang}
          readOnly={readOnly}
          onRename={name => renameBucket(bucket.id, name)}
          onDelete={() => deleteBucket(bucket.id)}
          onUpload={(file, isImg) => uploadFile(bucket, file, isImg)}
          onAddUrl={url => addUrl(bucket, url)}
          onDeleteFile={fileId => deleteFile(bucket.id, fileId)}
          onMoveFile={file => setMoveTarget(file)}
          onImageClick={src => setLightbox(src)}
          getDownloadUrl={getDownloadUrl}
        />
      ))}

      {!readOnly && (
        <button
          type="button"
          onClick={addBucket}
          className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl border-2 border-dashed border-line text-sm font-medium text-muted hover:border-terracotta hover:text-terracotta hover:bg-terracotta/5 transition-all"
        >
          <Plus size={14} />
          Add bucket
        </button>
      )}
    </div>
  )
}

// ── BucketCard ────────────────────────────────────────────────────────────────

interface BucketCardProps {
  bucket:         AttachmentBucket
  lang:           LangCode
  readOnly:       boolean
  onRename:       (name: string) => void
  onDelete:       () => void
  onUpload:       (file: File, isImage: boolean) => void
  onAddUrl:       (url: string) => void
  onDeleteFile:   (fileId: string) => void
  onMoveFile:     (file: BucketFile) => void
  onImageClick:   (src: string) => void
  getDownloadUrl: (key: string, filename?: string) => Promise<string>
}

function BucketCard({
  bucket, lang, readOnly, onRename, onDelete, onUpload, onAddUrl, onDeleteFile, onMoveFile, onImageClick, getDownloadUrl,
}: BucketCardProps) {
  const [name,       setName]       = useState(bucket.name)
  const [urlModal,   setUrlModal]   = useState(false)
  const [urlInput,   setUrlInput]   = useState('')
  const [deleteConf, setDeleteConf] = useState(false)
  const imgRef  = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const protectedBucket = isDesignerJoBucket(bucket.name)
  const protectedTitle  = protectedBucket ? t(lang, 'designJoProtected') : undefined

  return (
    <div className="rounded-xl border border-line bg-paper overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => { if (name !== bucket.name) onRename(name) }}
          disabled={readOnly || protectedBucket}
          title={protectedTitle}
          className="flex-1 bg-transparent text-[13px] font-semibold tracking-wide uppercase text-ink2 outline-none disabled:cursor-default"
        />
        {!readOnly && (
          <div className="flex items-center gap-1 shrink-0">
            <input ref={imgRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => { [...(e.target.files ?? [])].forEach(f => onUpload(f, true)); e.target.value = '' }} />
            <ActionBtn icon={<ImageIcon size={11} />} label="Image" onClick={() => imgRef.current?.click()} />

            <input ref={fileRef} type="file" multiple className="hidden"
              onChange={e => { [...(e.target.files ?? [])].forEach(f => onUpload(f, false)); e.target.value = '' }} />
            <ActionBtn icon={<Paperclip size={11} />} label="Attachment" onClick={() => fileRef.current?.click()} />

            <ActionBtn icon={<LinkIcon size={11} />} label="URL" onClick={() => setUrlModal(true)} />

            {protectedBucket ? (
              <span title={protectedTitle} className="p-1.5 rounded-lg text-line cursor-not-allowed">
                <Trash2 size={13} />
              </span>
            ) : (
              <button type="button" onClick={() => setDeleteConf(true)}
                className="p-1.5 rounded-lg text-muted hover:text-terracotta hover:bg-terracotta/5 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 min-h-[40px]">
        {bucket.files.length === 0 ? (
          <p className="text-xs text-muted italic">No files yet</p>
        ) : (
          <div className="space-y-1">
            {bucket.files.map(file => (
              <FileRow
                key={file.id}
                file={file}
                readOnly={readOnly}
                onDelete={() => onDeleteFile(file.id)}
                onMove={() => onMoveFile(file)}
                onImageClick={onImageClick}
                getDownloadUrl={getDownloadUrl}
              />
            ))}
          </div>
        )}
      </div>

      {/* URL modal */}
      {urlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setUrlModal(false)}>
          <div className="bg-paper rounded-xl p-5 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="font-display font-medium text-sm text-ink mb-3">Add URL</p>
            <input
              autoFocus
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://…"
              className="w-full border border-line rounded-lg px-3 py-2 text-sm text-ink bg-bg mb-3 outline-none focus:border-terracotta"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setUrlModal(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink2">Cancel</button>
              <button type="button"
                onClick={() => { if (urlInput.trim()) { onAddUrl(urlInput.trim()); setUrlInput(''); setUrlModal(false) } }}
                className="px-3 py-1.5 text-sm rounded-lg bg-terracotta text-white">Add link</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete bucket confirm */}
      {deleteConf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50" onClick={() => setDeleteConf(false)}>
          <div className="bg-paper rounded-xl p-5 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="font-display font-medium text-sm text-ink mb-2">Delete bucket?</p>
            <p className="text-xs text-ink2 mb-4">
              {bucket.files.length > 0
                ? `Delete bucket and its ${bucket.files.length} file${bucket.files.length !== 1 ? 's' : ''}?`
                : 'Delete this empty bucket?'}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setDeleteConf(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-line text-ink2">Cancel</button>
              <button type="button" onClick={() => { setDeleteConf(false); onDelete() }}
                className="px-3 py-1.5 text-sm rounded-lg bg-terracotta text-white">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="flex items-center gap-1 px-2 py-1 rounded-lg border border-line text-[11px] font-medium text-ink2 hover:bg-bg hover:border-ink2 transition-colors">
      {icon} {label}
    </button>
  )
}

function FileRow({ file, readOnly, onDelete, onMove, onImageClick, getDownloadUrl }: {
  file:           BucketFile
  readOnly:       boolean
  onDelete:       () => void
  onMove:         () => void
  onImageClick:   (src: string) => void
  getDownloadUrl: (key: string, filename?: string) => Promise<string>
}) {
  const [dlLoading, setDlLoading] = useState(false)
  const isUrl    = file.kind === 'url_link'
  const urlText  = file.url_text ?? file.r2_key
  const filename = isUrl ? urlText : (file.name ?? file.r2_key.split('/').pop() ?? file.r2_key)
  const imgFile  = !isUrl && isImage(filename)

  async function handleClick() {
    if (isUrl) { window.open(urlText, '_blank', 'noopener'); return }
    setDlLoading(true)
    try {
      // `inline` disposition on the signed URL — safe for the lightbox path too.
      const url = await getDownloadUrl(file.r2_key, file.name ?? undefined)
      if (imgFile) { onImageClick(url) } else { window.open(url, '_blank', 'noopener') }
    } finally { setDlLoading(false) }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      {imgFile ? (
        <button type="button" onClick={handleClick} disabled={dlLoading}
          className="w-[70px] h-[54px] rounded-lg bg-line overflow-hidden shrink-0 hover:opacity-80 transition-opacity flex items-center justify-center">
          <span className="text-[9px] text-muted font-medium">{fileExtLabel(filename)}</span>
        </button>
      ) : isUrl ? (
        <div className="w-6 h-6 rounded-md bg-terracotta/10 flex items-center justify-center shrink-0">
          <LinkIcon size={12} className="text-terracotta" />
        </div>
      ) : (
        <div className="w-6 h-6 rounded-md bg-line flex items-center justify-center shrink-0 text-muted">
          <FileTypeIcon filename={filename} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <button type="button" onClick={handleClick} disabled={dlLoading}
          className={cn('text-xs text-left truncate max-w-full hover:underline block', isUrl ? 'text-terracotta' : 'text-ink')}>
          {filename}
        </button>
        {!isUrl && <p className="text-[10px] text-muted">{fileExtLabel(filename)}</p>}
      </div>

      {!isUrl && !imgFile && (
        <button type="button" onClick={handleClick} disabled={dlLoading}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-bg transition-colors shrink-0">
          <Download size={14} />
        </button>
      )}

      {!readOnly && (
        <button type="button" onClick={onMove} title="Move to…"
          className="w-10 h-10 flex items-center justify-center rounded-lg text-muted opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-bg transition-all shrink-0">
          <FolderInput size={14} />
        </button>
      )}

      {!readOnly && (
        <button type="button" onClick={onDelete}
          className="w-10 h-10 flex items-center justify-center rounded-lg text-muted opacity-0 group-hover:opacity-100 hover:text-terracotta hover:bg-terracotta/5 transition-all shrink-0">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}
