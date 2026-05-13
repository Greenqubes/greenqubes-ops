import { NextResponse }                           from 'next/server'
import { createClient }                           from '@/lib/supabase/server'
import { createServiceClient }                    from '@/lib/supabase/service'
import { getUsageSummary, getUnusualActivity,
         getLastEventTime, type HealthCheck }     from '@/lib/supabase/queries/admin'

async function guardAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { role: string } | null; error: unknown }
  return profile?.role === 'admin'
}

async function checkSupabase(): Promise<HealthCheck> {
  try {
    const db = createServiceClient()
    const { error } = await db.from('users').select('id').limit(1)
    if (error) throw error
    return { label: 'Supabase', status: 'ok', detail: 'Database reachable' }
  } catch {
    return { label: 'Supabase', status: 'error', detail: 'Database unreachable' }
  }
}

async function checkTelegram(): Promise<HealthCheck> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return { label: 'Telegram bot', status: 'warn', detail: 'TELEGRAM_BOT_TOKEN not set' }
  try {
    const res  = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' })
    const json = await res.json() as { ok: boolean; result?: { username?: string } }
    if (!json.ok) throw new Error('Bot token invalid')
    return { label: 'Telegram bot', status: 'ok', detail: `@${json.result?.username ?? 'bot'} active` }
  } catch (err) {
    return { label: 'Telegram bot', status: 'error', detail: (err as Error).message }
  }
}

async function checkLastSync(): Promise<HealthCheck> {
  const ts = await getLastEventTime('obsidian_sync')
  if (!ts) return { label: 'Obsidian sync', status: 'unknown', detail: 'No sync recorded yet' }
  const age = Date.now() - new Date(ts).getTime()
  const days = Math.floor(age / 86_400_000)
  if (days > 2) return { label: 'Obsidian sync', status: 'warn', detail: `Last sync ${days} days ago` }
  return {
    label:  'Obsidian sync',
    status: 'ok',
    detail: `Last synced ${new Date(ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })}`,
  }
}

async function checkLastOverdueCron(): Promise<HealthCheck> {
  const ts = await getLastEventTime('overdue_check')
  if (!ts) return { label: 'Overdue cron', status: 'unknown', detail: 'No cron run recorded yet' }
  const age = Date.now() - new Date(ts).getTime()
  const hrs = Math.floor(age / 3_600_000)
  if (hrs > 4) return { label: 'Overdue cron', status: 'warn', detail: `Last run ${hrs}h ago (expected every 2h)` }
  return {
    label:  'Overdue cron',
    status: 'ok',
    detail: `Last run ${new Date(ts).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })} SGT`,
  }
}

export async function GET() {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [checks, usage, unusual] = await Promise.all([
    Promise.all([checkSupabase(), checkTelegram(), checkLastSync(), checkLastOverdueCron()]),
    getUsageSummary(30),
    getUnusualActivity(7),
  ])

  return NextResponse.json({ checks, usage, unusual })
}
