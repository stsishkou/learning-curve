import { fmtDay, fmtHours, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, countdown, courseProgress, paceForecast, parseLocal, type Plan } from '@lc/plan-domain'
import { calendarColor, Dot, Hint } from '@lc/ui'

import { Card } from '../../../shared/ui'

interface Props {
  plan: Plan
  /** Wall-clock ms; null before the clock is known */
  now: number | null
}

const fmtPace = (pace: number) => `×${pace.toFixed(2).replace(/0$/, '')}`
const days = (ms: number) => Math.round(ms / DAY)

/** A slip of a day or more against the plan, in words. */
function Slip({ planned, finish }: { planned: number; finish: number }) {
  const late = days(finish - planned)
  if (late > 0) return <span className="text-today-ink">▼ {m.forecast_late({ count: late })}</span>
  if (late < 0) return <span className="text-done-ink">▲ {m.forecast_early({ count: -late })}</span>
  return <span className="text-muted">✓ {m.forecast_on_time()}</span>
}

/**
 * The plan corrected by reality: how long a planned hour takes in each course, judged by the time logged on done
 * sessions, and the day the rest will be finished at that pace.
 */
export function PaceForecast({ plan, now }: Props) {
  if (now === null) return null
  const courses = courseProgress(plan)
  const rows = courses.map((course) => ({ course, forecast: paceForecast(plan, now, course.calendar.id) }))
  const logged = rows.reduce((sum, row) => sum + row.forecast.logged, 0)
  const target = countdown(plan, now)
  const next = target?.day ? { calendar: target.calendar, day: target.day } : null
  const towards = next && rows.find((row) => row.course.calendar.id === next.calendar)
  const deadline = next && parseLocal(`${next.day}T00:00`)
  const finish = towards ? towards.forecast.finish : null
  const margin = deadline === null || finish === null ? null : days(deadline - finish)
  const name = towards ? towards.course.calendar.name : ''

  return (
    <Card
      title={m.dash_forecast_title()}
      hint={m.dash_forecast_hint()}
      help={<Hint title={m.help_forecast_title()} text={m.help_forecast()} />}
    >
      {!logged && <p className="mb-3 text-[13px] text-muted">{m.dash_forecast_none()}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px] tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              {[
                m.dash_forecast_course(),
                m.dash_forecast_pace(),
                m.dash_forecast_left(),
                m.dash_forecast_plan(),
                m.dash_forecast_real(),
              ].map((label, i) => (
                <th key={label} scope="col" className={`py-1.5 font-medium ${i ? 'pl-3' : 'pr-3'}`}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ course, forecast }) => (
              <tr key={course.calendar.id} className="border-b border-line-soft align-top last:border-b-0">
                <th
                  scope="row"
                  className="py-2 pr-3 text-left font-medium"
                  style={calendarColor(course.calendar.color)}
                >
                  <span className="flex items-baseline gap-2">
                    <Dot className="size-2.5 -translate-y-px" />
                    {course.calendar.name}
                  </span>
                </th>
                <td className="py-2 pl-3">
                  {course.doneSessions ? fmtPace(forecast.pace) : '—'}
                  {course.doneSessions > 0 && (
                    <span className="block text-[12px] text-muted">
                      {m.dash_spent({ hours: fmtHours(course.spentHours) })}
                    </span>
                  )}
                </td>
                <td className="py-2 pl-3">
                  {forecast.finish === null
                    ? m.dash_forecast_done()
                    : Math.abs(forecast.needed - forecast.remaining) < 0.05
                      ? fmtHours(forecast.remaining)
                      : m.dash_forecast_left_value({
                          planned: fmtHours(forecast.remaining),
                          needed: fmtHours(forecast.needed),
                        })}
                </td>
                <td className="py-2 pl-3">{forecast.planned === null ? '—' : fmtShort(forecast.planned)}</td>
                <td className="py-2 pl-3">
                  {forecast.finish === null || forecast.planned === null ? (
                    '—'
                  ) : (
                    <>
                      {fmtShort(forecast.finish)}
                      <span className="block text-[12px]">
                        <Slip planned={forecast.planned} finish={forecast.finish} />
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {margin !== null && deadline !== null && (
        <p className={`mt-3 text-[13px] ${margin < 0 ? 'text-today-ink' : 'text-muted'}`}>
          {m.dash_forecast_deadline({
            name,
            date: fmtDay(deadline),
            verdict: margin < 0 ? m.dash_forecast_miss({ count: -margin }) : m.dash_forecast_ok({ count: margin }),
          })}
        </p>
      )}
    </Card>
  )
}
