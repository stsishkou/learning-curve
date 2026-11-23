import { m } from '@lc/i18n/messages'
import {
  calendarLanes,
  compareLanes,
  laneMoveBounds,
  lanesRange,
  movedSessions,
  ymd,
  type HistoryView,
  type Plan,
  type PlanChange,
} from '@lc/plan-domain'
import { HelpToggle, Hint, PageHeader, useFullscreen } from '@lc/ui'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useShortcuts } from '../../../features/keyboard-shortcuts'
import { RescheduleDialog, type Rebalance } from '../../../features/reschedule'
import { useFillHeight, useNow } from '../../../shared/lib'
import { ScreenButtons } from '../../../shared/ui'
import { TimelineChart, type LaneEditing } from '../../../widgets/timeline-lanes'
import { useTimelineDraft, type CourseEdit } from '../model/use-timeline-draft'
import { CoursePanel } from './CoursePanel'
import { AppliedBar, DraftBar } from './DraftBar'
import { DraftReview } from './DraftReview'
import { LeaveDraftDialog } from './LeaveDraftDialog'
import { PageHint } from './PageHint'

/** The plan with what the page needs to know about it; the planner's state fits it as it is */
export interface TimelineState {
  plan: Plan
  /** false on a read-only host: courses can be picked and read, not changed */
  canEdit: boolean
  /** Where Undo goes back from */
  history: HistoryView
}

interface Props {
  state: TimelineState
  /** Stores the changes in order, each as its own step of the history. Resolves once `state` is fresh */
  onChangeAll: (changes: PlanChange[]) => Promise<void>
  /** Moves the plan to a point of its history. Resolves once `state` is fresh */
  onTravel: (cursor: number) => Promise<void>
  /** Present when the host can work out a re-balance: a course can then be given a new finish */
  rebalance?: Rebalance | undefined
  /** Shown next to the title: controls the host owns, such as the sections of the app */
  headerAside?: ReactNode
  /** Told whenever the page gets or loses a draft, so the host can hold its own navigation while there is one */
  onDraftChange?: ((dirty: boolean) => void) | undefined
  /** A navigation the host holds for the draft: the page asks whether to stay or drop the draft and go */
  leaving?: { onStay: () => void; onLeave: () => void } | undefined
  /** The timeline takes the whole window: no page header, and the course panel only while a course is picked */
  expanded?: boolean | undefined
  /** Present when the host keeps `expanded`: the page then offers Expand */
  onExpandedChange?: ((expanded: boolean) => void) | undefined
}

const NONE: ReadonlySet<string> = new Set()
const ask = (e: Event) => e.preventDefault()
const reasonOf = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * Every course on its lane, changed as a draft: a drag or the panel asks something of a course, the draft works out
 * the changes that would do it and draws them over the plan as it is, and only Apply stores them, in one go.
 */
export function TimelinePage(props: Props) {
  const { state, onChangeAll, onTravel, rebalance, headerAside, onDraftChange, leaving, expanded = false } = props
  const { onExpandedChange } = props
  const { plan, canEdit } = state
  const now = useNow()
  const today = now === null ? null : ymd(now)
  const draft = useTimelineDraft({ plan, today, rebalance })
  const [selected, setSelected] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [applied, setApplied] = useState<number | null>(null)
  const [more, setMore] = useState<string | null>(null)

  const { preview } = draft
  const before = useMemo(() => calendarLanes(plan, now, NONE), [plan, now])
  const after = useMemo(() => (preview ? calendarLanes(preview.after, now, NONE) : before), [preview, now, before])
  const moved = useMemo(() => (preview ? movedSessions(preview.diff) : NONE), [preview])
  const changes = useMemo(() => compareLanes(before, after, moved), [before, after, moved])
  const range = useMemo(() => lanesRange([...before, ...after], now), [before, after, now])
  const dirty = draft.courses.size > 0
  const fullscreen = useFullscreen()
  // The whole screen is for the timeline: it is laid out as Expand lays it out.
  const wide = expanded || fullscreen.on
  const toggleExpanded = onExpandedChange && (() => onExpandedChange(!expanded))
  const chartBox = useRef<HTMLDivElement>(null)
  // Clear of the bar that floats at the bottom while there is a draft or a word about the last Apply.
  const fill = useFillHeight(chartBox, wide, { minWidth: 701, bottomGap: dirty || applied !== null ? 88 : 16 })

  useShortcuts({
    ...(toggleExpanded && { e: toggleExpanded }),
    ...(fullscreen.supported && { 'shift+f': fullscreen.toggle }),
  })

  useEffect(() => {
    if (!dirty) return undefined
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [dirty])

  useEffect(() => onDraftChange?.(dirty), [dirty, onDraftChange])

  const editable = canEdit && today !== null
  const laneOf = (calendar: string | null) =>
    before.find((lane) => lane.calendar.id === calendar) ?? after.find((lane) => lane.calendar.id === calendar) ?? null
  const boundsOf = (calendar: string | null) => {
    const course = laneOf(calendar)
    return course && today !== null ? laneMoveBounds(course, today) : null
  }

  /** Adds to the course's move, kept within its bounds: drags add up, and no shift may pass them. */
  function moveBy(calendar: string, days: number) {
    const bounds = boundsOf(calendar)
    if (!bounds) return
    const move = (draft.courses.get(calendar)?.move ?? 0) + days
    change(calendar, { move: Math.min(bounds.max, Math.max(bounds.min, move)) })
  }

  function change(calendar: string, patch: CourseEdit | null) {
    draft.set(calendar, patch)
    setSelected(calendar)
    setApplied(null)
    setError(null)
  }

  const edit: LaneEditing = {
    onSelect: setSelected,
    ...(editable && {
      onMove: moveBy,
      onDeadline: (calendar: string, day: string) =>
        change(calendar, { deadline: day === laneOf(calendar)?.deadline ? undefined : day }),
      ...(rebalance && { onFinish: (calendar: string, day: string) => change(calendar, { finishBy: day }) }),
    }),
  }

  async function apply() {
    if (!draft.ready) return
    const count = draft.changes.length
    setSaving(true)
    setError(null)
    try {
      await onChangeAll(draft.changes)
      draft.discard()
      setReviewing(false)
      setApplied(count)
    } catch (err) {
      setError(m.save_failed({ reason: reasonOf(err) }))
    } finally {
      setSaving(false)
    }
  }

  async function undo(count: number) {
    setApplied(null)
    try {
      await onTravel(state.history.cursor - count)
    } catch (err) {
      setError(m.save_failed({ reason: reasonOf(err) }))
    }
  }

  const lane = laneOf(selected)
  const course = selected === null ? undefined : draft.courses.get(selected)

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)] gap-4 px-3 md:px-5 ${wide ? 'pt-3 pb-4' : 'mx-auto max-w-[1400px] pt-3.5 pb-32 md:pt-5'}`}
    >
      {!wide && (
        <PageHeader aside={headerAside} actions={<HelpToggle label={m.help_toggle()} className="max-md:flex-none!" />}>
          <h1 className="flex items-center gap-2 text-[22px]/[1.2] font-semibold tracking-[-0.01em]">
            {m.timeline()}
            <Hint title={m.help_timeline_title()} text={m.help_timeline()} />
          </h1>
          <PageHint text={m.timeline_page_hint()} />
        </PageHeader>
      )}

      {error !== null && !dirty && (
        <p className="text-[13.5px] text-today-ink" role="alert">
          {error}
        </p>
      )}

      {range ? (
        <div
          className={`grid grid-cols-1 items-start gap-4 ${!wide || lane ? 'lg:grid-cols-[minmax(0,1fr)_340px]' : ''}`}
        >
          <div ref={chartBox} className="min-w-0">
            <TimelineChart
              height={fill}
              tools={
                toggleExpanded && (
                  <ScreenButtons
                    expanded={expanded}
                    expandHint={m.timeline_expand_hint()}
                    onToggleExpanded={toggleExpanded}
                    fullscreen={fullscreen.supported ? fullscreen : undefined}
                    className="py-1! text-[13px]"
                  />
                )
              }
              lanes={after}
              changes={changes}
              moved={moved}
              range={range}
              now={now}
              selected={selected}
              working={draft.working}
              edit={edit}
            />
          </div>
          {(!wide || lane) && (
            <div className="min-w-0 overflow-y-auto" style={fill === undefined ? undefined : { maxHeight: fill }}>
              <CoursePanel
                lane={lane}
                change={selected === null ? undefined : changes.get(selected)}
                edit={course}
                warnings={preview?.warnings.filter((w) => w.event.calendar === selected) ?? []}
                working={selected !== null && draft.working.has(selected)}
                failed={selected === null ? undefined : draft.failed.get(selected)}
                today={today}
                bounds={boundsOf(selected)}
                onEdit={editable && selected !== null ? (patch) => change(selected, patch) : undefined}
                canRebalance={rebalance !== undefined}
                onMore={editable && selected !== null ? () => setMore(selected) : undefined}
                onClose={wide ? () => setSelected(null) : undefined}
              />
            </div>
          )}
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-surface px-5 py-10 text-center text-[14px] text-muted">
          {m.timeline_empty()}
        </p>
      )}

      {dirty ? (
        <DraftBar
          courses={draft.courses.size}
          sessions={moved.size}
          warnings={preview?.warnings.length ?? 0}
          problem={error ?? (preview?.problem ? m.timeline_problem({ reason: preview.problem.message }) : null)}
          working={draft.working.size > 0}
          ready={draft.ready}
          saving={saving}
          onReview={() => setReviewing(true)}
          onDiscard={() => {
            draft.discard()
            setError(null)
          }}
          onApply={() => void apply()}
        />
      ) : (
        applied !== null && (
          <AppliedBar count={applied} onUndo={() => void undo(applied)} onDismiss={() => setApplied(null)} />
        )
      )}

      <DraftReview
        open={reviewing && dirty}
        plan={plan}
        preview={preview}
        ready={draft.ready}
        saving={saving}
        onApply={() => void apply()}
        onClose={() => setReviewing(false)}
      />

      <LeaveDraftDialog
        open={leaving !== undefined}
        onStay={() => leaving?.onStay()}
        onLeave={() => leaving?.onLeave()}
      />

      {today !== null && (
        <RescheduleDialog
          plan={plan}
          from={more === null ? null : today}
          preset={more === null ? undefined : { calendar: more, mode: 'move' }}
          rebalance={rebalance}
          onApply={async (stored) => {
            await onChangeAll(stored)
            if (more !== null) draft.set(more, null)
            setApplied(stored.length)
          }}
          onClose={() => setMore(null)}
        />
      )}
    </div>
  )
}
