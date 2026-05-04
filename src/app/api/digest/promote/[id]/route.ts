import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import type { Json } from '@/lib/supabase/types'

const anthropic = new Anthropic()

function verifySignature(chatId: string, sig: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(chatId)
    .digest('hex')
    .slice(0, 16)
  return expected === sig
}

type ChatMsg = { role: string; content: string }

function parseMsgs(msgs: Json): ChatMsg[] {
  if (!Array.isArray(msgs)) return []
  return msgs.filter((m): m is ChatMsg =>
    typeof m === 'object' && m !== null && 'role' in m && 'content' in m &&
    typeof (m as Record<string, unknown>).role === 'string' &&
    typeof (m as Record<string, unknown>).content === 'string'
  )
}

async function summarise(msgs: Json, topic: string | null): Promise<string> {
  const conversation = parseMsgs(msgs).map(m => `${m.role}: ${m.content}`).join('\n')
  if (!conversation.trim()) return topic ?? '[No content]'

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: `Summarise this AI assistant conversation in one paragraph (max 200 words) for an Obsidian knowledge-base note. Focus on useful learnings, decisions, or techniques discussed. Write in third person ("The team discussed…"). No preamble.\n\n${conversation}`,
    }],
  })

  return res.content[0].type === 'text' ? res.content[0].text : '[Summary unavailable]'
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const sig = req.nextUrl.searchParams.get('sig') ?? ''

  if (!sig || !verifySignature(id, sig)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const db = createServiceClient()

  const { data: chat, error } = await db
    .from('asst_chats')
    .select('id, user_id, msgs, topic, tags, ts')
    .eq('id', id)
    .single()

  if (error || !chat) {
    return new NextResponse('Not found', { status: 404 })
  }

  const summary  = await summarise(chat.msgs, chat.topic)
  const date     = new Date(chat.ts).toISOString().split('T')[0]
  const topic    = chat.topic ?? 'Untitled conversation'
  const tags     = chat.tags?.length ? chat.tags.join(', ') : 'assistant, digest'

  const noteContent = `---
visibility: [public-internal]
tags: [${tags}]
source: ai-assistant
date: ${date}
---

# ${topic}

${summary}

_Source: AI Assistant conversation on ${date} · Promoted from Monday digest_
`

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Promote to Obsidian — ${escHtml(topic)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #F4F1EC; color: #1A1815; padding: 24px; }
    h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    p.sub { font-size: 13px; color: #5C564E; margin-bottom: 20px; }
    pre {
      background: #fff; border: 1px solid #E8E2D7; border-radius: 10px;
      padding: 16px; font-size: 13px; line-height: 1.6; white-space: pre-wrap;
      word-break: break-word; margin-bottom: 16px;
    }
    button {
      background: #B5523D; color: #fff; border: none; border-radius: 8px;
      padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer;
    }
    button:active { opacity: 0.8; }
    .copied { background: #3F7D5C !important; }
  </style>
</head>
<body>
  <h1>${escHtml(topic)}</h1>
  <p class="sub">Copy the note below and paste into your Obsidian vault as a new .md file.</p>
  <pre id="note">${escHtml(noteContent)}</pre>
  <button id="btn" onclick="copy()">Copy to clipboard</button>
  <script>
    function copy() {
      navigator.clipboard.writeText(document.getElementById('note').textContent).then(() => {
        const btn = document.getElementById('btn');
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy to clipboard'; btn.classList.remove('copied'); }, 2000);
      });
    }
  </script>
</body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
