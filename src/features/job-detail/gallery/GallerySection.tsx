'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MessageSquare, Mic, Folder, PenLine, Factory, CheckCircle2, FileText, Play, Link2, Check, FileSpreadsheet, File as FileIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { t, type LangCode } from '@/lib/i18n'
import { useToast } from '@/components/Toast'
import {
  buildGallery, chipsFor, groupByDay, type GalleryChip, type GalleryFile, type GalleryItem, type GallerySource, type GalleryVoice,
} from '@/lib/utils/gallery'
import { canDeleteForEveryone, pageFileGates, everyoneBatch } from '@/lib/storage/gallery-delete'
import type { StageJob4Rules } from '@/lib/utils/job-stage-rules'
import type { Role } from '@/lib/supabase/types'
import { useSignedUrls, useOnVisible, downloadFile } from './useSignedUrls'
import { MediaViewer } from './MediaViewer'
import { PdfViewer } from './PdfViewer'
import { DeleteDialog } from './DeleteDialog'

/**
 * The job Gallery (Nic, 2026-11-11; spec 2026-11-11 Part 3): every photo,
 * video, voice note, document and link on the job, WhatsApp style. A tab
 * after Chat on a phone, a section under the chat on a computer.
 *
 * It loads its own list on the person's OWN session (RLS decides, exactly as
 * for the Files tab and chat), then drops what their job page doesn't show
 * them (`show`) and what they hid for themselves. Live: any change to the
 * job's files, messages or their own hides reloads it.
 *
 * Other parts of the page talk to it through window events, like the tour:
 *   'gallery:open'  {key}  — the chat opens a photo in this viewer
 *   'chat:goto'     {key}  — sent by Go to message (ChatSection scrolls)
 *   'job:tab'       'chat' — switches the phone tab (JobFormLayout)
 */

type Props = {
  jobId: string
  userId: string
  role: Role
  isAdmin: boolean
  lang: LangCode
  job: StageJob4Rules & { completed_at: string | null }
  show: { chat: boolean; designBrief: boolean }
}

type View = 'media' | 'docs' | 'links'

const SOURCE_ICON: Record<GallerySource, typeof Folder> = {
  chat: MessageSquare, voice: Mic, files: Folder, design_brief: PenLine, production: Factory, completion: CheckCircle2, do: FileText,
}
const SOURCE_LABEL: Record<GallerySource, 'galleryChat' | 'galleryVoiceNote' | 'galleryFiles' | 'galleryDesignBrief' | 'galleryProduction' | 'galleryCompletion' | 'galleryDo'> = {
  chat: 'galleryChat', voice: 'galleryVoiceNote', files: 'galleryFiles', design_brief: 'galleryDesignBrief',
  production: 'galleryProduction', completion: 'galleryCompletion', do: 'galleryDo',
}
const CHIP_LABEL: Record<GalleryChip, 'galleryChat' | 'galleryVoice' | 'galleryFiles' | 'galleryCompletion' | 'galleryDo'> = {
  chat: 'galleryChat', voice: 'galleryVoice', files: 'galleryFiles', completion: 'galleryCompletion', do: 'galleryDo',
}

const todaySG = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
const shortTime = (ts: string) => {
  const d = new Date(new Date(ts).getTime() + 8 * 3_600_000)
  const h = d.getUTCHours()
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

export function GallerySection({ jobId, userId, role, isAdmin, lang, job, show }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const { error: showError } = useToast()
  const [files, setFiles] = useState<GalleryFile[]>([])
  const [voices, setVoices] = useState<GalleryVoice[]>([])
  const [hiddenFiles, setHiddenFiles] = useState<Set<string>>(new Set())
  const [hiddenMessages, setHiddenMessages] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState<View>('media')
  const [chip, setChip] = useState<GalleryChip | 'all'>('all')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [viewerKey, setViewerKey] = useState<string | null>(null)
  // Opened from the chat → swipe through everything; from a filtered grid →
  // through that filter. Fixed at opening, so a delete can't swap the list.
  const [viewerAll, setViewerAll] = useState(true)
  const [pdf, setPdf] = useState<GalleryItem | null>(null)
  const [deleting, setDeleting] = useState<GalleryItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const { urls, sign } = useSignedUrls()

  const load = useCallback(async () => {
    type FileRow = Omit<GalleryFile, 'uploaderName'> & { users: { name: string } | null }
    type MsgRow = { id: string; author_id: string | null; voice_url: string | null; ts: string; users: { name: string } | null }
    const [f, m, h] = await Promise.all([
      supabase.from('files').select('id, job_id, kind, bucket_id, r2_key, name, url_text, uploader_id, ts, users!files_uploader_id_fkey ( name )')
        .eq('job_id', jobId) as unknown as Promise<{ data: FileRow[] | null; error: unknown }>,
      supabase.from('messages').select('id, author_id, voice_url, ts, users!messages_author_id_fkey ( name )')
        .eq('job_id', jobId).eq('kind', 'voice') as unknown as Promise<{ data: MsgRow[] | null; error: unknown }>,
      // Missing table (before migration 0070 is applied) reads as "nothing hidden".
      supabase.from('job_item_hides' as never).select('file_id, message_id').eq('job_id', jobId) as unknown as
        Promise<{ data: Array<{ file_id: string | null; message_id: string | null }> | null; error: unknown }>,
    ])
    // A failed read (flaky mobile data) keeps what's on screen rather than
    // showing an empty gallery and closing an open viewer (final review).
    if (!f.error) setFiles((f.data ?? []).map(({ users, ...r }) => ({ ...r, uploaderName: users?.name ?? null })))
    if (!m.error) setVoices((m.data ?? []).filter(r => r.voice_url).map(r => ({
      id: r.id, author_id: r.author_id, authorName: r.users?.name ?? null, voice_url: r.voice_url!, ts: r.ts,
    })))
    if (!h.error) {
      setHiddenFiles(new Set((h.data ?? []).map(r => r.file_id).filter((x): x is string => !!x)))
      setHiddenMessages(new Set((h.data ?? []).map(r => r.message_id).filter((x): x is string => !!x)))
    }
    setLoaded(true)
  }, [supabase, jobId])

  // First load, then reload on any change to this job's files / messages or
  // the person's own hides (debounced: an upload of 10 photos is one reload).
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    void load()
    const soon = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      reloadTimer.current = setTimeout(() => void load(), 400)
    }
    let channel: ReturnType<typeof supabase.channel> | null = null
    let hidesChannel: ReturnType<typeof supabase.channel> | null = null
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      channel = supabase.channel(`job-gallery-${jobId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'files', filter: `job_id=eq.${jobId}` }, soon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` }, soon)
        .subscribe()
      // Its own channel: a table the database doesn't have yet (before 0070)
      // must not stop the files/messages updates (final review I8).
      hidesChannel = supabase.channel(`job-gallery-hides-${jobId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'job_item_hides', filter: `user_id=eq.${userId}` }, soon)
        .subscribe()
    })
    // Same-device changes (a hide or delete here or in the chat) don't wait
    // for the live event.
    window.addEventListener('gallery:changed', soon)
    return () => {
      active = false
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      window.removeEventListener('gallery:changed', soon)
      if (channel) void supabase.removeChannel(channel)
      if (hidesChannel) void supabase.removeChannel(hidesChannel)
    }
  }, [supabase, jobId, userId, load])

  const gallery = useMemo(
    () => buildGallery({ files, voices, hiddenFiles, hiddenMessages, show }),
    [files, voices, hiddenFiles, hiddenMessages, show],
  )
  const chips = chipsFor(gallery.media)
  const media = chip === 'all' ? gallery.media : gallery.media.filter(i => i.source === chip)
  const list = view === 'media' ? media : view === 'docs' ? gallery.docs : gallery.links
  const today = todaySG()
  const groups = groupByDay(list, today)

  // The chat asks this gallery to open a photo (one viewer for both).
  useEffect(() => {
    function onOpen(e: Event) {
      const key = (e as CustomEvent<{ key: string }>).detail?.key
      if (key && gallery.media.some(i => i.key === key)) { setViewerAll(true); setViewerKey(key) }
    }
    window.addEventListener('gallery:open', onOpen)
    return () => window.removeEventListener('gallery:open', onOpen)
  }, [gallery.media])

  // ── Who may delete what for everyone (same rule as the server) ────────────
  const gates = useMemo(() => pageFileGates({ role, isAdmin, viewerId: userId, job }), [role, isAdmin, userId, job])
  const completionCount = files.filter(f => f.kind === 'completion').length
  const canEveryone = useCallback((it: GalleryItem) => canDeleteForEveryone({
    role, isAdmin, viewerId: userId, source: it.source, fileKind: it.fileKind, byId: it.byId,
    jobStatus: job.status, completedAt: job.completed_at,
    otherCompletionFiles: it.fileKind === 'completion' ? completionCount - 1 : completionCount,
    filesLocked: gates.filesLocked, designBriefEditable: gates.designBriefEditable, sentAt: it.ts,
  }), [role, isAdmin, userId, job, completionCount, gates])

  async function hideForMe(items: GalleryItem[]) {
    const res = await fetch('/api/gallery/hide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, items: items.map(i => i.fileId ? { fileId: i.fileId } : { messageId: i.messageId }) }),
    }).catch(() => null)
    if (!res?.ok) showError(t(lang, 'galleryDeleteFailed').replace('{n}', String(items.length)))
    else window.dispatchEvent(new Event('gallery:changed'))
  }

  // One after another, never all at once: each delete is checked against the
  // job as it is after the previous one (final review C1).
  async function deleteForEveryone(items: GalleryItem[]): Promise<number> {
    let failed = 0
    for (const it of items) {
      const ok = await fetch(
        it.fileId ? `/api/files/${it.fileId}` : `/api/jobs/${jobId}/messages/${it.messageId}`, { method: 'DELETE' },
      ).then(r => r.ok).catch(() => false)
      if (!ok) failed++
    }
    if (failed < items.length) window.dispatchEvent(new Event('gallery:changed'))
    return failed
  }

  // Which of a batch really go for everyone: each item's own rule, and on a
  // completed job never the last completion photo (final review C1).
  const everyoneKeys = (items: GalleryItem[]) => everyoneBatch(
    items.map(i => ({ key: i.key, fileKind: i.fileKind, allowed: canEveryone(i) })),
    completionCount, job.status === 'completed',
  )

  async function confirmDelete(everyone: boolean) {
    if (!deleting) return
    setBusy(true)
    try {
      if (everyone) {
        const ok = everyoneKeys(deleting)
        const allowed = deleting.filter(i => ok.has(i.key))
        const rest = deleting.filter(i => !ok.has(i.key))
        const failed = await deleteForEveryone(allowed)
        if (rest.length) await hideForMe(rest)
        if (failed) showError(t(lang, 'galleryDeleteFailed').replace('{n}', String(failed)))
      } else {
        await hideForMe(deleting)
      }
      setDeleting(null)
      setSelected(new Set())
      setSelecting(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  function goToMessage(it: GalleryItem) {
    setViewerKey(null)
    window.dispatchEvent(new CustomEvent('job:tab', { detail: 'chat' }))
    window.dispatchEvent(new CustomEvent('chat:goto', { detail: { key: it.key } }))
  }

  async function openDoc(it: GalleryItem) {
    if (!it.r2Key) return
    if (it.kind === 'pdf') { sign([it.r2Key]); setPdf(it); return }
    const ok = await downloadFile(it.r2Key, it.name)
    if (!ok) showError(t(lang, 'galleryPdfFailed'))
  }

  const toggle = (key: string) => setSelected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n })
  const selectedItems = list.filter(i => selected.has(i.key))
  const tab = (v: View, label: string, n: number) => (
    <button type="button" onClick={() => { setView(v); setSelected(new Set()) }} aria-pressed={view === v}
      className={cn('flex-1 rounded-lg py-1.5 text-xs font-medium', view === v ? 'bg-paper text-ink font-semibold shadow-sm' : 'text-ink2')}>
      {label} <span className="text-muted">{n}</span>
    </button>
  )

  return (
    <div className="rounded-[14px] border border-line bg-paper p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 lg:mb-1">
        <p className="hidden lg:block text-[11px] uppercase tracking-widest text-muted font-medium">{t(lang, 'tabGallery')}</p>
        {view !== 'links' && list.length > 0 && (
          <button type="button" onClick={() => { setSelecting(s => !s); setSelected(new Set()) }}
            className="ml-auto text-xs font-semibold text-terracotta">
            {selecting ? t(lang, 'cancel') : t(lang, 'gallerySelect')}
          </button>
        )}
      </div>

      <div className="flex gap-0.5 rounded-[10px] bg-bg p-[3px]">
        {tab('media', t(lang, 'galleryMedia'), gallery.media.length)}
        {tab('docs', t(lang, 'galleryDocs'), gallery.docs.length)}
        {tab('links', t(lang, 'galleryLinks'), gallery.links.length)}
      </div>

      {view === 'media' && chips.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(['all', ...chips] as const).map(c => (
            <button key={c} type="button" onClick={() => setChip(c)}
              className={cn('whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px]',
                chip === c ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink2')}>
              {c === 'all' ? t(lang, 'galleryAll') : t(lang, CHIP_LABEL[c])}
            </button>
          ))}
        </div>
      )}

      {selecting && selected.size > 0 && (
        <div className="flex items-center justify-between rounded-[10px] bg-ink px-3 py-2 text-paper">
          <span className="text-xs font-semibold">{t(lang, 'gallerySelected').replace('{n}', String(selected.size))}</span>
          <button type="button" onClick={() => setDeleting(selectedItems)}
            className="rounded-lg bg-bad px-3 py-1 text-xs font-semibold text-white">{t(lang, 'galleryDelete')}</button>
        </div>
      )}

      {loaded && list.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">
          {t(lang, view === 'media' ? 'galleryEmptyMedia' : view === 'docs' ? 'galleryEmptyDocs' : 'galleryEmptyLinks')}
        </p>
      )}

      {groups.map(g => (
        <div key={g.label} className="space-y-1.5">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
            {g.label === 'Today' ? t(lang, 'galleryToday') : g.label}
          </p>
          {view === 'media' ? (
            <div className="grid grid-cols-3 gap-[3px]">
              {g.items.map(it => (
                <MediaTile key={it.key} item={it} url={it.r2Key ? urls[it.r2Key] : undefined} onVisible={() => it.r2Key && sign([it.r2Key])}
                  selecting={selecting} selected={selected.has(it.key)}
                  onTap={() => { if (selecting) { toggle(it.key); return } setViewerAll(chip === 'all'); setViewerKey(it.key) }} />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {g.items.map(it => (
                <ListRow key={it.key} item={it} lang={lang} selecting={selecting && view === 'docs'} selected={selected.has(it.key)}
                  onTap={() => {
                    if (selecting && view === 'docs') { toggle(it.key); return }
                    if (it.kind === 'link') { if (it.url) window.open(it.url, '_blank', 'noopener'); return }
                    void openDoc(it)
                  }} />
              ))}
            </div>
          )}
        </div>
      ))}

      <MediaViewer items={viewerAll ? gallery.media : media}
        startKey={viewerKey} open={!!viewerKey} lang={lang}
        onClose={() => setViewerKey(null)}
        onDelete={it => setDeleting([it])}
        onGoToMessage={show.chat ? goToMessage : undefined} />
      <PdfViewer item={pdf} url={pdf?.r2Key ? urls[pdf.r2Key] ?? null : null} open={!!pdf} lang={lang} onClose={() => setPdf(null)} />
      <DeleteDialog open={!!deleting} busy={busy} lang={lang}
        count={deleting?.length ?? 0} everyoneCount={deleting ? everyoneKeys(deleting).size : 0}
        onMe={() => void confirmDelete(false)} onEveryone={() => void confirmDelete(true)} onClose={() => setDeleting(null)} />
    </div>
  )
}

function MediaTile({ item, url, onVisible, selecting, selected, onTap }: {
  item: GalleryItem; url: string | undefined; onVisible: () => void; selecting: boolean; selected: boolean; onTap: () => void
}) {
  const ref = useOnVisible(onVisible)
  const Mark = SOURCE_ICON[item.source]
  return (
    <button ref={ref} type="button" onClick={onTap}
      className={cn('relative aspect-square overflow-hidden rounded bg-line', selected && 'outline outline-[3px] -outline-offset-[3px] outline-terracotta')}>
      {item.kind === 'voice' ? (
        <span className="absolute inset-0 flex items-center justify-center bg-brand-green-soft text-brand-green"><Mic size={22} /></span>
      ) : url ? (
        item.kind === 'video'
          ? <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
          : <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : null}
      {item.kind === 'video' && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"><Play size={12} className="ml-0.5" /></span>
        </span>
      )}
      <span className="absolute bottom-1 left-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black/55 text-white"><Mark size={10} /></span>
      {selecting && (
        <span className={cn('absolute right-1 top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-white',
          selected ? 'bg-terracotta' : 'bg-black/25')}>
          {selected && <Check size={10} className="text-white" strokeWidth={3} />}
        </span>
      )}
    </button>
  )
}

function ListRow({ item, lang, selecting, selected, onTap }: {
  item: GalleryItem; lang: LangCode; selecting: boolean; selected: boolean; onTap: () => void
}) {
  const ext = (item.name.split('.').pop() ?? '').toUpperCase().slice(0, 4)
  const Icon = item.kind === 'link' ? Link2 : /^(XLSX?|CSV)$/.test(ext) ? FileSpreadsheet : item.kind === 'pdf' ? FileText : FileIcon
  return (
    <button type="button" onClick={onTap}
      className={cn('flex w-full min-w-0 items-center gap-2.5 rounded-xl border bg-paper px-2.5 py-2 text-left',
        selected ? 'border-terracotta' : 'border-line')}>
      {selecting && (
        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border',
          selected ? 'border-terracotta bg-terracotta' : 'border-muted')}>
          {selected && <Check size={10} className="text-white" strokeWidth={3} />}
        </span>
      )}
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        item.kind === 'pdf' ? 'bg-bad-soft text-bad' : 'bg-bg text-ink2')}><Icon size={15} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-ink">{item.kind === 'link' ? (item.url ?? item.name) : item.name}</span>
        <span className="block truncate text-[11px] text-muted">
          {t(lang, SOURCE_LABEL[item.source])}{item.by ? ` · ${item.by}` : ''} · {shortTime(item.ts)}
        </span>
      </span>
    </button>
  )
}
