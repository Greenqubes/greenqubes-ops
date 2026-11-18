/**
 * Standalone test for the job gallery rules (no test framework).
 * Run: npx tsx src/lib/utils/gallery.test.ts
 * Exits 1 on any failure.
 */
import {
  mediaKindOf, buildGallery, chipsFor, dayLabel, groupByDay, chatAlbums, clampIndex, visibleKeysToSign, followIndex,
  galleryDownloads,
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

// ── The viewer follows its photo when the list changes (final review I4) ────
check('same photo, list grew in front', followIndex('b', 1, ['new', 'a', 'b', 'c']), 2)
check('its photo deleted → next one',   followIndex('b', 1, ['a', 'c']), 1)
check('last photo deleted → new last',  followIndex('c', 2, ['a', 'b']), 1)
check('everything gone',               followIndex('a', 0, []), 0)

// ── Batch download (Nic, 2026-11-18: tick several, download them all) ──────
const dl = (p: { name: string; r2Key: string | null; key?: string; ts?: string }) => ({
  key: 'f:x', source: 'chat' as const, kind: 'image' as const, fileKind: 'attachment', url: null, byId: null, by: null,
  ts: '2026-11-18T02:00:00Z', ...p,
})
check('a named file keeps its own name',
  galleryDownloads([dl({ name: 'IMG_4021.JPG', r2Key: 'jobs/a/IMG_4021.JPG' })]),
  [{ r2Key: 'jobs/a/IMG_4021.JPG', filename: 'IMG_4021.JPG' }])
check('a voice note gains its recording ending so it opens',
  galleryDownloads([dl({ name: 'Voice note', r2Key: 'jobs/a/voice/Nic 18 Nov.webm' })]),
  [{ r2Key: 'jobs/a/voice/Nic 18 Nov.webm', filename: 'Voice note.webm' }])
check('links have nothing to download and are skipped',
  galleryDownloads([dl({ name: 'https://x.com', r2Key: null }), dl({ name: 'a.pdf', r2Key: 'k/a.pdf' })]),
  [{ r2Key: 'k/a.pdf', filename: 'a.pdf' }])
check('no ending on either side: the name is left alone',
  galleryDownloads([dl({ name: 'scan', r2Key: 'k/scan' })]),
  [{ r2Key: 'k/scan', filename: 'scan' }])
check('a dot in a folder name is not an ending',
  galleryDownloads([dl({ name: 'Voice note', r2Key: 'jobs/2026.11_x/voice/abc' })]),
  [{ r2Key: 'jobs/2026.11_x/voice/abc', filename: 'Voice note' }])

// Same name, different photo (Nic, 2026-11-18): the phone asked to replace the
// first one. Camera photos are named to the minute, and every voice note is
// "Voice note". Oldest keeps the name; later ones get (2), (3)… counted over
// the WHOLE gallery, so a photo has one name whichever batch it is in.
const p1 = dl({ key: 'f:1', name: 'Nicholas 18 Nov 2026 12:53.jpeg', r2Key: 'k/1.jpeg', ts: '2026-11-18T04:53:01Z' })
const p2 = dl({ key: 'f:2', name: 'Nicholas 18 Nov 2026 12:53.jpeg', r2Key: 'k/2.jpeg', ts: '2026-11-18T04:53:20Z' })
const p3 = dl({ key: 'f:3', name: 'Nicholas 18 Nov 2026 12:53.jpeg', r2Key: 'k/3.jpeg', ts: '2026-11-18T04:53:40Z' })
check('same name twice in one batch: the newer one is numbered',
  galleryDownloads([p2, p1]).map(d => d.filename),
  ['Nicholas 18 Nov 2026 12:53 (2).jpeg', 'Nicholas 18 Nov 2026 12:53.jpeg'])
check('numbered over the whole gallery, not the batch: ticking only the third gives (3)',
  galleryDownloads([p3], [p3, p1, p2]).map(d => d.filename),
  ['Nicholas 18 Nov 2026 12:53 (3).jpeg'])
check('two voice notes no longer clash',
  galleryDownloads([
    dl({ key: 'm:1', name: 'Voice note', r2Key: 'v/a.webm', ts: '2026-11-18T01:00:00Z' }),
    dl({ key: 'm:2', name: 'Voice note', r2Key: 'v/b.webm', ts: '2026-11-18T02:00:00Z' }),
  ]).map(d => d.filename),
  ['Voice note.webm', 'Voice note (2).webm'])
check('names differing only in capitals still clash on a phone, so are numbered',
  galleryDownloads([
    dl({ key: 'f:a', name: 'IMG_1.JPG', r2Key: 'k/a', ts: '2026-11-18T01:00:00Z' }),
    dl({ key: 'f:b', name: 'img_1.jpg', r2Key: 'k/b', ts: '2026-11-18T02:00:00Z' }),
  ]).map(d => d.filename),
  ['IMG_1.JPG', 'img_1 (2).jpg'])
check('same name AND same second: the order still never changes',
  galleryDownloads([
    dl({ key: 'f:b', name: 'x.jpg', r2Key: 'k/b' }),
    dl({ key: 'f:a', name: 'x.jpg', r2Key: 'k/a' }),
  ]).map(d => d.filename),
  ['x (2).jpg', 'x.jpg'])
check('a name with no ending is numbered at the end',
  galleryDownloads([
    dl({ key: 'f:a', name: 'scan', r2Key: 'k/a', ts: '2026-11-18T01:00:00Z' }),
    dl({ key: 'f:b', name: 'scan', r2Key: 'k/b', ts: '2026-11-18T02:00:00Z' }),
  ]).map(d => d.filename),
  ['scan', 'scan (2)'])
check('a ticked item missing from the gallery list is still kept apart',
  galleryDownloads([p1, p2], []).map(d => d.filename),
  ['Nicholas 18 Nov 2026 12:53.jpeg', 'Nicholas 18 Nov 2026 12:53 (2).jpeg'])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll gallery checks passed')
