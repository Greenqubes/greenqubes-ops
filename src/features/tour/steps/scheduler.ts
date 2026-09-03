import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Scheduler: the schedule + FCFS assignment loop. 12 steps.
export const schedulerSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourSchedulerIntroTitle', bodyKey: 'tourSchedulerIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'completed-tab', before: 'open-nav-drawer', targets: ['nav-completed'], titleKey: 'tourCompletedTitle', bodyKey: 'tourSchedulerCompletedBody' },
  { id: 'fcfs', route: '/fcfs', targets: ['fcfs-board'], titleKey: 'tourFcfsSchedulerTitle', bodyKey: 'tourFcfsSchedulerBody' },
  { id: 'assign', targets: ['fcfs-board'], titleKey: 'tourAssignTitle', bodyKey: 'tourAssignBody' },
  { id: 'suggest-vs-assign', titleKey: 'tourSuggestVsAssignTitle', bodyKey: 'tourSuggestVsAssignBody' },
  { id: 'design-tab', before: 'open-nav-drawer', targets: ['nav-design-load'], titleKey: 'tourDesignTabTitle', bodyKey: 'tourDesignTabBody' },
  bellStep,
  ...outroSteps,
]
