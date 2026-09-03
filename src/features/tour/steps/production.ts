import type { TourStep } from '../engine'
import { bellStep, dateStripStep, outroSteps, scheduleViewsStep } from './common'

// Production: schedule orientation + the narrow edit surface. 9 steps.
export const productionSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourProductionIntroTitle', bodyKey: 'tourProductionIntroBody' },
  scheduleViewsStep,
  dateStripStep,
  { id: 'fields', titleKey: 'tourProductionFieldsTitle', bodyKey: 'tourProductionFieldsBody' },
  { id: 'files', titleKey: 'tourProductionFilesTitle', bodyKey: 'tourProductionFilesBody' },
  bellStep,
  ...outroSteps,
]
