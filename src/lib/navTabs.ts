import { Calendar, Bot, HardHat, CheckCircle2, Clock, LayoutGrid, PenTool } from 'lucide-react'
import type { Role } from '@/lib/supabase/types'

export type NavTab = { href: string; label: string; Icon: typeof Calendar }

// Single source for role → tabs, shared by BottomNav (desktop, ≥lg) and
// NavDrawer (mobile, <lg — R2-T5 / F1). Keep both in sync by editing here
// only; neither component should ever define its own copy.
export const NAV_TABS: Record<Role, NavTab[]> = {
  scheduler: [
    { href: '/schedule',    label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',        label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/design-load', label: 'Design',    Icon: PenTool       },
    { href: '/completed',   label: 'Completed', Icon: CheckCircle2  },
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
  admin: [
    { href: '/schedule',    label: 'Schedule',  Icon: Calendar      },
    { href: '/fcfs',        label: 'FCFS',      Icon: LayoutGrid    },
    { href: '/design-load', label: 'Design',    Icon: PenTool       },
    { href: '/completed',   label: 'Completed', Icon: CheckCircle2  },
    { href: '/assistant',   label: 'Assistant', Icon: Bot           },
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
