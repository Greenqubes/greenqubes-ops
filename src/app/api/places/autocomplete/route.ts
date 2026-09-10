import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logApiUsage } from '@/lib/supabase/queries/admin'

/**
 * Address suggestions for the job form's Location box.
 *
 * The Google key lives ONLY on the server (GOOGLE_MAPS_API_KEY in Vercel), so
 * it never reaches a browser and cannot be lifted off someone's phone. Every
 * caller must be signed in — this is not an open proxy to Google's billing.
 *
 * With no key configured the route answers `configured: false` and the form
 * quietly stays a plain text box, so the feature can ship before the key does.
 */

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete'

// Below three characters every address in Singapore matches; not worth a call.
const MIN_QUERY_LENGTH = 3

export interface PlaceSuggestion {
  /** The suggestion's own text — used as-is if the details lookup fails. */
  full:      string
  /** Place name or street line — the bold half of the row. */
  main:      string
  /** Town / postcode line beneath it. */
  secondary: string
  /** Looked up for the detailed address (unit number, postcode) on tap. */
  placeId:   string
  /** Google's labels — an establishment keeps its name in front (composeAddress). */
  types:     string[]
}

export interface AutocompleteResponse {
  configured:  boolean
  suggestions: PlaceSuggestion[]
}

type GooglePrediction = {
  placePrediction?: {
    placeId?: string
    types?:   string[]
    text?: { text?: string }
    structuredFormat?: {
      mainText?:      { text?: string }
      secondaryText?: { text?: string }
    }
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json<AutocompleteResponse>({ configured: false, suggestions: [] })
  }

  const { input, sessionToken } = await req.json() as { input?: string; sessionToken?: string }
  const query = (input ?? '').trim()
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json<AutocompleteResponse>({ configured: true, suggestions: [] })
  }

  try {
    const res = await fetch(PLACES_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      // Singapore only — the whole team installs here, and it keeps the list
      // short enough to be useful on a phone. The session token ties this
      // typing to the details lookup that follows, so Google bills the pair
      // as one session rather than a request each.
      body: JSON.stringify({
        input:               query,
        includedRegionCodes: ['sg'],
        ...(sessionToken ? { sessionToken } : {}),
      }),
    })

    if (!res.ok) {
      console.error('[places/autocomplete]', res.status, await res.text())
      return NextResponse.json<AutocompleteResponse>({ configured: true, suggestions: [] })
    }

    const data = await res.json() as { suggestions?: GooglePrediction[] }

    void logApiUsage({
      service:        'google_places',
      endpoint:       'autocomplete',
      called_by:      user.id,
      estimated_cost: 0, // inside Google's monthly free allowance at this volume
    })

    const suggestions: PlaceSuggestion[] = (data.suggestions ?? [])
      .map(s => {
        const full      = s.placePrediction?.text?.text ?? ''
        const main      = s.placePrediction?.structuredFormat?.mainText?.text ?? full
        const secondary = s.placePrediction?.structuredFormat?.secondaryText?.text ?? ''
        return {
          full, main, secondary,
          placeId: s.placePrediction?.placeId ?? '',
          types:   s.placePrediction?.types ?? [],
        }
      })
      .filter(s => s.full)
      .slice(0, 5)

    return NextResponse.json<AutocompleteResponse>({ configured: true, suggestions })
  } catch (err) {
    // A Google outage must never block someone typing an address by hand.
    console.error('[places/autocomplete]', err)
    return NextResponse.json<AutocompleteResponse>({ configured: true, suggestions: [] })
  }
}
