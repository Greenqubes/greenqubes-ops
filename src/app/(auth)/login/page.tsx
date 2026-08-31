import LoginCard from './LoginCard'

type Props = { searchParams: Promise<{ error?: string }> }

// The auth callback and middleware send people here with ?error=auth or
// ?error=account_removed — read it on the server so the card can show a message.
export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams
  return <LoginCard errorCode={error ?? null} />
}
