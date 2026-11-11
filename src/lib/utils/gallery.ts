/**
 * The job Gallery (Nic, 2026-11-11; spec 2026-11-11-gallery-groups-bulk-sheet
 * -design.md Part 3): every picture, video, voice note, document and link on a
 * job in one WhatsApp-style place. This file decides WHAT it holds and how it
 * is grouped; who may delete what is src/lib/storage/gallery-delete.ts.
 *
 * It holds only what the job page already shows that person: HR gets no chat
 * items (`show.chat`), installers no design-brief files (`show.designBrief`),
 * and anything they hid for themselves is dropped.
 */

export type GallerySource = 'chat' | 'voice' | 'files' | 'design_brief' | 'production' | 'completion' | 'do'
export type GalleryKind = 'image' | 'video' | 'voice' | 'pdf' | 'doc' | 'link'

export type GalleryFile = {
  id: string
  job_id: string | null
  kind: string
  bucket_id: string | null
  r2_key: string
  name: string | null
  url_text: string | null
  uploader_id: string | null
  uploaderName: string | null
  ts: string
}

export type GalleryVoice = {
  id: string
  author_id: string | null
  authorName: string | null
  voice_url: string
  ts: string
}

export type GalleryItem = {
  /** 'f:<file id>' or 'm:<message id>' — unique across both. */
  key: string
  fileId?: string
  messageId?: string
  source: GallerySource
  kind: GalleryKind
  /** The files row's kind (completion, do, …); null for voice notes. */
  fileKind: string | null
  name: string
  r2Key: string | null
  url: string | null
  byId: string | null
  by: string | null
  ts: string
}

const IMAGE = /\.(jpe?g|png|gif|webp|heic|heif)$/i
const VIDEO = /\.(mp4|mov|m4v|webm|3gp)$/i

export function mediaKindOf(name: string): 'image' | 'video' | 'pdf' | 'doc' {
  if (IMAGE.test(name)) return 'image'
  if (VIDEO.test(name)) return 'video'
  if (/\.pdf$/i.test(name)) return 'pdf'
  return 'doc'
}

function sourceOf(f: GalleryFile): GallerySource {
  if (f.bucket_id) return 'files'
  switch (f.kind) {
    case 'attachment':              return 'chat'
    case 'design_brief':            return 'design_brief'
    case 'production_instructions': return 'production'
    case 'completion':              return 'completion'
    case 'do':                      return 'do'
    default:                        return 'files'   // photo, external_verification, url_link
  }
}

const newestFirst = (a: GalleryItem, b: GalleryItem) => b.ts.localeCompare(a.ts)

export function buildGallery(input: {
  files: GalleryFile[]
  voices: GalleryVoice[]
  hiddenFiles: Set<string>
  hiddenMessages: Set<string>
  show: { chat: boolean; designBrief: boolean }
}): { media: GalleryItem[]; docs: GalleryItem[]; links: GalleryItem[] } {
  const media: GalleryItem[] = [], docs: GalleryItem[] = [], links: GalleryItem[] = []
  const allowed = (s: GallerySource) =>
    (input.show.chat || (s !== 'chat' && s !== 'voice')) && (input.show.designBrief || s !== 'design_brief')

  for (const f of input.files) {
    if (input.hiddenFiles.has(f.id)) continue
    const source = sourceOf(f)
    if (!allowed(source)) continue
    const name = f.name || f.r2_key.split('/').pop() || f.r2_key
    const base = { key: `f:${f.id}`, fileId: f.id, source, fileKind: f.kind, name, byId: f.uploader_id, by: f.uploaderName, ts: f.ts }
    if (f.kind === 'url_link') { links.push({ ...base, kind: 'link', r2Key: null, url: f.url_text }); continue }
    const kind = mediaKindOf(name)
    const item: GalleryItem = { ...base, kind, r2Key: f.r2_key, url: null }
    if (kind === 'image' || kind === 'video') media.push(item)
    else docs.push(item)
  }

  if (allowed('voice')) {
    for (const v of input.voices) {
      if (input.hiddenMessages.has(v.id)) continue
      media.push({
        key: `m:${v.id}`, messageId: v.id, source: 'voice', kind: 'voice', fileKind: null,
        name: 'Voice note', r2Key: v.voice_url, url: null, byId: v.author_id, by: v.authorName, ts: v.ts,
      })
    }
  }

  return { media: media.sort(newestFirst), docs: docs.sort(newestFirst), links: links.sort(newestFirst) }
}

const CHIP_ORDER = ['chat', 'voice', 'files', 'completion', 'do'] as const
export type GalleryChip = typeof CHIP_ORDER[number]

/** The filter chips worth showing: only sources the Media view has. Design
 *  brief and production items show under All only (spec). */
export function chipsFor(media: GalleryItem[]): GalleryChip[] {
  const present = new Set(media.map(i => i.source))
  return CHIP_ORDER.filter(c => present.has(c))
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MON3   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

/** The Singapore calendar date of a timestamp, as YYYY-MM-DD. */
function sgDate(tsISO: string): string {
  return new Date(new Date(tsISO).getTime() + 8 * 3_600_000).toISOString().slice(0, 10)
}

/** 'Today', 'Mon 9 Nov' (same month), or 'October 2026' (earlier). English
 *  always — dates are never translated (hard rule); the screen swaps 'Today'. */
export function dayLabel(tsISO: string, todayISO: string): string {
  const d = sgDate(tsISO)
  if (d === todayISO) return 'Today'
  const [y, m, day] = d.split('-').map(Number)
  if (d.slice(0, 7) === todayISO.slice(0, 7)) {
    const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
    return `${DAYS[dow]} ${day} ${MON3[m - 1]}`
  }
  return `${MONTHS[m - 1]} ${y}`
}

export function groupByDay(items: GalleryItem[], todayISO: string): Array<{ label: string; items: GalleryItem[] }> {
  const out: Array<{ label: string; items: GalleryItem[] }> = []
  for (const it of items) {
    const label = dayLabel(it.ts, todayISO)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(it)
    else out.push({ label, items: [it] })
  }
  return out
}

const ALBUM_MIN = 4
const ALBUM_GAP_MS = 2 * 60_000

/** WhatsApp-style albums: 4+ images in a row by the same person, each within
 *  2 minutes of the one before. Anything else in between breaks the run. */
export function chatAlbums(items: Array<{ key: string; isImage: boolean; byId: string | null; ts: string }>): string[][] {
  const albums: string[][] = []
  let run: typeof items = []
  const flush = () => { if (run.length >= ALBUM_MIN) albums.push(run.map(r => r.key)); run = [] }
  for (const it of items) {
    const prev = run[run.length - 1]
    const joins = it.isImage && prev && prev.byId === it.byId
      && new Date(it.ts).getTime() - new Date(prev.ts).getTime() <= ALBUM_GAP_MS
    if (joins) { run.push(it); continue }
    flush()
    if (it.isImage) run = [it]
  }
  flush()
  return albums
}

/** Keeps the viewer on a real item when items vanish under it. */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

/** Tiles reported visible that still need a signed link. */
export function visibleKeysToSign(visible: string[], signed: Set<string>): string[] {
  return visible.filter(k => !signed.has(k))
}
