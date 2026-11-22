import { useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AgendaList } from '#/components/AgendaList'
import { BudgetPanel } from '#/components/BudgetPanel'
import { EventDialog, ExportDialog } from '#/components/Dialogs'
import { LanguageSwitcher } from '#/components/LanguageSwitcher'
import { Runway } from '#/components/Runway'
import { Button, Dot, Segmented, calendarColor } from '#/components/ui'
import { WeekGrid } from '#/components/WeekGrid'
import { useHiddenCalendars, useNow } from '#/lib/client'
import { fmtDay, fmtShort } from '#/lib/format'
import { bundledPlan, isPlan } from '#/lib/plan/bundled'
import { DAY, mondayOf, nowMinsk, parseLocal, ymd } from '#/lib/plan/dates'
import { occurrences, planStart } from '#/lib/plan/occurrences'
import type { Plan, PlanEvent } from '#/lib/plan/types'
import { m } from '#/paraglide/messages.js'

type View = 'week' | 'list'
interface Search {
  /** Monday of the visible week, YYYY-MM-DD */
  week?: string
  view?: View
}

const WEEK_STEP = 'grid size-9 place-items-center rounded-[10px] border border-line bg-surface'

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
      const next: unknown = JSON.parse(await file.text())
      if (!isPlan(next)) throw new Error(m.file_missing_fields())
      setPlan(next)
      reset()
      setFileError('')
      void navigate({ search: (prev) => ({ ...prev, week: undefined }) })
    } catch (err) {
      setFileError(m.file_invalid({ reason: err instanceof Error ? err.message : String(err) }))
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] px-3 pt-3.5 pb-10 md:px-5 md:pt-5 md:pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px]/[1.2] font-semibold tracking-[-0.01em]">{plan.meta.title}</h1>
          <p className="mt-1 text-[14px] text-muted">
            {m.plan_summary({
              events: m.events_count({ count: plan.events.length }),
              calendars: m.in_calendars({ count: plan.calendars.length }),
              date: fmtDay(parseLocal(plan.meta.planEnd)),
            })}
            {plan !== bundledPlan && (
              <>
                {' '}
                ({m.file_opened()},{' '}
                <button type="button" className="text-focus underline" onClick={() => setPlan(bundledPlan)}>
                  {m.restore_plan()}
                </button>
                )
              </>
            )}
          </p>
          {fileError && (
            <p className="mt-1.5 text-[13px] text-today" role="alert">
              {fileError}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <LanguageSwitcher />
          <Button onClick={() => fileInput.current?.click()}>{m.open_plan_file()}</Button>
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
          <Button primary onClick={() => setExportOpen(true)}>
            {m.export_to_calendar()}
          </Button>
        </div>
      </header>

      <Runway plan={plan} now={now} onSelect={setSelected} />

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        {view === 'week' && (
          <div className="flex items-center gap-1.5">
            <button type="button" className={WEEK_STEP} aria-label={m.previous_week()} onClick={() => setWeek(weekStart - 7 * DAY)}>
              ‹
            </button>
            <h2 className="mx-1.5 text-[16px]/[1.2] font-semibold md:min-w-[170px]">
              {fmtShort(weekStart)} – {fmtShort(weekStart + 6 * DAY)} {new Date(weekStart + 6 * DAY).getUTCFullYear()}
            </h2>
            <button type="button" className={WEEK_STEP} aria-label={m.next_week()} onClick={() => setWeek(weekStart + 7 * DAY)}>
              ›
            </button>
            <Button onClick={() => navigate({ search: (prev) => ({ ...prev, week: undefined }) })}>{m.go_today()}</Button>
          </div>
        )}
        <Segmented
          label={m.view()}
          value={view}
          options={[
            { value: 'week', label: m.view_week() },
            { value: 'list', label: m.view_list() },
          ]}
          onChange={(v) => navigate({ search: (prev) => ({ ...prev, view: v }) })}
        />
        <div className="flex flex-wrap gap-1.5 md:ml-auto" aria-label={m.calendars()}>
          {plan.calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              className="group inline-flex items-center gap-[7px] rounded-full border border-line bg-surface py-[5px] pr-[11px] pl-[9px] text-[13px] aria-[pressed=false]:opacity-45"
              style={calendarColor(c.color)}
              aria-pressed={!hidden.has(c.id)}
              onClick={() => toggle(c.id)}
            >
              <Dot className="size-2.5 group-aria-[pressed=false]:bg-transparent group-aria-[pressed=false]:shadow-[inset_0_0_0_2px_var(--c)]" />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_260px]">
        <section className="rounded-2xl border border-line bg-surface">
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
