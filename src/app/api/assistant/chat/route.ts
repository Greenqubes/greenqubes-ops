import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { retrieveContext, formatContext } from '@/lib/ai/retrieve'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// web_search_20250305 is a built-in Anthropic server tool; not yet in ToolUnion for SDK 0.39.x
type WebSearchTool = { type: 'web_search_20250305'; name: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { name: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile) return new Response('Not provisioned', { status: 403 })

  const body = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }
  const { messages } = body

  // Retrieve relevant context for the last user message
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  const ctx         = await retrieveContext(lastUserMsg)
  const contextBlock = formatContext(ctx)

  const today = new Date().toLocaleDateString('en-SG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'Asia/Singapore',
  })

  const systemParts = [
    `You are the Greenqubes internal operations assistant — an AI for a Singapore-based installation company.`,
    `Today: ${today} (Singapore time)`,
    `User: ${profile.name} (${profile.role})`,
  ]
  if (contextBlock) systemParts.push(`\n${contextBlock}`)
  systemParts.push(
    `\nGuidelines:\n- Keep answers concise and actionable — the team is often in the field.\n- If you don't know something, say so.\n- You can search the web for current information when relevant.`,
  )
  const system = systemParts.join('\n')

  const encoder  = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      try {
        const stream = anthropic.messages.stream({
          model:      'claude-sonnet-4-6',
          max_tokens: 1024,
          system,
          messages,
          tools: [{ type: 'web_search_20250305', name: 'web_search' } as unknown as Anthropic.Messages.ToolUnion],
        })

        stream.on('text', text => send({ type: 'text', text }))

        await stream.finalMessage()

        send({ type: 'done' })
      } catch (err) {
        send({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' })
      }

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  })
}
