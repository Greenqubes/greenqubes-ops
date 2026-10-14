import { redirect } from 'next/navigation'

// Ongoing became part of the Jobs tab (Nic, 2026-10-14).
export default function OngoingRedirect() {
  redirect('/job-list')
}
