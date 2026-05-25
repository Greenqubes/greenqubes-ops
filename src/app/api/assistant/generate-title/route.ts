import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { messages: { role: string; content: string }[] }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }

  const { messages } = body
  if (!messages?.length) return new Response('Bad request', { status: 400 })

  const snippet = messages
    .slice(0, 2)
    .map(m => `${m.role.toUpperCase()}: ${m.content.slice(0, 300)}`)
    .join('\n')

  try {
    const res = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [{
        role:    'user',
        content: `Give a 3–5 word title for this conversation. Reply with only the title — no punctuation, no quotes, no explanation.\n\n${snippet}`,
      }],
    })

    const title = (res.content[0] as { type: 'text'; text: string }).text.trim()
    return Response.json({ title })
  } catch {
    return new Response('Title generation failed', { status: 500 })
  }
}
