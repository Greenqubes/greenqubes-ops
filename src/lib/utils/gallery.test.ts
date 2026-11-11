/**
 * Standalone test for the job gallery rules (no test framework).
 * Run: npx tsx src/lib/utils/gallery.test.ts
 * Exits 1 on any failure.
 */
import {
  mediaKindOf, buildGallery, chipsFor, dayLabel, groupByDay, chatAlbums, clampIndex, visibleKeysToSign,
  type GalleryFile, type GalleryVoice,
} from './gallery'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// ── File types ──────────────────────────────────────────────────────────────
check('jpg upper', mediaKindOf('IMG_4021.JPG'), 'image')
check('heic',      mediaKindOf('site.heic'), 'image')
check('mov',       mediaKindOf('walk.MOV'), 'video')
check('pdf',       mediaKindOf('DO.pdf'), 'pdf')
check('xlsx',      mediaKindOf('list.xlsx'), 'doc')
check('no ext',    mediaKindOf('noext'), 'doc')

// ── What the gallery holds ──────────────────────────────────────────────────
const f = (id: string, kind: string, bucket: string | null, name: string, ts: string, url: string | null = null): GalleryFile =>
  ({ id, job_id: 'j1', kind, bucket_id: bucket, r2_key: `jobs/j1/${name}`, name, url_text: url, uploader_id: 'u1', uploaderName: 'Ahmad', ts })
const files: GalleryFile[] = [
  f('f1', 'attachment', null, 'IMG_1.jpg', '2026-11-09T02:00:00Z'),
  f('f2', 'attachment', 'b1', 'brief.pdf', '2026-11-09T03:00:00Z'),
  f('f3', 'completion', null, 'walk.mov', '2026-11-09T04:00:00Z'),
  f('f4', 'design_brief', null, 'mood.png', '2026-11-09T05:00:00Z'),
  f('f5', 'url_link', 'b1', 'Drive folder', '2026-11-09T06:00:00Z', 'https://drive.google.com/x'),
]
const voices: GalleryVoice[] = [{ id: 'm1', author_id: 'u2', authorName: 'Li Min', voice_url: 'jobs/j1/voice/a.webm', ts: '2026-11-09T07:00:00Z' }]
const all = { files, voices, hiddenFiles: new Set(['f2']), hiddenMessages: new Set<string>(), show: { chat: true, designBrief: true } }
const g = buildGallery(all)
check('media newest first, hidden dropped', g.media.map(i => i.key), ['m:m1', 'f:f4', 'f:f3', 'f:f1'])
check('docs: hidden pdf dropped', g.docs.map(i => i.key), [])
check('links', g.links.map(i => i.key + ' ' + i.url), ['f:f5 https://drive.google.com/x'])
check('sources', g.media.map(i => i.source), ['voice', 'design_brief', 'completion', 'chat'])
check('kinds', g.media.map(i => i.kind), ['voice', 'image', 'video', 'image'])
check('who', [g.media[0].by, g.media[3].by], ['Li Min', 'Ahmad'])
check('no chat for HR', buildGallery({ ...all, show: { chat: false, designBrief: true } }).media.map(i => i.key), ['f:f4', 'f:f3'])
check('no design brief for installers', buildGallery({ ...all, show: { chat: true, designBrief: false } }).media.map(i => i.key), ['m:m1', 'f:f3', 'f:f1'])
check('docs when not hidden', buildGallery({ ...all, hiddenFiles: new Set() }).docs.map(i => i.key + ' ' + i.source), ['f:f2 files'])
check('hidden voice dropped', buildGallery({ ...all, hiddenMessages: new Set(['m1']) }).media.map(i => i.key), ['f:f4', 'f:f3', 'f:f1'])

// ── Filter chips ────────────────────────────────────────────────────────────
check('chips: only what is there, fixed order', chipsFor(g.media), ['chat', 'voice', 'completion'])

// ── Day groups ──────────────────────────────────────────────────────────────
check('today',              dayLabel('2026-11-11T05:00:00Z', '2026-11-11'), 'Today')
check('this month (SG date)', dayLabel('2026-11-08T17:30:00Z', '2026-11-11'), 'Mon 9 Nov')
check('earlier month',      dayLabel('2026-10-02T03:00:00Z', '2026-11-11'), 'October 2026')
check('groups', groupByDay(g.media, '2026-11-09').map(x => `${x.label}:${x.items.length}`), ['Today:4'])

// ── Chat albums ─────────────────────────────────────────────────────────────
const at = (s: number) => new Date(Date.UTC(2026, 10, 11, 10, 0, s)).toISOString()
const img = (key: string, by: string, s: number) => ({ key, isImage: true, byId: by, ts: at(s) })
check('5 quick photos → one album', chatAlbums([img('a', 'A', 0), img('b', 'A', 30), img('c', 'A', 70), img('d', 'A', 120), img('e', 'A', 210)]), [['a', 'b', 'c', 'd', 'e']])
check('3 photos → no album', chatAlbums([img('a', 'A', 0), img('b', 'A', 10), img('c', 'A', 20)]), [])
check('3-minute gap breaks it', chatAlbums([img('a', 'A', 0), img('b', 'A', 30), img('c', 'A', 210), img('d', 'A', 240)]), [])
check('someone else in between', chatAlbums([img('a', 'A', 0), img('b', 'A', 10), img('x', 'B', 20), img('c', 'A', 30), img('d', 'A', 40), img('e', 'A', 50), img('f', 'A', 60)]), [['c', 'd', 'e', 'f']])
check('a text message breaks it', chatAlbums([img('a', 'A', 0), img('b', 'A', 10), { key: 't', isImage: false, byId: 'A', ts: at(15) }, img('c', 'A', 20), img('d', 'A', 30)]), [])

// ── Viewer and loading helpers ──────────────────────────────────────────────
check('clamp past end', clampIndex(5, 5), 4)
check('clamp empty', clampIndex(2, 0), 0)
check('clamp negative', clampIndex(-1, 3), 0)
check('sign only what is new', visibleKeysToSign(['a', 'b', 'c'], new Set(['b'])), ['a', 'c'])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll gallery checks passed')
