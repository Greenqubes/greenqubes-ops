import { Calendar, Bot, HardHat, CheckCircle2, Clock, LayoutGrid, PenTool, CalendarOff } from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

export type NavTab = { href: string; label: string; Icon: typeof Calendar }

// Single source for role → tabs, shared by BottomNav (desktop, ≥lg) and
// NavDrawer (mobile, <lg — R2-T5 / F1). Keep both in sync by editing here
// only; neither component should ever define its own copy.
export const NAV_TABS: Record<Role, NavTab[]> = {
  // Pending added 2026-09-15 (Nic): a scheduler can create jobs — the INSERT
  // policy allows it and the New Job form offers "Save as pending" to every
  // role that can reach it — so without this tab a scheduler saved a draft
  // and had no way back to it. The job was never lost, just unreachable.
  scheduler: [
    { href: '/schedule',    label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',        label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/design-load', label: 'Design',    Icon: PenTool       },
    { href: '/completed',   label: 'Completed', Icon: CheckCircle2  },
    { href: '/pending',     label: 'Pending',   Icon: Clock         },
    { href: '/assistant',   label: 'Assistant', Icon: Bot           },
  ],
  sales: [
    { href: '/schedule',    label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',        label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/design-load', label: 'Design',    Icon: PenTool       },
    { href: '/completed',   label: 'Completed', Icon: CheckCircle2  },
    { href: '/pending',     label: 'Pending',   Icon: Clock         },
    { href: '/assistant',   label: 'Assistant', Icon: Bot           },
  ],
  // No FCFS for installers — the board is a scheduler/coordinator planning tool.
  // Installers only need to know the jobs they're on. (Nic's call, 2026-07-22.)
  installer: [
    { href: '/installer', label: 'My Jobs',   Icon: HardHat       },
    { href: '/completed', label: 'Completed', Icon: CheckCircle2  },
    { href: '/assistant', label: 'Assistant', Icon: Bot           },
  ],
  // Reached via getNavRole, NOT getEffectiveRole — that returns 'scheduler'
  // for a plain admin, so this list was dead configuration until 2026-09-15
  // and every admin navigated with the scheduler's tabs. The Admin screens
  // stay in the profile menu on purpose (Nic's call): a tab for them would be
  // clutter for the one person who knows where they are.
  admin: [
    { href: '/schedule',    label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',        label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/design-load', label: 'Design',    Icon: PenTool       },
    { href: '/completed',   label: 'Completed', Icon: CheckCircle2  },
    { href: '/pending',     label: 'Pending',   Icon: Clock         },
    { href: '/leave',       label: 'Leave',     Icon: CalendarOff   },
    { href: '/assistant',   label: 'Assistant', Icon: Bot           },
  ],
  // HR / Finance: schedule view-only, the Leave tab she owns, and the
  // assistant. No FCFS, no Pending, no Completed edits, no Admin — see
  // src/lib/auth/capabilities.ts for the gates behind those.
  hr: [
    { href: '/schedule',  label: 'Schedule',  Icon: Calendar     },
    { href: '/leave',     label: 'Leave',     Icon: CalendarOff  },
    { href: '/assistant', label: 'Assistant', Icon: Bot          },
  ],
  coordinator: [
    { href: '/schedule',    label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',        label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/design-load', label: 'Design',    Icon: PenTool       },
    { href: '/completed',   label: 'Completed', Icon: CheckCircle2  },
    { href: '/pending',     label: 'Pending',   Icon: Clock         },
    { href: '/assistant',   label: 'Assistant', Icon: Bot           },
  ],
  designer: [
    { href: '/schedule',    label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',        label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/design-load', label: 'Design',    Icon: PenTool       },
    { href: '/completed',   label: 'Completed', Icon: CheckCircle2  },
    { href: '/assistant',   label: 'Assistant', Icon: Bot           },
  ],
  production: [
    { href: '/schedule',  label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',      label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/completed', label: 'Completed', Icon: CheckCircle2  },
    { href: '/assistant', label: 'Assistant', Icon: Bot           },
  ],
}
