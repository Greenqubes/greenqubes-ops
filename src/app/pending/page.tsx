import { redirect } from 'next/navigation'

// The Pending tab was renamed Ongoing (Nic, 2026-10-14). Old bookmarks and
// links to /pending land on the new page.
export default function PendingRedirect() {
  redirect('/ongoing')
}
