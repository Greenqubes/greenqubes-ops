import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logApiUsage } from '@/lib/supabase/queries/admin'

/**
 * The full address behind a tapped suggestion — unit number and postcode
 * included, which is what a driver actually needs (Nic, 2026-09-10).
 *
 * Same rules as the autocomplete route: signed-in callers only, and the key
 * stays on the server. `formattedAddress` is deliberately the ONLY field
 * asked for — it sits in Google's cheapest (Essentials) tier, while fields
 * like the display name cost three times as much and we already have the name
 * from the suggestion itself.
 */

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places'

export interface PlaceDetailsResponse {
  /** '' when unavailable — the caller then keeps the suggestion's own text. */
  formattedAddress: string
}

// A place id is opaque but always plain ASCII; anything else is not ours.
const PLACE_ID = /^[A-Za-z0-9_-]{1,255}$/

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '' })

  const { placeId, sessionToken } = await req.json() as { placeId?: string; sessionToken?: string }
  if (!placeId || !PLACE_ID.test(placeId)) {
    return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '' })
  }

  try {
    const url = new URL(`${PLACES_ENDPOINT}/${placeId}`)
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken)

    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key':   apiKey,
        'X-Goog-FieldMask': 'formattedAddress',
      },
    })

    if (!res.ok) {
      console.error('[places/details]', res.status, await res.text())
      return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '' })
    }

    const data = await res.json() as { formattedAddress?: string }

    void logApiUsage({
      service:        'google_places',
      endpoint:       'details',
      called_by:      user.id,
      estimated_cost: 0, // inside Google's monthly free allowance at this volume
    })

    return NextResponse.json<PlaceDetailsResponse>({
      formattedAddress: data.formattedAddress ?? '',
    })
  } catch (err) {
    console.error('[places/details]', err)
    return NextResponse.json<PlaceDetailsResponse>({ formattedAddress: '' })
  }
}
