import type { TourStep } from '../engine'
import { bellStep, completedTabStep, outroSteps } from './common'

// Installer: home is /installer; job-page details are centred cards (no
// data rows to anchor to on a fresh account). 10 steps.
export const installerSteps: TourStep[] = [
  { id: 'intro', route: '/installer', titleKey: 'tourInstallerIntroTitle', bodyKey: 'tourInstallerIntroBody' },
  { id: 'tabs', targets: ['installer-tabs'], titleKey: 'tourInstallerTabsTitle', bodyKey: 'tourInstallerTabsBody' },
  { id: 'job', titleKey: 'tourInstallerJobTitle', bodyKey: 'tourInstallerJobBody' },
  { id: 'chat', titleKey: 'tourInstallerChatTitle', bodyKey: 'tourInstallerChatBody' },
  { id: 'photos', titleKey: 'tourInstallerPhotosTitle', bodyKey: 'tourInstallerPhotosBody' },
  completedTabStep,
  bellStep,
  ...outroSteps,
]
