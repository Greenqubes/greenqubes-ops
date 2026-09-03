import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Sales: create → push → suggest. 14 steps.
export const salesSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourSalesIntroTitle', bodyKey: 'tourSalesIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'pending', before: 'open-nav-drawer', targets: ['nav-pending'], titleKey: 'tourPendingTitle', bodyKey: 'tourPendingBody' },
  { id: 'new-job', targets: ['new-job'], titleKey: 'tourNewJobTitle', bodyKey: 'tourNewJobBody' },
  { id: 'job-form', route: '/jobs/new', targets: ['job-details', 'job-tabs'], titleKey: 'tourJobFormTitle', bodyKey: 'tourJobFormBody' },
  { id: 'job-team', before: 'job-tab-team', targets: ['job-team'], titleKey: 'tourJobTeamTitle', bodyKey: 'tourJobTeamBody' },
  { id: 'job-actions', targets: ['job-actions'], titleKey: 'tourJobActionsTitle', bodyKey: 'tourJobActionsBody' },
  { id: 'fcfs', route: '/fcfs', targets: ['fcfs-board'], titleKey: 'tourFcfsTitle', bodyKey: 'tourFcfsBody' },
  { id: 'design-tab', before: 'open-nav-drawer', targets: ['nav-design-load'], titleKey: 'tourDesignTabTitle', bodyKey: 'tourDesignTabBody' },
  bellStep,
  ...outroSteps,
]
