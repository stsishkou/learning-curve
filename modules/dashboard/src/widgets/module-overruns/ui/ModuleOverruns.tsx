import { fmtDuration, fmtRatio } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { HOUR, moduleOverruns, type ModuleOverrun, type Plan } from '@lc/plan-domain'
import { calendarColor, Dot } from '@lc/ui'

const CELL = 'py-1.5 pl-3 text-right whitespace-nowrap'

/** Why a module has no ratio yet, the first reason that holds. */
function waitingFor(row: ModuleOverrun): string {
  if (row.done < row.sessions) return m.dash_modules_open()
  if (row.logged < row.done) return m.dash_modules_unlogged({ count: row.done - row.logged })
  return m.dash_modules_rest()
}

function Row({ row, plan }: { row: ModuleOverrun; plan: Plan }) {
  const calendar = plan.calendars.find((c) => c.id === row.calendar)
  return (
    <tr className="border-b border-line-soft last:border-b-0">
      <th scope="row" className="py-1.5 pr-3 text-left font-normal" style={calendarColor(calendar?.color)}>
        <span className="flex items-baseline gap-2">
          <Dot className="size-2 flex-none -translate-y-px" />
          <span>
            {row.title}
            <span className="block text-[12px] text-muted">{calendar?.name ?? row.calendar}</span>
          </span>
        </span>
      </th>
      <td className={CELL}>{m.dash_modules_of({ done: row.done, sessions: row.sessions })}</td>
      <td className={CELL}>{fmtDuration(row.planned * HOUR)}</td>
      <td className={CELL}>{fmtDuration(row.spent * HOUR)}</td>
      <td className={`${CELL} ${row.ratio === null ? 'text-muted' : ''}`}>
        {row.ratio === null ? waitingFor(row) : fmtRatio(row.ratio)}
      </td>
      <td className={CELL}>{row.added ? `+${row.added}` : '—'}</td>
      <td className={CELL}>{row.unfinished || '—'}</td>
    </tr>
  )
}

/**
 * Modules from the longest overrun down: the hours each was first planned with against the hours logged on all its
 * sessions, with the sessions added to it and those that ran out of time. Collapsed, like the table of weeks.
 */
export function ModuleOverruns({ plan }: { plan: Plan }) {
  const rows = moduleOverruns(plan)
  const ranked = rows.filter((row) => row.ratio !== null)
  const waiting = rows.filter((row) => row.ratio === null)
  const columns = [
    m.dash_modules_sessions(),
    m.dash_planned(),
    m.dash_strip_logged(),
    m.dash_strip_ratio(),
    m.dash_modules_added(),
    m.dash_modules_unfinished(),
  ]

  return (
    <details className="rounded-2xl border border-line bg-surface px-4 py-3 md:px-5">
      <summary className="cursor-pointer text-[14px] font-semibold">
        {m.dash_modules_title()}{' '}
        <span className="font-normal text-muted">· {m.dash_modules_count({ count: ranked.length })}</span>
      </summary>
      <p className="mt-2 max-w-[760px] text-[13px] text-muted">{m.dash_modules_hint()}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">{m.dash_modules_none()}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  {m.dash_modules_module()}
                </th>
                {columns.map((label) => (
                  <th key={label} scope="col" className="py-1.5 pl-3 text-right font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            {ranked.length > 0 && (
              <tbody>
                {ranked.map((row) => (
                  <Row key={`${row.calendar}\n${row.title}`} row={row} plan={plan} />
                ))}
              </tbody>
            )}
            {waiting.length > 0 && (
              <tbody>
                <tr className="border-b border-line-soft">
                  <th scope="rowgroup" colSpan={7} className="pt-3 pb-1 text-left font-semibold">
                    {m.dash_modules_waiting()}
                  </th>
                </tr>
                {waiting.map((row) => (
                  <Row key={`${row.calendar}\n${row.title}`} row={row} plan={plan} />
                ))}
              </tbody>
            )}
          </table>
        </div>
      )}
    </details>
  )
}
