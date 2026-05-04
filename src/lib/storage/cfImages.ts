const ACCOUNT_ID = process.env.CF_IMAGES_ACCOUNT_ID!
const API_TOKEN  = process.env.CF_IMAGES_API_TOKEN!
const DELIVERY   = process.env.CF_IMAGES_DELIVERY_URL! // https://imagedelivery.net/{account-hash}

export interface CfImagesUploadResult {
  uploadUrl: string
  id:        string
}

export async function getCfImagesUploadUrl(): Promise<CfImagesUploadResult> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/images/v2/direct_upload`,
    { method: 'POST', headers: { Authorization: `Bearer ${API_TOKEN}` } },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CF Images API ${res.status}: ${text}`)
  }
  const json = await res.json() as {
    success: boolean
    result:  { id: string; uploadURL: string }
  }
  if (!json.success) throw new Error('CF Images API returned success=false')
  return { uploadUrl: json.result.uploadURL, id: json.result.id }
}

// Constructs the optimised delivery URL for a stored CF Images image.
// variant is a named transform defined in the CF Images dashboard (default: 'public').
export function getCfImagesDeliveryUrl(imageId: string, variant = 'public'): string {
  return `${DELIVERY}/${imageId}/${variant}`
}
