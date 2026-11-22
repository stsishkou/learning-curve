import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import planData from '#/data/plan.json'
import { AgendaList } from '#/components/AgendaList'
import { BudgetPanel } from '#/components/BudgetPanel'
import { EventDialog, ExportDialog } from '#/components/Dialogs'
import { Runway } from '#/components/Runway'
import { WeekGrid } from '#/components/WeekGrid'
import { useHiddenCalendars, useNow } from '#/lib/client'
import { DAY, fmtDay, fmtShort, mondayOf, nowMinsk, parseLocal, plural, ymd } from '#/lib/plan/dates'
import { occurrences, planStart } from '#/lib/plan/occurrences'
import type { Plan, PlanEvent } from '#/lib/plan/types'

type View = 'week' | 'list'
interface Search {
  /** Monday of the visible week, YYYY-MM-DD */
  week?: string
  view?: View
}

const bundledPlan = planData as Plan

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    week: typeof search.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(search.week) ? search.week : undefined,
    view: search.view === 'list' || search.view === 'week' ? search.view : undefined,
  }),
  component: PlanPage,
})

function defaultWeek(plan: Plan) {
  const now = nowMinsk()
  const first = planStart(plan)
  return mondayOf(now < first ? first : now)
}

function PlanPage() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const now = useNow()
  const { hidden, toggle, reset } = useHiddenCalendars()
  const [plan, setPlan] = useState<Plan>(bundledPlan)
  const [selected, setSelected] = useState<PlanEvent | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [fileError, setFileError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const view: View = search.view ?? 'week'
  const weekStart = search.week ? mondayOf(parseLocal(search.week)) : defaultWeek(plan)
  const setWeek = (t: number) => navigate({ search: (prev) => ({ ...prev, week: ymd(t) }) })

  const weekItems = useMemo(() => occurrences(plan, weekStart, weekStart + 7 * DAY, hidden), [plan, weekStart, hidden])
  const allItems = useMemo(
    () => (view === 'list' ? occurrences(plan, planStart(plan), parseLocal(plan.meta.planEnd) + 8 * DAY, hidden) : []),
    [plan, hidden, view],
  )

  async function openFile(file: File) {
    try {
      const next = JSON.parse(await file.text()) as Plan
      if (!next?.meta || !Array.isArray(next.calendars) || !Array.isArray(next.events)) throw new Error('нет полей meta, calendars или events')
      setPlan(next)
      reset()
      setFileError('')
      navigate({ search: (prev) => ({ ...prev, week: undefined }) })
    } catch (err) {
      setFileError(`Файл не похож на план: ${(err as Error).message}`)
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>{plan.meta.title}</h1>
          <p>
            {plan.events.length} {plural(plan.events.length, 'событие', 'события', 'событий')} в {plan.calendars.length} календарях, до{' '}
            {fmtDay(parseLocal(plan.meta.planEnd))}
            {plan !== bundledPlan && (
              <>
                {' '}
                (открыт файл,{' '}
                <button type="button" className="linkish" onClick={() => setPlan(bundledPlan)}>
                  вернуть план проекта
                </button>
                )
              </>
            )}
          </p>
          {fileError && <p className="error" role="alert">{fileError}</p>}
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={() => fileInput.current?.click()}>
            Открыть файл плана
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void openFile(f)
              e.target.value = ''
            }}
          />
          <button className="btn primary" type="button" onClick={() => setExportOpen(true)}>
            Экспорт в календарь
          </button>
        </div>
      </header>

      <Runway plan={plan} now={now} onSelect={setSelected} />

      <div className="bar">
        {view === 'week' && (
          <div className="weeknav">
            <button className="icon" type="button" aria-label="Предыдущая неделя" onClick={() => setWeek(weekStart - 7 * DAY)}>
              ‹
            </button>
            <h2>
              {fmtShort(weekStart)} – {fmtShort(weekStart + 6 * DAY)} {new Date(weekStart + 6 * DAY).getUTCFullYear()}
            </h2>
            <button className="icon" type="button" aria-label="Следующая неделя" onClick={() => setWeek(weekStart + 7 * DAY)}>
              ›
            </button>
            <button className="btn" type="button" onClick={() => navigate({ search: (prev) => ({ ...prev, week: undefined }) })}>
              Сегодня
            </button>
          </div>
        )}
        <div className="seg-ctl" role="group" aria-label="Вид">
          {(['week', 'list'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => navigate({ search: (prev) => ({ ...prev, view: v }) })}>
              {v === 'week' ? 'Неделя' : 'Список'}
            </button>
          ))}
        </div>
        <div className="chips" aria-label="Календари">
          {plan.calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              className="chip"
              style={{ '--c': c.color } as React.CSSProperties}
              aria-pressed={!hidden.has(c.id)}
              onClick={() => toggle(c.id)}
            >
              <i />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="main">
        <section className="panel">
          {view === 'week' ? (
            <WeekGrid plan={plan} weekStart={weekStart} items={weekItems} now={now} onSelect={setSelected} />
          ) : (
            <AgendaList plan={plan} items={allItems} now={now} onSelect={setSelected} />
          )}
        </section>
        <BudgetPanel plan={plan} weekItems={weekItems} />
      </div>

      <EventDialog plan={plan} event={selected} onClose={() => setSelected(null)} />
      <ExportDialog plan={plan} hidden={hidden} open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  )
}
