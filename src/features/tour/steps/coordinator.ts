import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Coordinator: sales-level job flow, suggest-only for installers. 12 steps.
// nav-pending may not exist for this role's tabs — the engine degrades that
// step to a centred card, which reads fine.
export const coordinatorSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourCoordinatorIntroTitle', bodyKey: 'tourCoordinatorIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'pending', before: 'open-nav-drawer', targets: ['nav-pending'], titleKey: 'tourCoordPendingTitle', bodyKey: 'tourCoordPendingBody' },
  { id: 'new-job', targets: ['new-job'], titleKey: 'tourNewJobTitle', bodyKey: 'tourNewJobBody' },
  { id: 'job-form', route: '/jobs/new', targets: ['job-details', 'job-tabs'], titleKey: 'tourJobFormTitle', bodyKey: 'tourJobFormBody' },
  { id: 'job-team', before: 'job-tab-team', targets: ['job-team'], titleKey: 'tourCoordSuggestTitle', bodyKey: 'tourCoordSuggestBody' },
  { id: 'job-actions', targets: ['job-actions'], titleKey: 'tourJobActionsTitle', bodyKey: 'tourJobActionsBody' },
  { id: 'fcfs', route: '/fcfs', targets: ['fcfs-board'], titleKey: 'tourFcfsTitle', bodyKey: 'tourFcfsBody' },
  bellStep,
  ...outroSteps,
]
