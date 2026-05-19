import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { logApiUsage } from '@/lib/supabase/queries/admin'

// ── Edit this one object to change how Claude polishes text ───────────────────
const SUGGEST_CONFIG = {
  model: 'claude-haiku-4-5-20251001',
  style: 'Fix grammar and clarity. Keep the original meaning and tone. Return only the improved text — no commentary, no explanation, no markdown.',
  // future: enableRag: false
} as const
// ─────────────────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { id: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile) return new Response('Not provisioned', { status: 403 })

  const body = await req.json() as { field?: string; value?: string }
  const { field, value } = body
  if (!value?.trim()) return Response.json({ error: 'No text provided' }, { status: 400 })

  const ip        = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined
  const userAgent = req.headers.get('user-agent') ?? undefined

  const message = await anthropic.messages.create({
    model:      SUGGEST_CONFIG.model,
    max_tokens: 512,
    system:     SUGGEST_CONFIG.style,
    messages: [{
      role:    'user',
      content: field
        ? `This is the "${field}" field. Text to improve:\n\n${value}`
        : `Text to improve:\n\n${value}`,
    }],
  })

  const suggestion = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  const tokensIn  = message.usage.input_tokens
  const tokensOut = message.usage.output_tokens
  // Haiku 4.5 pricing: ~$0.80 / 1M input, ~$4 / 1M output
  const cost = (tokensIn / 1_000_000) * 0.80 + (tokensOut / 1_000_000) * 4

  void logApiUsage({
    service:        'anthropic',
    endpoint:       'ai/suggest',
    called_by:      profile.id,
    tokens_in:      tokensIn,
    tokens_out:     tokensOut,
    estimated_cost: cost,
    ip_address:     ip,
    user_agent:     userAgent,
  })

  return Response.json({ suggestion })
}
