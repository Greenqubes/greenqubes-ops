import { ExternalHomePage } from '@/features/external/ExternalHomePage'

export const metadata = { title: 'GreenQubes — Your Jobs' }

// Public page — no session, no role. The middleware lets /ext/ through and
// the client component validates the token against /api/ext/[token].
export default async function ExtPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <ExternalHomePage token={token} />
}
