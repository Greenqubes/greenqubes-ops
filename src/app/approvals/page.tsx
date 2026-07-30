import { redirect } from 'next/navigation'

// Workflow V2: the approval workflow is gone — the FCFS Board (Phase 3)
// replaced it as the planning view.
export default function ApprovalsPage() {
  redirect('/fcfs')
}
