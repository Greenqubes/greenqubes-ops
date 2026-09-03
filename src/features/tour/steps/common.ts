import type { TourStep } from '../engine'

// Steps shared by several role scripts. The outro is the mandated closer for
// EVERY script (scripts.test.ts enforces it): account area → Connect
// Telegram → done. 'open-nav-drawer' is a mobile-only no-op on desktop;
// 'account' resolves to whichever UserMenu avatar is visible.
export const bellStep: TourStep = {
  id: 'bell', targets: ['bell'],
  titleKey: 'tourBellTitle', bodyKey: 'tourBellBody',
}

export const scheduleViewsStep: TourStep = {
  id: 'schedule-views', route: '/schedule', targets: ['schedule-views'],
  titleKey: 'tourScheduleViewsTitle', bodyKey: 'tourScheduleViewsBody',
}

export const dateStripStep: TourStep = {
  id: 'date-strip', targets: ['date-strip'],
  titleKey: 'tourDateStripTitle', bodyKey: 'tourDateStripBody',
}

// Any step that targets a nav tab needs before: 'open-nav-drawer' — on the
// phone the tabs live inside the closed hamburger drawer (on desktop the
// action is a no-op and the target resolves to BottomNav instead).
export const completedTabStep: TourStep = {
  id: 'completed-tab', before: 'open-nav-drawer', targets: ['nav-completed'],
  titleKey: 'tourCompletedTitle', bodyKey: 'tourCompletedBody',
}

export const outroSteps: TourStep[] = [
  { id: 'account', before: 'open-nav-drawer', targets: ['account'],
    titleKey: 'tourAccountTitle', bodyKey: 'tourAccountBody' },
  // Both actions in order: on the phone the account menu lives inside the
  // drawer, so the drawer must be (re)opened before the menu can.
  { id: 'telegram', before: ['open-nav-drawer', 'open-account-menu'], targets: ['connect-telegram'],
    titleKey: 'tourTelegramTitle', bodyKey: 'tourTelegramBody' },
  { id: 'done', titleKey: 'tourDoneTitle', bodyKey: 'tourDoneBody' },
]
