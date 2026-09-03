import type { TourStep } from '../engine'
import { bellStep, outroSteps } from './common'

// Designer: Design Load is the centrepiece; job-form specifics are centred
// cards (no job to open on a fresh account). 10 steps.
export const designerSteps: TourStep[] = [
  { id: 'intro', route: '/schedule', titleKey: 'tourDesignerIntroTitle', bodyKey: 'tourDesignerIntroBody' },
  { id: 'board', route: '/design-load', targets: ['design-board'], titleKey: 'tourDesignBoardTitle', bodyKey: 'tourDesignBoardBody' },
  { id: 'toggle', targets: ['design-toggle'], titleKey: 'tourDesignToggleTitle', bodyKey: 'tourDesignToggleBody' },
  { id: 'brief', titleKey: 'tourDesignBriefTitle', bodyKey: 'tourDesignBriefBody' },
  { id: 'complete', titleKey: 'tourDesignCompleteTitle', bodyKey: 'tourDesignCompleteBody' },
  { id: 'due', titleKey: 'tourDesignDueTitle', bodyKey: 'tourDesignDueBody' },
  bellStep,
  ...outroSteps,
]
