import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import { en } from '@/lib/i18n/en'
import { getEffectiveRole } from '@/lib/utils/role-override'
import type { Role } from '@/lib/supabase/types'

const roleColor: Record<string, string> = {
  sales:     'var(--blue)',
  scheduler: 'var(--amber)',
  installer: 'var(--green)',
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  type Profile = { name: string; role: Role; lang: string }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role, lang')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }

  if (profile) {
    const effectiveRole = await getEffectiveRole(profile.role)
    if (effectiveRole === 'installer') redirect('/installer')
    if (effectiveRole === 'sales' || effectiveRole === 'scheduler') redirect('/schedule')
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 space-y-6"
        style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--line)',
        }}
      >
        <p
          className="font-display text-xl font-medium tracking-widest uppercase text-center"
          style={{ color: 'var(--ink)' }}
        >
          Green<span style={{ color: 'var(--terracotta)' }}>qubes</span>
        </p>

        {profile ? (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-medium" style={{ color: 'var(--ink)' }}>
                {profile.name}
              </p>
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium lowercase"
                style={{
                  backgroundColor: `color-mix(in srgb, ${roleColor[profile.role]} 12%, transparent)`,
                  color: roleColor[profile.role],
                }}
              >
                {profile.role}
              </span>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {user.email}
            </p>
            <SignOutButton />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--ink2)' }}>
              {en.notProvisioned}
            </p>
            <SignOutButton />
          </div>
        )}
      </div>
    </main>
  )
}
