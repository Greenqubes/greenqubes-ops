# Signed DO Scan — Design

_Status: DRAFT for Nic's review (2026-10-05). Brainstormed 2026-09-30 → 2026-10-05._

## 1. Why

Signed delivery orders are **sent to the client** with the invoice (Nic). Today an installer uploads a plain phone
photo — glass counter, watch boxes and a phone shadow included — and the paper copy travels back to the office,
where Nic runs it through the office scanner. The goal is a **clean, client-ready PDF in the app the same day**,
made from a phone photo, without waiting for the paper.

Success: a DO photographed on site becomes an A4 PDF that looks scanned — straight, cropped to the page, white
paper, no shadows, stamp and signature in colour — in a few taps, and an existing DO photo can be turned into the
same PDF from the PC.

## 2. Decisions (Nic's, 2026-09-30)

| Question | Decision |
|---|---|
| Who uses the result | Sent to the client → must look professional |
| File | **PDF**, one file per DO, multi-page allowed |
| Look | **Colour, whitened** (blue stamp keeps its colour) — no B&W option |
| Where | **Signed DO only** (completion/production photos are site photos; cropping would cut them) |
| Who | **Everyone**, designers included ("easier to apply to all") |
| Where it runs | On the device, our own code — **approach A**. No OpenCV, no new vendor, no server image processing |
| PC result | **Saved into Signed DO AND downloaded** to the PC for invoicing |
| Phone | Installer taps Scan → photo → corners found automatically → Save; drag only if wrong |

## 3. What the 2026-09-30 test showed (9 real photos, `Downloads\DO-test` + the Mustafa DO)

- Simple brightness-based corner finding: **5 of 9 right**. Fails when the paper touches something else white
  (another sheet, a notebook, a light box).
- OpenCV, tried three ways: at best **4 of 9**, exact when it found the page but finding it less often; costs a
  ~10 MB download. Using both methods together would reach about 6 of 9 — not enough gain to justify the download.
- Both fail on paper lying on other paper. Dropbox/iPhone use trained models and will beat us on those.
- Conclusion: **automatic corners are a head start, not a promise.** Corner dragging is part of the design, not a
  fallback, and a miss costs ~5 seconds. Team tip for the changelog: *put the paper on something dark or plain*.
- The whitening worked once two bugs were fixed (see §6): a per-cell "brightest 5%" paper estimate removes the
  phone shadow without hollowing out the logo or the grey table header.

## 4. How it works for people

### Phone (installer on site, or anyone)
1. Signed DO section → **Scan** (beside the existing Attach files, which stays).
2. Camera opens (`<input type="file" accept="image/*" capture="environment">` — the chat already does this, so it
   works on every phone without camera permissions code).
3. Full-screen editor: the photo with four corner dots already placed. Drag any dot; a magnifier shows under the
   finger. If no paper is found, the dots start at a 5% inset rectangle.
4. **Next** → the cleaned page. Buttons: **Retake** · **Add page** · **Save**.
5. **Save** uploads one PDF into Signed DO. The phone does not download a copy.

### PC (Nic invoicing)
1. Each **image** in Signed DO gets a **Scan** button beside download/delete.
2. Same editor, mouse drag; pages can be added from other images in Signed DO or from a file on the PC.
3. **Save** uploads the PDF into Signed DO **and** downloads it. The original photo stays on the job.

### Designers
Scan is shown to them too. Signed DO uploading is hidden from designers today (and the database only lets a
designer add files to jobs they are assigned to), so for a designer **Save becomes Download** — they get the PDF,
the job is untouched. Opening Signed DO uploads to designers is a separate decision, not part of this.

### Assumption to confirm
On the **phone** only the PDF is saved — the raw photo is not uploaded alongside it (smaller upload on site data;
the PDF is the record). On the **PC** the original photo is already on the job and stays.

## 5. Output

- A4 portrait, 2480 × 3508 px (300 dpi) per page, JPEG quality ~0.85 inside the PDF → roughly 400–700 KB a page.
- Landscape documents: if the dragged corners are wider than tall, the page is A4 landscape.
- File name: `Signed DO - <job title> - <DD Mon YYYY>.pdf` (date = today; title trimmed and stripped of characters
  file systems reject).
- Stored as `files.kind = 'do'` through the existing upload route — `validateContentType` already accepts anything
  for `do`, so **no server change**. Delete rules, the 24-hour window and everything else apply unchanged.

## 6. Architecture

Everything new lives in `src/lib/scan/` (pure, standalone-tested) and `src/features/scan/` (screens).

| Unit | Job | Notes |
|---|---|---|
| `lib/scan/detect-corners.ts` | RGBA + size → four corners or `null` | Downscale to 400 px, Otsu brightness + low-colour mask, erode, pick the large central blob, corners by x±y extremes; reject results whose shape is not paper-like (area < 12%, aspect outside 1.15–1.75, a corner on the photo's edge) → `null` |
| `lib/scan/geometry.ts` | Corner ordering, homography solve, output size + orientation | Pure maths |
| `lib/scan/warp.ts` | Straighten: inverse homography + bilinear sampling | Output A4 RGBA |
| `lib/scan/whiten.ts` | Paper estimate per grid cell (95th-percentile brightness, ~48 × 68 cells), smoothed, divide, stretch levels | Keeps colour |
| `lib/scan/pdf.ts` | JPEG pages → PDF bytes | Hand-written minimal PDF (one `/DCTDecode` image per page). **No new npm package** |
| `lib/scan/load-source.ts` | Photo (File or existing file's signed URL) → downscaled RGBA, EXIF rotation applied | `createImageBitmap(..., { imageOrientation: 'from-image' })`; long edge capped at 3000 px |
| `features/scan/scan.worker.ts` | Runs warp + whiten + JPEG encode off the main thread | `OffscreenCanvas`; a ~10M-pixel loop would otherwise freeze the screen for seconds on a mid-range phone |
| `features/scan/ScanModal.tsx` | The full-screen flow: editor → preview → pages → save | Portalled to `<body>`, **`z-[70]`** (above BottomNav `z-50`, hard rule); claims unsaved work via `useUnsavedWork` while pages exist |
| `features/scan/CornerEditor.tsx` | Draggable dots + magnifier | Pointer events (mouse + touch in one) |
| `ProductionReadySection.tsx` | `UploadSection` gains Scan for `kind="do"`: a header button, and a per-row button on images | Upload logic factored into one helper so Attach and Scan share the same checked path |

**Existing photos on the PC** are read straight from file storage with the existing signed download URL. Checked
2026-10-05: storage already allows browser `GET` from production, `*-git-*` previews and `localhost:3000`, so no
storage setting changes.

**Two bugs from the spike to guard in tests:** the whitening first hollowed out large dark areas (background
estimate too fine and not ink-proof — fixed by the percentile grid), and then silently did nothing because a
resized one-channel image came back as three channels and was read with the wrong stride. `whiten.ts` must assert
the background buffer's length.

## 7. Errors

- Photo will not decode (HEIC on an old desktop browser, corrupt file) → "Couldn't open this photo" toast, nothing saved.
- Upload refused or storage PUT fails → the existing upload error message with the real reason (same path as Attach).
- Closing the scanner with unsaved pages → confirm "Discard this scan?".
- Memory: the source is capped at 3000 px and pages are held as JPEG blobs, not raw pixels, so a 5-page DO stays small.

## 8. Testing

- Standalone tests (repo pattern) for `geometry`, `warp` (a known square maps to a known square), `whiten`
  (shadowed synthetic page comes out uniform; a large dark block survives; buffer-length guard), `pdf` (valid
  header/xref/trailer, page count, A4 media box), `detect-corners` (synthetic page on dark background found;
  white-on-white returns `null` rather than a wrong shape), and the file-name rule.
- **Real-file check** (standing lesson — fixtures missed real bugs before): a throwaway script runs the real modules
  on Nic's 9 photos + the Mustafa DO and produces a contact sheet; the result must be at least the spike's 5/9
  correct automatically and every page must look right after manual corners. Photos stay out of git.
- Nic on the preview: one phone scan on site paper, one PC scan of an existing Signed DO photo, open both PDFs.

## 9. Not in this

OpenCV / smarter auto-detect (revisit only if dragging becomes a complaint — the 9-photo set is the benchmark),
B&W mode, scanning anywhere but Signed DO, reading the DO number off the page, opening Signed DO uploads to
designers. No migration, no new vendor, no new npm dependency.
