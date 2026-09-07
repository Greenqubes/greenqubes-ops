// Installer job-completion rules (Nic, 2026-09-04).
//
// Installers finish their own jobs from the field: the Completed button on
// the job form is greyed out until at least one completion photo has been
// uploaded, then goes green. Only installers get the button (the scheduler
// keeps the separate "Mark job complete" override, photo-free by design),
// and only while the job is still scheduled.
//
// The server route (/api/jobs/[id]/complete) re-checks all of this against
// the database — these rules only drive what the button looks like.

export type InstallerCompleteState = 'hidden' | 'disabled' | 'enabled'

export function installerCompleteState(p: {
  role:                 string
  status:               string
  completionPhotoCount: number
}): InstallerCompleteState {
  if (p.role !== 'installer' || p.status !== 'scheduled') return 'hidden'
  return p.completionPhotoCount > 0 ? 'enabled' : 'disabled'
}

// "Signed DO (Optional)" only exists once production has ticked DO issued —
// no DO issued means there is nothing to sign (the installer view already
// says "No DO Required" for the same condition). An already-uploaded signed
// DO always stays visible, even if the tick is later removed.
export function showSignedDoSection(p: {
  doIssued:          boolean
  signedDoFileCount: number
}): boolean {
  return p.doIssued || p.signedDoFileCount > 0
}
