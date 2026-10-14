import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Sales: create → push → suggest. 15 steps (Drafts added 2026-10-09).
export const salesSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourSalesIntroTitle', bodyKey: 'tourSalesIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'drafts', before: 'open-nav-drawer', targets: ['nav-drafts'], titleKey: 'tourDraftsTitle', bodyKey: 'tourDraftsBody' },
  { id: 'ongoing', before: 'open-nav-drawer', targets: ['nav-ongoing'], titleKey: 'tourOngoingTitle', bodyKey: 'tourOngoingBody' },
  { id: 'new-job', targets: ['new-job'], titleKey: 'tourNewJobTitle', bodyKey: 'tourNewJobBody' },
  { id: 'job-form', route: '/jobs/new', targets: ['job-details', 'job-tabs'], titleKey: 'tourJobFormTitle', bodyKey: 'tourJobFormBody' },
  { id: 'job-team', before: 'job-tab-team', targets: ['job-team'], titleKey: 'tourJobTeamTitle', bodyKey: 'tourJobTeamBody' },
  { id: 'job-actions', targets: ['job-actions'], titleKey: 'tourJobActionsTitle', bodyKey: 'tourJobActionsBody' },
  { id: 'fcfs', route: '/fcfs', targets: ['fcfs-board'], titleKey: 'tourFcfsTitle', bodyKey: 'tourFcfsBody' },
  { id: 'design-tab', before: 'open-nav-drawer', targets: ['nav-design-load'], titleKey: 'tourDesignTabTitle', bodyKey: 'tourDesignTabBody' },
  bellStep,
  ...outroSteps,
]
