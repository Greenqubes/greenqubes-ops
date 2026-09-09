import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// HR / Finance: schedule orientation, the Leave tab she owns, and the prices
// she can see but not change. 9 steps, matching the other read-only scripts.
export const hrSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourHrIntroTitle', bodyKey: 'tourHrIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  // Nav tabs live inside the closed hamburger drawer on a phone; the action
  // is a no-op on desktop, where the target resolves to BottomNav instead.
  { id: 'leave', before: 'open-nav-drawer', targets: ['nav-leave'],
    titleKey: 'tourHrLeaveTitle', bodyKey: 'tourHrLeaveBody' },
  { id: 'prices', titleKey: 'tourHrPricesTitle', bodyKey: 'tourHrPricesBody' },
  bellStep,
  ...outroSteps,
]
