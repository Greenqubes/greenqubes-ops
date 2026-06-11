import { redirect } from 'next/navigation'

// Workflow V2: the approval workflow is gone. This route redirects to the
// schedule until the FCFS Board (Phase 3) takes over at /fcfs.
export default function ApprovalsPage() {
  redirect('/schedule')
}
