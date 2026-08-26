import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLinkToken } from '@/lib/telegram/link-token'

// GET /api/telegram/link — redirects the signed-in user to the ops bot with
// their personal signed /start token. The webhook completes the link by
// writing their chat id onto their users row.

let cachedBotUsername: string | null = null

async function getBotUsername(): Promise<string | null> {
  if (cachedBotUsername) return cachedBotUsername
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return null
  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
  if (!res.ok) return null
  const body = await res.json() as { ok: boolean; result?: { username?: string } }
  cachedBotUsername = body.result?.username ?? null
  return cachedBotUsername
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Account not provisioned' }, { status: 403 })

  const token    = createLinkToken(profile.id)
  const username = await getBotUsername()
  if (!token || !username) {
    return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 })
  }

  return NextResponse.redirect(`https://t.me/${username}?start=${token}`)
}
