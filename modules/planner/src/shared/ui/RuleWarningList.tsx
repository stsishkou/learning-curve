import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { parseLocal, type RuleWarning } from '@lc/plan-domain'
import { TriangleAlert } from '@lc/ui'

const dayText = (start: string) => fmtDay(parseLocal(start))

/** A rule a change breaks, in the person's language. */
function warningLabel(warning: RuleWarning): string {
  const { title, start } = warning.event
  switch (warning.rule) {
    case 'holiday':
      return m.ai_warn_holiday({ title, day: dayText(start) })
    case 'weekend':
      return m.ai_warn_weekend({ title, day: dayText(start) })
    case 'overlap':
      return m.ai_warn_overlap({ title, other: warning.other.title })
    case 'deadline':
      return m.ai_warn_deadline({ title, day: dayText(warning.deadline.start) })
    case 'done':
      return warning.removed ? m.ai_warn_done_removed({ title }) : m.ai_warn_done({ title })
    default:
      return warning satisfies never
  }
}

const warningKey = (warning: RuleWarning) =>
  `${warning.rule} ${warning.event.uid} ${warning.rule === 'overlap' ? warning.other.uid : ''}`

/** The rules of the plan some changes break. They warn and stop nothing: the person decides. */
export function RuleWarningList({ warnings }: { warnings: RuleWarning[] }) {
  if (!warnings.length) return null
  return (
    <div className="text-[13px]/[1.45] text-today-ink" role="status">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert size={15} aria-hidden className="flex-none" />
        {m.ai_warnings()}
      </p>
      <ul className="mt-1 ml-[23px] list-disc space-y-0.5">
        {warnings.map((warning) => (
          <li key={warningKey(warning)}>{warningLabel(warning)}</li>
        ))}
      </ul>
    </div>
  )
}
