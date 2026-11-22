import { fmtDay, fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  DAY,
  applyEdits,
  mondayOf,
  nowMinsk,
  occurrences,
  parseLocal,
  planStart,
  ymd,
  type EventPatch,
  type Plan,
  type PlanEvent,
} from '@lc/plan-domain'
import { Button, Segmented } from '@lc/ui'
import { useMemo, useState, type ReactNode } from 'react'

import { EventDialog } from '../../../features/edit-event'
import { CalendarFilter, useHiddenCalendars } from '../../../features/filter-calendars'
import { OpenPlanFile } from '../../../features/open-plan-file'
import { useNow } from '../../../shared/lib'
import { AgendaList } from '../../../widgets/agenda-list'
import { BudgetPanel } from '../../../widgets/budget-panel'
import { Runway } from '../../../widgets/runway'
import { WeekGrid } from '../../../widgets/week-grid'
import type { PlannerSearch, PlannerView } from '../model/search'

export interface PlannerState {
  plan: Plan
  /** false on a read-only host: the planner then hides its editing controls */
  canEdit: boolean
  /** uids of events that differ from the generated schedule */
  edited: string[]
}

interface Props {
  state: PlannerState
  search: PlannerSearch
  /** Merges the given keys into the URL; `undefined` removes a key. */
  onSearchChange: (patch: PlannerSearch) => void
  /** Stores one event's change, `null` drops it. Resolves once `state` is fresh; rejects with the reason. */
  onSaveEdit: (uid: string, patch: EventPatch | null) => Promise<void>
  /** Shown next to the title: controls the host owns, such as the language switcher */
  headerAside?: ReactNode
  /** More header actions that work on the plan as it is shown now, such as export */
  renderActions?: (shown: { plan: Plan; hidden: ReadonlySet<string> }) => ReactNode
}

const WEEK_STEP = 'grid size-9 place-items-center rounded-[10px] border border-line bg-surface'

function defaultWeek(plan: Plan) {
  const now = nowMinsk()
  const first = planStart(plan)
  return mondayOf(now < first ? first : now)
}

export function PlannerPage({ state, search, onSearchChange, onSaveEdit, headerAside, renderActions }: Props) {
  const now = useNow()
  const { hidden, toggle, reset } = useHiddenCalendars()
  // A plan file opened from disk replaces the project plan until it is dismissed.
  const [opened, setOpened] = useState<Plan | null>(null)
  // Changes on their way to the server, shown at once so a dragged event does not jump back while saving.
  const [pending, setPending] = useState<Record<string, EventPatch>>({})
  const plan = useMemo(() => {
    const base = opened ?? state.plan
    return Object.keys(pending).length ? applyEdits(base, { version: 1, events: pending }).plan : base
  }, [opened, state.plan, pending])
  const canEdit = state.canEdit && !opened
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const selected = plan.events.find((e) => e.uid === selectedUid) ?? null
  const select = (e: PlanEvent) => setSelectedUid(e.uid)
  const [fileError, setFileError] = useState('')
  const [saveError, setSaveError] = useState('')

  const view: PlannerView = search.view ?? 'week'
  const weekStart = search.week ? mondayOf(parseLocal(search.week)) : defaultWeek(plan)
  const setWeek = (t: number) => onSearchChange({ week: ymd(t) })

  const weekItems = useMemo(() => occurrences(plan, weekStart, weekStart + 7 * DAY, hidden), [plan, weekStart, hidden])
  const allItems = useMemo(
    () => (view === 'list' ? occurrences(plan, planStart(plan), parseLocal(plan.meta.planEnd) + 8 * DAY, hidden) : []),
    [plan, hidden, view],
  )

  async function saveEdit(uid: string, patch: EventPatch | null) {
    if (patch) setPending((prev) => ({ ...prev, [uid]: patch }))
    try {
      await onSaveEdit(uid, patch)
    } finally {
      setPending((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== uid)))
    }
  }

  async function moveEvent(uid: string, slot: EventPatch) {
    try {
      await saveEdit(uid, slot)
      setSaveError('')
    } catch (err) {
      setSaveError(m.save_failed({ reason: err instanceof Error ? err.message : String(err) }))
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] px-3 pt-3.5 pb-10 md:px-5 md:pt-5 md:pb-12">
      <header className="grid grid-cols-[1fr_auto] items-start gap-x-2 gap-y-3 md:flex md:items-end">
        <div className="min-w-0 md:mr-auto">
          <h1 className="text-[22px]/[1.2] font-semibold tracking-[-0.01em]">{plan.meta.title}</h1>
          <p className="mt-1 text-[14px] text-muted">
            {m.plan_summary({
              events: m.events_count({ count: plan.events.length }),
              calendars: m.in_calendars({ count: plan.calendars.length }),
              date: fmtDay(parseLocal(plan.meta.planEnd)),
            })}
            {opened && (
              <>
                {' '}
                ({m.file_opened()},{' '}
                <button type="button" className="text-focus underline" onClick={() => setOpened(null)}>
                  {m.restore_plan()}
                </button>
                )
              </>
            )}
          </p>
          {saveError && (
            <p className="mt-1.5 text-[13px] text-today" role="alert">
              {saveError}
            </p>
          )}
          {fileError && (
            <p className="mt-1.5 text-[13px] text-today" role="alert">
              {fileError}
            </p>
          )}
        </div>
        {headerAside}
        <div className="col-span-2 flex gap-2 *:flex-1 md:*:flex-none">
          <OpenPlanFile
            onOpen={(next) => {
              setOpened(next)
              reset()
              setFileError('')
              onSearchChange({ week: undefined })
            }}
            onError={setFileError}
          />
          {renderActions?.({ plan, hidden })}
        </div>
      </header>

      <Runway plan={plan} now={now} onSelect={select} />

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <Segmented
          label={m.view()}
          value={view}
          options={[
            { value: 'week', label: m.view_week() },
            { value: 'list', label: m.view_list() },
          ]}
          onChange={(next) => onSearchChange({ view: next })}
        />
        {view === 'week' && (
          <div className="order-last flex w-full items-center gap-1.5 md:order-none md:w-auto">
            <button
              type="button"
              className={WEEK_STEP}
              aria-label={m.previous_week()}
              onClick={() => setWeek(weekStart - 7 * DAY)}
            >
              ‹
            </button>
            <h2 className="mx-1.5 flex-1 text-center text-[14px]/[1.2] font-semibold whitespace-nowrap md:min-w-[170px] md:flex-none md:text-left md:text-[16px]/[1.2]">
              {fmtShort(weekStart)} – {fmtShort(weekStart + 6 * DAY)} {new Date(weekStart + 6 * DAY).getUTCFullYear()}
            </h2>
            <button
              type="button"
              className={WEEK_STEP}
              aria-label={m.next_week()}
              onClick={() => setWeek(weekStart + 7 * DAY)}
            >
              ›
            </button>
            <Button onClick={() => onSearchChange({ week: undefined })}>{m.go_today()}</Button>
            <Button
              className="aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-bg"
              aria-pressed={search.fullDay === true}
              title={m.full_day_hint()}
              onClick={() => onSearchChange({ fullDay: search.fullDay ? undefined : true })}
            >
              {m.full_day()}
            </Button>
          </div>
        )}
        <CalendarFilter calendars={plan.calendars} hidden={hidden} onToggle={toggle} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_260px]">
        <section className="rounded-2xl border border-line bg-surface">
          {view === 'week' ? (
            <WeekGrid
              plan={plan}
              weekStart={weekStart}
              fullDay={search.fullDay === true}
              items={weekItems}
              now={now}
              onSelect={select}
              onMove={canEdit ? (e, slot) => void moveEvent(e.uid, slot) : undefined}
            />
          ) : (
            <AgendaList plan={plan} items={allItems} now={now} onSelect={select} />
          )}
        </section>
        {/* The list is long: on one column the week's budget goes above it instead of far below. */}
        <BudgetPanel className={view === 'list' ? 'order-first lg:order-none' : ''} plan={plan} weekItems={weekItems} />
      </div>

      <EventDialog
        plan={plan}
        event={selected}
        edited={selected !== null && state.edited.includes(selected.uid)}
        canEdit={canEdit}
        onSave={saveEdit}
        onClose={() => setSelectedUid(null)}
      />
    </div>
  )
}
