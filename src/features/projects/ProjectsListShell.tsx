import Link from 'next/link'
import { CompanyBar } from '@/components/CompanyBar'
import { t } from '@/lib/i18n'
import { mergeDateRanges, formatRanges } from '@/lib/utils/date-ranges'
import type { ProjectListItem } from '@/lib/supabase/queries/projects'
import type { LangCode } from '@/lib/i18n'

interface Props {
  lang:     LangCode
  projects: ProjectListItem[]
}

// Plain listing page — no interactivity of its own (each card is a Link),
// so this stays a server-renderable component. CompanyBar mirrors
// ProjectFormShell's usage (lang only, no role) — this feature has no nav
// drawer of its own, same as the edit page it links to.
export function ProjectsListShell({ lang, projects }: Props) {
  return (
    <div className="min-h-screen bg-bg pb-10">
      <CompanyBar lang={lang} />

      <div className="max-w-2xl lg:max-w-6xl mx-auto px-4 pt-5 pb-6">
        <h1 className="font-display text-xl font-semibold text-ink mb-4">
          {t(lang, 'jpProjectsTitle')}
        </h1>

        {projects.length === 0 ? (
          <p className="text-sm text-muted text-center py-10">{t(lang, 'jpNoProjects')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map(p => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block border-[1.5px] border-terracotta rounded-card bg-paper p-4 hover:brightness-95 transition-[filter]"
              >
                <p className="font-display text-base font-medium text-ink truncate">{p.name}</p>
                <p className="text-sm text-ink2 truncate">{p.client}</p>
                <p className="text-xs text-muted mt-1">{formatRanges(mergeDateRanges(p.spans))}</p>
                <span className="inline-flex items-center mt-2 rounded-full border border-line bg-bg px-2.5 py-1 text-[11px] font-medium text-ink2">
                  {p.doneCount} / {p.jobCount} {t(lang, 'jpJobsDone')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
