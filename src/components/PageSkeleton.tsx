// Instant placeholder rendered by each route's loading.tsx while the server
// prepares the real page. Mirrors the app frame (top bar / cards / bottom nav)
// so a tap paints immediately instead of freezing on the previous page.
//
// 'tabs'   — list/dashboard pages that render BottomNav (mobile: hamburger +
//            centered logo + bell, like CompanyBar's role variant).
// 'detail' — pages without BottomNav (job form, admin, assistant): plain bar.

interface Props {
  variant?: 'tabs' | 'detail'
}

export function PageSkeleton({ variant = 'tabs' }: Props) {
  return (
    <div className="min-h-screen bg-bg">
      {/* Top bar — same frame as CompanyBar */}
      <div className="sticky top-0 z-30 px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-line bg-bg">
        {variant === 'tabs' ? (
          <>
            <div className="lg:hidden flex flex-1 items-center">
              <div className="h-8 w-8 rounded-full bg-line animate-pulse" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/greenqubes-logo.png" alt="" className="brand-logo h-5 w-auto lg:hidden" />
            <div className="lg:hidden flex flex-1 items-center justify-end">
              <div className="h-8 w-8 rounded-full bg-line animate-pulse" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/greenqubes-logo.png" alt="" className="brand-logo h-5 w-auto hidden lg:block" />
            <div className="hidden lg:flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-line animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-line animate-pulse" />
            </div>
          </>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/greenqubes-logo.png" alt="" className="brand-logo h-5 w-auto" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-line animate-pulse" />
              <div className="h-8 w-8 rounded-full bg-line animate-pulse" />
            </div>
          </>
        )}
      </div>

      {/* Content placeholder */}
      <div className="px-4 py-4 space-y-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-line" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-card border border-line bg-paper p-4 space-y-2.5">
            <div className="h-4 w-1/2 rounded bg-line" />
            <div className="h-3 w-2/3 rounded bg-line" />
            <div className="h-3 w-1/3 rounded bg-line" />
          </div>
        ))}
      </div>

      {/* Bottom nav placeholder — tab pages only */}
      {variant === 'tabs' && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-paper border-t border-line">
          <div className="max-w-[480px] mx-auto flex justify-around pt-2 pb-[env(safe-area-inset-bottom,12px)] animate-pulse">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-12 rounded bg-line" />
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}
