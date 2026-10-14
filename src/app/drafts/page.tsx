import { redirect } from 'next/navigation'

// Drafts became the Drafts switch inside the Jobs tab (Nic, 2026-10-14).
export default function DraftsRedirect() {
  redirect('/job-list?view=drafts')
}
