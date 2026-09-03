import { NextRequest, NextResponse }              from 'next/server'
import { createClient }                           from '@/lib/supabase/server'
import { createServiceClient }                    from '@/lib/supabase/service'
import { getUsageSummary, getUnusualActivity,
         getLastEventTime, type HealthCheck }     from '@/lib/supabase/queries/admin'
import { cronFreshness }                          from '@/lib/utils/cron-health'

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

async function checkTelegramBot(label: string, tokenEnvVar: string): Promise<HealthCheck> {
  const token = process.env[tokenEnvVar]
  if (!token) return { label, status: 'warn', detail: `${tokenEnvVar} not set` }
  try {
    const res  = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' })
    const json = await res.json() as { ok: boolean; result?: { username?: string } }
    if (!json.ok) throw new Error('Bot token invalid')
    return { label, status: 'ok', detail: `@${json.result?.username ?? 'bot'} active` }
  } catch (err) {
    return { label, status: 'error', detail: (err as Error).message }
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

async function checkLastCron(label: string, eventKind: string, maxGapHours: number, expectation: string): Promise<HealthCheck> {
  const ts  = await getLastEventTime(eventKind)
  const res = cronFreshness(ts, new Date().toISOString(), maxGapHours, expectation)
  if (res.status !== 'ok') return { label, status: res.status, detail: res.detail }
  return {
    label,
    status: 'ok',
    detail: `Last run ${new Date(res.lastRunISO).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' })} SGT`,
  }
}

type UsageWindow = '30d' | '7d' | 'today'

// "Today" = since midnight Singapore time (UTC+8, no DST), not last-24-hours.
function windowSince(window: UsageWindow): string {
  if (window === 'today') {
    const sgt = new Date(Date.now() + 8 * 3_600_000)
    return new Date(Date.UTC(sgt.getUTCFullYear(), sgt.getUTCMonth(), sgt.getUTCDate()) - 8 * 3_600_000).toISOString()
  }
  const days = window === '7d' ? 7 : 30
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

export async function GET(req: NextRequest) {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const raw    = req.nextUrl.searchParams.get('window')
  const window: UsageWindow = raw === '7d' || raw === 'today' ? raw : '30d'

  const [checks, usage, unusual] = await Promise.all([
    Promise.all([
      checkSupabase(),
      checkTelegramBot('Telegram ops bot',    'TELEGRAM_BOT_TOKEN'),
      checkTelegramBot('Telegram digest bot', 'TELEGRAM_DIGEST_BOT_TOKEN'),
      checkTelegramBot('Telegram bugs bot',   'TELEGRAM_BUG_BOT_TOKEN'),
      checkLastSync(),
      // Longest normal gap is 15h (6pm → next 9am); only a longer silence warns.
      checkLastCron('Overdue cron', 'overdue_check',     16, 'runs twice daily, 9am + 6pm SGT'),
      checkLastCron('Design cron',  'design_daily_cron', 26, 'runs daily, 8:30am SGT'),
    ]),
    getUsageSummary(windowSince(window)),
    getUnusualActivity(7),
  ])

  return NextResponse.json({ checks, usage, unusual })
}
