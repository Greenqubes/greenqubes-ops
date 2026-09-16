import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logApiUsage } from '@/lib/supabase/queries/admin'

/**
 * The full address behind a tapped suggestion — unit number and postcode
 * included, which is what a driver actually needs (Nic, 2026-09-10).
 *
 * Same rules as the autocomplete route: signed-in callers only, and the key
 * stays on the server. `formattedAddress` was deliberately the ONLY field
 * asked for — it sits in Google's cheapest (Essentials) tier, while fields
 * like the display name cost three times as much and we already have the name
 * from the suggestion itself.
 *
 * ONE field was added on 2026-09-16: `location`, the map coordinates. Google
 * puts it in the SAME Essentials tier (verified against their SKU
 * documentation, not assumed), so asking for it costs nothing extra. Nothing
 * reads the coordinates yet — they are captured against a future "which
 * driver is already near this job" feature (Nic's call) so real data is
 * accumulating before it is needed. See migration 0061.
 */

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places'

export interface PlaceDetailsResponse {
  /** '' when unavailable — the caller then keeps the suggestion's own text. */
  formattedAddress: string
  /** Null when Google gave no location. Same Essentials SKU as the address,
   *  so asking for it costs nothing extra. */
  lat: number | null
  lng: number | null
}

// A place id is opaque but always plain ASCII; anything else is not ours.
const PLACE_ID = /^[A-Za-z0-9_-]{1,255}$/

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '', lat: null, lng: null })

  const { placeId, sessionToken } = await req.json() as { placeId?: string; sessionToken?: string }
  if (!placeId || !PLACE_ID.test(placeId)) {
    return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '', lat: null, lng: null })
  }

  try {
    const url = new URL(`${PLACES_ENDPOINT}/${placeId}`)
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken)

    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key':   apiKey,
        'X-Goog-FieldMask': 'formattedAddress,location',
      },
    })

    if (!res.ok) {
      console.error('[places/details]', res.status, await res.text())
      return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '', lat: null, lng: null })
    }

    const data = await res.json() as {
      formattedAddress?: string
      location?: { latitude?: number; longitude?: number }
    }

    void logApiUsage({
      service:        'google_places',
      endpoint:       'details',
      called_by:      user.id,
      estimated_cost: 0, // inside Google's monthly free allowance at this volume
    })

    return NextResponse.json<PlaceDetailsResponse>({
      formattedAddress: data.formattedAddress ?? '',
      lat: typeof data.location?.latitude  === 'number' ? data.location.latitude  : null,
      lng: typeof data.location?.longitude === 'number' ? data.location.longitude : null,
    })
  } catch (err) {
    console.error('[places/details]', err)
    return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '', lat: null, lng: null })
  }
}
