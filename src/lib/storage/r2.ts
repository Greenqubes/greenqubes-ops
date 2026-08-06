import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import type { FileKind } from '@/lib/supabase/types'
import { logApiUsage } from '@/lib/supabase/queries/admin'

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!

const KIND_FOLDER: Record<FileKind, string> = {
  photo:                   'photos',
  completion:              'completion',
  voice:                   'voice',
  do:                      'do',
  attachment:              'attachments',
  url_link:                'links',
  production_instructions: 'production-instructions',
  external_verification:   'external-verification',
}

// `folder` is the job's readable r2_folder slug (new jobs) or the bare job id
// (jobs created before migration 0042 — never renamed).
export function generateKey(folder: string, kind: FileKind, originalName: string): string {
  const ext  = originalName.includes('.') ? originalName.split('.').pop() : undefined
  const name = ext ? `${randomUUID()}.${ext}` : randomUUID()
  return `jobs/${folder}/${KIND_FOLDER[kind]}/${name}`
}

export function isImageKind(kind: FileKind): boolean {
  return kind === 'photo' || kind === 'completion'
}

// photos/completion → image/*, voice → audio/*, do+attachment → any
export function validateContentType(kind: FileKind, contentType: string): boolean {
  if (isImageKind(kind)) return contentType.startsWith('image/')
  if (kind === 'voice')   return contentType.startsWith('audio/')
  return true
}

export async function getUploadUrlForKind(
  folder: string,
  kind: FileKind,
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const key = generateKey(folder, kind, filename)
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'put', estimated_cost: 0 })
  return { url, key }
}

export async function getDownloadUrl(key: string, filename?: string): Promise<string> {
  const url = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key:    key,
      ...(filename ? { ResponseContentDisposition: contentDisposition(filename) } : {}),
    }),
    { expiresIn: 3600 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'get', estimated_cost: 0 })
  return url
}

// `inline` keeps in-tab previews (PDF/image) working; filename* (RFC 5987)
// names the file on save — filenames may contain Chinese characters or spaces.
function contentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename)
    .replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `inline; filename*=UTF-8''${encoded}`
}

// Server-side R2→R2 object copy (no download/re-upload). CopySource must be
// percent-encoded per path segment — folder slugs may contain Unicode
// (Chinese project titles).
export async function copyObject(sourceKey: string, destKey: string): Promise<void> {
  await r2.send(new CopyObjectCommand({
    Bucket:     BUCKET,
    CopySource: [BUCKET, ...sourceKey.split('/')].map(encodeURIComponent).join('/'),
    Key:        destKey,
  }))
  void logApiUsage({ service: 'r2', endpoint: 'copy', estimated_cost: 0 })
}

export async function getBugScreenshotUploadUrl(
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const ext = filename.includes('.') ? filename.split('.').pop() : 'jpg'
  const key = `bug-reports/${randomUUID()}.${ext}`
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
  void logApiUsage({ service: 'r2', endpoint: 'put', estimated_cost: 0 })
  return { url, key }
}
