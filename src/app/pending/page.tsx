import { redirect } from 'next/navigation'

// Pending was renamed Ongoing, then folded into the Jobs tab (Nic, 2026-10-14).
// Old bookmarks and links land there.
export default function PendingRedirect() {
  redirect('/job-list')
}
