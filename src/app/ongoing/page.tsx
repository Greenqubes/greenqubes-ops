import { redirect } from 'next/navigation'

// Ongoing became part of the Jobs tab (Nic, 2026-10-14).
export default function OngoingRedirect() {
  redirect('/job-list?view=ongoing') // the bare address opens the role default since To arrange (2026-11-04)
}
