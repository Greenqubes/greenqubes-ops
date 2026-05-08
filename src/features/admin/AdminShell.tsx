'use client'

import { useState }    from 'react'
import { cn }          from '@/lib/utils/cn'
import { BottomNav }   from '@/components/BottomNav'
import { UserMenu }    from '@/components/UserMenu'
import { UsersTab }      from '@/features/admin/UsersTab'
import { DigestTab }     from '@/features/admin/DigestTab'
import { HealthTab }     from '@/features/admin/HealthTab'
import { CrashLogTab }  from '@/features/admin/CrashLogTab'
import { BugReportsTab } from '@/features/admin/BugReportsTab'
import type { LangCode } from '@/lib/supabase/types'

type Tab = 'users' | 'digest' | 'health' | 'crashes' | 'bugs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'users',   label: 'Users'   },
  { id: 'digest',  label: 'Digest'  },
  { id: 'health',  label: 'Health'  },
  { id: 'crashes', label: 'Crashes' },
  { id: 'bugs',    label: 'Bugs'    },
]

type Props = {
  userName: string
  role:     'scheduler'
  lang:     LangCode
}

export function AdminShell({ userName, role, lang }: Props) {
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div className="min-h-screen bg-bg lg:pb-0 pb-24">

      {/* ── Top header (full width) ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-paper border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted font-medium mb-0.5">
              Greenqubes
            </p>
            <h1 className="font-display text-2xl font-medium text-ink tracking-tight">
              Admin
            </h1>
          </div>
          <UserMenu />
        </div>

        {/* Mobile-only horizontal tab strip */}
        <div className="lg:hidden max-w-6xl mx-auto px-4 sm:px-6 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium tracking-wide border-b-2 transition-colors',
                tab === t.id
                  ? 'border-terracotta text-terracotta'
                  : 'border-transparent text-muted hover:text-ink2',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 lg:flex lg:gap-8 pt-6 pb-8">

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col gap-1 w-44 shrink-0">
          <p className="text-[11px] uppercase tracking-widest text-muted font-medium px-3 mb-2">
            Navigation
          </p>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === t.id
                  ? 'bg-terracotta/10 text-terracotta'
                  : 'text-ink2 hover:bg-bg hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </aside>

        {/* Tab content */}
        <main className="flex-1 min-w-0">
          {tab === 'users'   && <UsersTab />}
          {tab === 'digest'  && <DigestTab />}
          {tab === 'health'  && <HealthTab />}
          {tab === 'crashes' && <CrashLogTab />}
          {tab === 'bugs'    && <BugReportsTab />}
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <div className="lg:hidden">
        <BottomNav role={role} />
      </div>
    </div>
  )
}
