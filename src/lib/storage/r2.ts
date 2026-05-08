import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'
import type { FileKind } from '@/lib/supabase/types'

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
}

export function generateKey(jobId: string, kind: FileKind, originalName: string): string {
  const ext  = originalName.includes('.') ? originalName.split('.').pop() : undefined
  const name = ext ? `${randomUUID()}.${ext}` : randomUUID()
  return `jobs/${jobId}/${KIND_FOLDER[kind]}/${name}`
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
  jobId: string,
  kind: FileKind,
  filename: string,
  contentType: string,
): Promise<{ url: string; key: string }> {
  const key = generateKey(jobId, kind, filename)
  const url = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  )
  return { url, key }
}

export async function getDownloadUrl(key: string): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 },
  )
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
  return { url, key }
}
