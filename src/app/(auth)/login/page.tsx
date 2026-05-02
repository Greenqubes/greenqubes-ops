'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { en } from '@/lib/i18n/en'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(en.authError)
      setLoading(false)
    }
    // On success the browser navigates away — no state to update
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 space-y-8"
        style={{
          backgroundColor: 'var(--paper)',
          border: '1px solid var(--line)',
        }}
      >
        {/* Wordmark */}
        <p
          className="font-display text-xl font-medium tracking-widest uppercase text-center"
          style={{ color: 'var(--ink)' }}
        >
          Green<span style={{ color: 'var(--terracotta)' }}>qubes</span>
        </p>

        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
            style={{
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              backgroundColor: 'var(--paper)',
            }}
          >
            {/* Google "G" logo */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"/>
            </svg>
            {loading ? en.loading : 'Sign in with Google'}
          </button>

          {error && (
            <p className="text-xs text-center" style={{ color: 'var(--terracotta)' }}>
              {error}
            </p>
          )}
        </div>

        <p className="text-xs text-center" style={{ color: 'var(--muted)' }}>
          Use your work or personal Google account
        </p>
      </div>
    </main>
  )
}
