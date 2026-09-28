import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { logApiUsage } from '@/lib/supabase/queries/admin'
import { translateTarget, translateSystemPrompt } from '@/lib/ai/translate'

// Translates a job description into the CALLER's profile language — read from
// their own users row here, not taken from the request, so the screen cannot
// ask for anything else. Nothing is saved; see src/lib/ai/translate.ts.

const MODEL     = 'claude-haiku-4-5-20251001'
const MAX_CHARS = 8000

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { id: string; lang: string | null }
  const { data: profile } = await supabase
    .from('users')
    .select('id, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile) return new Response('Not provisioned', { status: 403 })

  const target = translateTarget(profile.lang)
  if (!target) return Response.json({ error: 'Nothing to translate into for this language' }, { status: 400 })

  const { value } = await req.json() as { value?: string }
  if (!value?.trim()) return Response.json({ error: 'No text provided' }, { status: 400 })
  if (value.length > MAX_CHARS) return Response.json({ error: 'Text is too long to translate' }, { status: 400 })

  const ip        = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined
  const userAgent = req.headers.get('user-agent') ?? undefined

  let message: Anthropic.Message
  try {
    message = await anthropic.messages.create({
      model:       MODEL,
      max_tokens:  2048,
      temperature: 0,
      system:      translateSystemPrompt(target),
      messages:    [{ role: 'user', content: value }],
    })
  } catch (e) {
    console.error('[ai/translate] model call failed', e)
    return Response.json({ error: 'Translation failed' }, { status: 502 })
  }

  const translation = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()
  if (!translation) return Response.json({ error: 'Translation failed' }, { status: 502 })

  const tokensIn  = message.usage.input_tokens
  const tokensOut = message.usage.output_tokens
  // Haiku 4.5 pricing: ~$0.80 / 1M input, ~$4 / 1M output (same figures as ai/suggest)
  const cost = (tokensIn / 1_000_000) * 0.80 + (tokensOut / 1_000_000) * 4

  // Awaited, not fire-and-forget: Vercel freezes the function once the
  // response returns.
  await logApiUsage({
    service:        'anthropic',
    endpoint:       'ai/translate',
    called_by:      profile.id,
    tokens_in:      tokensIn,
    tokens_out:     tokensOut,
    estimated_cost: cost,
    ip_address:     ip,
    user_agent:     userAgent,
  }).catch(() => {})

  return Response.json({ translation })
}
