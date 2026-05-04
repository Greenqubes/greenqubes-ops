import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Sans } from 'next/font/google'
import { ToastProvider }   from '@/components/Toast'
import { ErrorBoundary }   from '@/components/ErrorBoundary'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],  // variable font — weight range 100–900 available via CSS
})

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Greenqubes Ops',
  description: 'Internal operations platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${ibmPlexSans.variable}`}>
      <head>
        {/* CJK + Bengali: system fonts handle these on all target devices */}
      </head>
      <body className="font-body antialiased">
        <ErrorBoundary>
          <ToastProvider>{children}</ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
