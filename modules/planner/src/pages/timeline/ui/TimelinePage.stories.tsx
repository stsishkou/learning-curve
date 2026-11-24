import { m } from '@lc/i18n/messages'
import {
  addDays,
  applyChange,
  applyEdits,
  calendarLanes,
  DAY,
  deadlineChange,
  deadlineOf,
  emptyHistory,
  historyEdits,
  historyView,
  isSession,
  lanesRange,
  mondayOf,
  nowMinsk,
  parseLocal,
  previewUpdate,
  rebalanceChange,
  recordChange,
  toLocalString,
  travel,
  ymd,
  type Plan,
  type PlanChange,
  type RebalanceRequest,
  type RebalanceResult,
} from '@lc/plan-domain'
import { fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import { clearIconsOnly, fakeFullscreen } from '@lc/ui/testing'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useMemo, useState, type ComponentProps } from 'react'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'

import { TimelinePage } from './TimelinePage'

// The page follows the real clock: the fixture is moved by whole weeks to the week the stand is opened in.
const now = nowMinsk()
const today = ymd(now)
const weeks = Math.round((mondayOf(now) - fixtureWeek) / (7 * DAY))
const later = (local: string) => toLocalString(parseLocal(local) + weeks * 7 * DAY)
const plan: Plan = {
  ...fixturePlan,
  meta: { ...fixturePlan.meta, planEnd: addDays(fixturePlan.meta.planEnd, weeks * 7) },
  events: fixturePlan.events.map((e) => ({
    ...e,
    start: later(e.start),
    end: later(e.end),
    ...(e.skip ? { skip: e.skip.map((day) => addDays(day, weeks * 7)) } : {}),
  })),
}

const NONE: ReadonlySet<string> = new Set()
const LLM = /Hugging Face: LLM Course/
const CERTS = /Gemini Certs/
const MOUSE = { pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true }
const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Sessions of a course a move or a re-balance from today takes along. */
const ahead = (calendar: string) =>
  plan.events.filter((e) => e.calendar === calendar && isSession(e) && !e.done && e.start.slice(0, 10) >= today)

/** What the solver might answer: the last session ahead a few days earlier. */
function resultFor(calendar: string, days: number): RebalanceResult {
  const moves = ahead(calendar)
    .slice(-1)
    .map((e) => ({
      uid: e.uid,
      start: toLocalString(parseLocal(e.start) - days * DAY),
      end: toLocalString(parseLocal(e.end) - days * DAY),
    }))
  return {
    moves,
    report: {
      finish: moves.at(-1)?.start.slice(0, 10) ?? today,
      finishBefore: ahead(calendar).at(-1)?.start.slice(0, 10) ?? today,
      deadline: deadlineOf(plan, calendar),
      peakWeek: 6,
      peakDay: 2,
      overWeeks: [],
      moved: moves.length,
      late: 0,
      unplaced: 0,
      provenBest: true,
      reasons: [],
    },
  }
}

/** A solver that answers only when the story says so, in any order. */
function heldSolver() {
  const pending: ((result: RebalanceResult) => void)[] = []
  const rebalance = fn(
    async (_plan: Plan, _request: RebalanceRequest) =>
      new Promise<RebalanceResult>((resolve) => {
        pending.push(resolve)
      }),
  )
  return {
    rebalance,
    answer: (call: number, result: RebalanceResult) => pending[call]?.(result),
    reset: () => {
      pending.length = 0
    },
  }
}

/**
 * Stands in for the app: stores changes with the same reducer the server uses, each as its own step of the
 * history, so Apply and Undo work and nothing is saved.
 */
function Host(props: ComponentProps<typeof TimelinePage>) {
  const base = props.state.plan
  const [history, setHistory] = useState(emptyHistory)
  const [expanded, setExpanded] = useState(props.expanded ?? false)
  const state = useMemo(
    () => ({ ...props.state, plan: applyEdits(base, historyEdits(history)).plan, history: historyView(history) }),
    [props.state, base, history],
  )
  return (
    <TimelinePage
      {...props}
      state={state}
      expanded={expanded}
      onExpandedChange={(next) => {
        props.onExpandedChange?.(next)
        setExpanded(next)
      }}
      onChangeAll={async (changes) => {
        await props.onChangeAll(changes)
        setHistory((prev) =>
          changes.reduce((steps, change) => {
            const before = historyEdits(steps)
            return recordChange(steps, applyEdits(base, before).plan, change, applyChange(base, before, change))
          }, prev),
        )
      }}
      onTravel={async (cursor) => {
        await props.onTravel(cursor)
        setHistory((prev) => travel(prev, cursor))
      }}
    />
  )
}

const meta = {
  title: 'Planner/Page/TimelinePage',
  component: TimelinePage,
  parameters: { layout: 'fullscreen' },
  args: {
    state: { plan, canEdit: true, history: historyView(emptyHistory()) },
    onChangeAll: fn(async () => {}),
    onTravel: fn(async () => {}),
    onExpandedChange: fn(),
    rebalance: fn(async (_plan: Plan, request: RebalanceRequest) => resultFor(request.calendar, 1)),
  },
  argTypes: { state: { control: false } },
  // The zoom is remembered per browser: every story starts from the whole plan.
  beforeEach: () => localStorage.removeItem('learning-curve:timeline-zoom'),
  render: (args) => <Host {...args} />,
} satisfies Meta<typeof TimelinePage>

export default meta
type Story = StoryObj<typeof meta>

const chart = async (canvas: HTMLElement) => within(canvas).findByRole('region', { name: m.timeline() })
const panel = (canvas: HTMLElement) => within(within(canvas).getByRole('region', { name: m.timeline_course() }))
const draftBar = (canvas: HTMLElement) => within(canvas).queryByRole('region', { name: m.timeline_draft() })
const findDraftBar = async (canvas: HTMLElement) => within(canvas).findByRole('region', { name: m.timeline_draft() })
const applyButton = async (canvas: HTMLElement) =>
  within(await findDraftBar(canvas)).getByRole('button', { name: m.reschedule_apply() })

async function select(canvas: HTMLElement, course: RegExp) {
  await userEvent.click(within(await chart(canvas)).getByRole('button', { name: course }))
}

async function laterWeek(canvas: HTMLElement) {
  await userEvent.click(panel(canvas).getByRole('button', { name: m.timeline_later_week() }))
}

/** Presses a lane in its middle and drags it sideways by `by` weeks of the track as drawn now. */
async function dragLane(lane: HTMLElement, by: number) {
  const shown = lanesRange(calendarLanes(plan, now, NONE), now)
  const days = shown ? (shown.end - shown.start) / DAY : 1
  const box = lane.getBoundingClientRect()
  const week = ((lane.parentElement ?? lane).getBoundingClientRect().width / days) * 7
  const at = { ...MOUSE, clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }
  await fireEvent.pointerDown(lane, at)
  await fireEvent.pointerMove(lane, { ...at, clientX: at.clientX + (week * by) / 2 })
  await fireEvent.pointerMove(lane, { ...at, clientX: at.clientX + week * by })
  await fireEvent.pointerUp(lane, { ...at, clientX: at.clientX + week * by })
  await fireEvent.click(lane)
}

/**
 * The page as the app renders it at `/timeline`. Every course is a lane; a course picked on its lane shows its
 * dates, deadline and spare days on the panel, with the ways to change them. A small in-memory host stands in for
 * the app, so Apply and Undo work and nothing is saved.
 */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const region = within(await chart(canvasElement))
    await expect(region.getByText('Gemini Certs')).toBeVisible()
    await expect(region.getByText('Practical Python')).toBeVisible()
    await expect(panel(canvasElement).getByText(m.timeline_pick())).toBeVisible()
    await expect(draftBar(canvasElement)).toBeNull()
  },
}

/** A drop is a draft: the lane is drawn over the course as it was, the bar counts what would change, nothing is stored. */
export const DragMakesADraft: Story = {
  play: async ({ args, canvasElement }) => {
    await dragLane(within(await chart(canvasElement)).getByRole('button', { name: LLM }), 1.2)
    const bar = await findDraftBar(canvasElement)
    await waitFor(() =>
      expect(bar).toHaveTextContent(m.timeline_draft_summary({ courses: 1, sessions: ahead('hfllm').length })),
    )
    await expect(canvasElement.querySelector('[data-before]')).not.toBeNull()
    await expect(panel(canvasElement).getByRole('heading', { name: 'Hugging Face: LLM Course' })).toBeVisible()
    await pause(50)
    await expect(args.onChangeAll).not.toHaveBeenCalled()
  },
}

/** Apply stores the draft in one go; Undo then steps back over every change it made. */
export const ApplyStoresTheDraft: Story = {
  play: async ({ args, canvasElement }) => {
    await select(canvasElement, LLM)
    await laterWeek(canvasElement)
    const apply = await applyButton(canvasElement)
    await waitFor(() => expect(apply).toBeEnabled())
    await userEvent.click(apply)
    await waitFor(() => expect(args.onChangeAll).toHaveBeenCalledTimes(1))
    await expect(args.onChangeAll).toHaveBeenCalledWith([
      { type: 'events.shift', calendars: ['hfllm'], from: today, days: 7 },
    ])
    await expect(await within(canvasElement).findByText(m.timeline_applied({ count: 1 }))).toBeVisible()
    await expect(draftBar(canvasElement)).toBeNull()
    await userEvent.click(within(canvasElement).getByRole('button', { name: m.undo() }))
    await waitFor(() => expect(args.onTravel).toHaveBeenCalledWith(0))
  },
}

/** Discard drops the draft: the plan is drawn as it is and nothing was stored. */
export const DiscardDropsTheDraft: Story = {
  play: async ({ args, canvasElement }) => {
    await select(canvasElement, LLM)
    await laterWeek(canvasElement)
    await userEvent.click(within(await findDraftBar(canvasElement)).getByRole('button', { name: m.timeline_discard() }))
    await waitFor(() => expect(draftBar(canvasElement)).toBeNull())
    await expect(canvasElement.querySelector('[data-before]')).toBeNull()
    await expect(args.onChangeAll).not.toHaveBeenCalled()
  },
}

const solver = heldSolver()

/** A new finish is worked out by the solver; until it answers the course says so and the draft cannot be applied. */
export const FinishByAsksTheSolver: Story = {
  args: { rebalance: solver.rebalance },
  play: async ({ args, canvasElement }) => {
    solver.reset()
    await select(canvasElement, CERTS)
    await userEvent.click(panel(canvasElement).getByRole('button', { name: m.timeline_finish_by_deadline() }))
    await waitFor(() => expect(solver.rebalance).toHaveBeenCalledTimes(1))
    await expect(solver.rebalance).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        calendar: 'certs',
        from: today,
        deadline: deadlineOf(plan, 'certs'),
        target: { mode: 'deadline' },
      }),
    )
    const apply = await applyButton(canvasElement)
    await expect(apply).toBeDisabled()
    await expect(panel(canvasElement).getByText(m.reschedule_working())).toBeVisible()
    const result = resultFor('certs', 1)
    solver.answer(0, result)
    await waitFor(() => expect(apply).toBeEnabled())
    await userEvent.click(apply)
    await waitFor(() => expect(args.onChangeAll).toHaveBeenCalledWith([rebalanceChange(result, 'certs')]))
  },
}

/** A re-balance that fails says why on the course and blocks Apply; resetting the course clears it. */
export const AFailedRebalanceBlocksApply: Story = {
  args: { rebalance: fn(async (_plan: Plan, _request: RebalanceRequest) => Promise.reject(new Error('No room'))) },
  play: async ({ canvasElement }) => {
    await select(canvasElement, CERTS)
    await userEvent.click(panel(canvasElement).getByRole('button', { name: m.timeline_finish_by_deadline() }))
    await expect(await panel(canvasElement).findByText(m.reschedule_failed({ reason: 'No room' }))).toBeVisible()
    await expect(await applyButton(canvasElement)).toBeDisabled()
    await userEvent.click(panel(canvasElement).getByRole('button', { name: m.timeline_reset_course() }))
    await waitFor(() => expect(draftBar(canvasElement)).toBeNull())
    await expect(panel(canvasElement).queryByText(m.reschedule_failed({ reason: 'No room' }))).toBeNull()
  },
}

const slow = heldSolver()

/** An answer to a finish day that was changed since is dropped: the draft keeps the newer answer. */
export const StaleAnswerIsDropped: Story = {
  args: { rebalance: slow.rebalance },
  play: async ({ args, canvasElement }) => {
    slow.reset()
    await select(canvasElement, LLM)
    const finish = panel(canvasElement).getByLabelText(m.reschedule_finish_by())
    await fireEvent.change(finish, { target: { value: addDays(today, 40) } })
    await waitFor(() => expect(slow.rebalance).toHaveBeenCalledTimes(1))
    await fireEvent.change(finish, { target: { value: addDays(today, 50) } })
    await waitFor(() => expect(slow.rebalance).toHaveBeenCalledTimes(2))
    const newer = resultFor('hfllm', 2)
    slow.answer(1, newer)
    slow.answer(0, resultFor('hfllm', 1))
    await pause(50)
    const apply = await applyButton(canvasElement)
    await waitFor(() => expect(apply).toBeEnabled())
    await userEvent.click(apply)
    await waitFor(() => expect(args.onChangeAll).toHaveBeenCalledTimes(1))
    await expect(args.onChangeAll).toHaveBeenCalledWith([rebalanceChange(newer, 'hfllm')])
  },
}

/**
 * Two courses in one draft are worked out in the order they were changed, each on the plan the one before leaves;
 * the review lists what the whole draft changes.
 */
export const TwoCoursesInOrder: Story = {
  play: async ({ args, canvasElement }) => {
    const deadline = addDays(deadlineOf(plan, 'certs') ?? today, 7)
    await select(canvasElement, CERTS)
    await fireEvent.change(panel(canvasElement).getByLabelText(m.reschedule_deadline()), {
      target: { value: deadline },
    })
    await select(canvasElement, LLM)
    await laterWeek(canvasElement)
    const moved = deadlineChange(plan, 'certs', deadline)
    const expected: PlanChange[] = [
      ...(moved ? [moved] : []),
      { type: 'events.shift', calendars: ['hfllm'], from: today, days: 7 },
    ]
    const bar = await findDraftBar(canvasElement)
    await waitFor(() =>
      expect(bar).toHaveTextContent(m.timeline_draft_summary({ courses: 2, sessions: ahead('hfllm').length })),
    )
    await userEvent.click(within(bar).getByRole('button', { name: m.timeline_review() }))
    const review = await within(canvasElement.ownerDocument.body).findByRole('dialog')
    const { diff } = previewUpdate(plan, expected)
    // The dialog grows in: its content is visible once that is over.
    await waitFor(() => expect(within(review).getByText(m.file_changed({ count: diff.changed.length }))).toBeVisible())
    await userEvent.click(within(review).getByRole('button', { name: m.reschedule_apply() }))
    await waitFor(() => expect(args.onChangeAll).toHaveBeenCalledTimes(1))
    await expect(args.onChangeAll).toHaveBeenCalledWith(expected)
  },
}

/** A re-balance that leaves sessions without room is a failure too: the course says why and Apply stays shut. */
export const AnUnplacedRebalanceBlocksApply: Story = {
  args: {
    rebalance: fn(async (_plan: Plan, request: RebalanceRequest) => {
      const result = resultFor(request.calendar, 1)
      return { ...result, report: { ...result.report, unplaced: 2 } }
    }),
  },
  play: async ({ canvasElement }) => {
    await select(canvasElement, CERTS)
    await userEvent.click(panel(canvasElement).getByRole('button', { name: m.timeline_finish_by_deadline() }))
    const reason = m.reschedule_unplaced({ count: 2 })
    await expect(await panel(canvasElement).findByText(m.reschedule_failed({ reason }))).toBeVisible()
    await expect(await applyButton(canvasElement)).toBeDisabled()
  },
}

const seen = fn(async (_plan: Plan, request: RebalanceRequest) => resultFor(request.calendar, 1))

/** The second course of a draft is re-balanced on the plan the first one's change leaves, not on the plan as it is. */
export const TheSecondCourseSeesTheFirst: Story = {
  args: { rebalance: seen },
  play: async ({ canvasElement }) => {
    seen.mockClear()
    const [first] = ahead('hfllm')
    await select(canvasElement, LLM)
    await laterWeek(canvasElement)
    await select(canvasElement, CERTS)
    await userEvent.click(panel(canvasElement).getByRole('button', { name: m.timeline_finish_by_deadline() }))
    await waitFor(() => expect(seen).toHaveBeenCalledTimes(1))
    const [base] = seen.mock.lastCall ?? []
    await expect(first && base?.events.find((e) => e.uid === first.uid)?.start).toBe(
      first && toLocalString(parseLocal(first.start) + 7 * DAY),
    )
  },
}

/** The week buttons stop where a drag would: no session moves into the past, and no further than one shift allows. */
export const WeekButtonsKeepTheirBounds: Story = {
  play: async ({ canvasElement }) => {
    const [first] = ahead('certs')
    await expect(first && parseLocal(first.start) - parseLocal(`${today}T00:00`)).toBeLessThan(7 * DAY)
    await select(canvasElement, CERTS)
    const earlier = panel(canvasElement).getByRole('button', { name: m.timeline_earlier_week() })
    const laterButton = panel(canvasElement).getByRole('button', { name: m.timeline_later_week() })
    await expect(earlier).toBeDisabled()
    await userEvent.click(laterButton)
    await expect(earlier).toBeEnabled()
    for (let week = 1; week < 52; week++) void fireEvent.click(laterButton)
    await waitFor(() => expect(laterButton).toBeDisabled())
    await expect(panel(canvasElement).getByText(/\+52/)).toBeVisible()
  },
}

/** The host is told when the page gets a draft and when it loses it, so it can hold its own navigation. */
export const TellsTheHostAboutTheDraft: Story = {
  args: { onDraftChange: fn() },
  play: async ({ args, canvasElement }) => {
    await select(canvasElement, LLM)
    await laterWeek(canvasElement)
    await waitFor(() => expect(args.onDraftChange).toHaveBeenLastCalledWith(true))
    await userEvent.click(within(await findDraftBar(canvasElement)).getByRole('button', { name: m.timeline_discard() }))
    await waitFor(() => expect(args.onDraftChange).toHaveBeenLastCalledWith(false))
  },
}

/** A navigation the host holds for the draft asks first: stay and keep the draft, or drop it and go. */
export const AsksBeforeTheHostLeaves: Story = {
  args: { leaving: { onStay: fn(), onLeave: fn() } },
  play: async ({ args, canvasElement }) => {
    const ask = await within(canvasElement.ownerDocument.body).findByRole('dialog')
    await waitFor(() => expect(within(ask).getByText(m.timeline_leave_title())).toBeVisible())
    await userEvent.click(within(ask).getByRole('button', { name: m.timeline_stay() }))
    await expect(args.leaving?.onStay).toHaveBeenCalledTimes(1)
    await userEvent.click(within(ask).getByRole('button', { name: m.timeline_leave() }))
    await expect(args.leaving?.onLeave).toHaveBeenCalledTimes(1)
  },
}

/** Whether the browser would ask before leaving the page. */
function leaveAsks() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

/** Leaving the page with a draft asks first; without one it does not. */
export const LeavingWithADraftAsks: Story = {
  play: async ({ canvasElement }) => {
    await expect(leaveAsks()).toBe(false)
    await select(canvasElement, LLM)
    await laterWeek(canvasElement)
    await findDraftBar(canvasElement)
    await expect(leaveAsks()).toBe(true)
  },
}

/** `canEdit: false`: courses can be picked and read, not changed. */
export const ReadOnly: Story = {
  args: { state: { plan, canEdit: false, history: historyView(emptyHistory()) } },
  play: async ({ canvasElement }) => {
    const region = within(await chart(canvasElement))
    await expect(region.queryAllByRole('slider')).toEqual([])
    await select(canvasElement, LLM)
    await expect(panel(canvasElement).getByRole('heading', { name: 'Hugging Face: LLM Course' })).toBeVisible()
    await expect(panel(canvasElement).queryByRole('button', { name: m.timeline_later_week() })).toBeNull()
  },
}

/** With nothing ahead in any course the page says so instead of an empty chart. */
export const NoCourses: Story = {
  args: { state: { plan: { ...plan, events: [] }, canEdit: true, history: historyView(emptyHistory()) } },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByText(m.timeline_empty())).toBeVisible()
    await expect(within(canvasElement).queryByRole('region', { name: m.timeline() })).toBeNull()
  },
}

/**
 * On a phone the page never scrolls sideways: only the chart's own days do, and the panel follows it. Scrolled, the
 * chart passes under the header that stays at the top.
 */
export const Phone: Story = {
  args: {
    // Like the app's sections: a row that scrolls sideways and is wider than a phone.
    headerAside: (
      <div className="flex min-w-0 gap-1.5 overflow-x-auto">
        {['Plan', 'Timeline', 'Focus', 'Progress', 'Components', 'Settings', 'Library', 'Help'].map((name) => (
          <button key={name} type="button" className="px-3 py-2 whitespace-nowrap">
            {name} section
          </button>
        ))}
      </div>
    ),
  },
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument.documentElement
    await expect(window.innerWidth).toBeLessThan(500)
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    await select(canvasElement, LLM)
    await laterWeek(canvasElement)
    await findDraftBar(canvasElement)
    await expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
    // Scrolled under the header that stays at the top, the chart's own sticky column stays under it too.
    const region = await chart(canvasElement)
    window.scrollTo(0, region.getBoundingClientRect().top + window.scrollY + 120)
    const top = [...canvasElement.querySelectorAll<HTMLElement>('.sticky')].find(
      (el) => !region.contains(el) && el.getBoundingClientRect().height > 0,
    )
    if (!top) throw new Error('no sticky header')
    const bar = top.getBoundingClientRect()
    const hit = canvasElement.ownerDocument.elementFromPoint(bar.left + 40, bar.top + bar.height / 2)
    await expect(top.contains(hit)).toBe(true)
    window.scrollTo(0, 0)
  },
}

// The browser's full screen as the story sees it; set up anew before each story that uses it.
let screen: ReturnType<typeof fakeFullscreen> | null = null
const withScreen = () => {
  screen = fakeFullscreen()
  return screen.restore
}

/**
 * Expand gives the timeline the whole window: the page header goes, the chart reaches the bottom of the window and
 * the course panel shows only while a course is picked, with a way to close it. Collapse brings the page back.
 */
export const ExpandFillsTheWindow: Story = {
  play: async ({ args, canvasElement }) => {
    const page = within(canvasElement)
    await expect(page.getByRole('heading', { level: 1, name: m.timeline() })).toBeVisible()
    await userEvent.click(within(await chart(canvasElement)).getByRole('button', { name: m.expand() }))
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true)
    await waitFor(() => expect(page.queryByRole('heading', { level: 1 })).toBeNull())
    const region = await chart(canvasElement)
    await waitFor(() => expect(window.innerHeight - region.getBoundingClientRect().bottom).toBeLessThan(40))
    await expect(page.queryByRole('region', { name: m.timeline_course() })).toBeNull()
    await select(canvasElement, LLM)
    const course = page.getByRole('region', { name: m.timeline_course() })
    await expect(course).toBeVisible()
    await userEvent.click(within(course).getByRole('button', { name: m.close() }))
    await waitFor(() => expect(page.queryByRole('region', { name: m.timeline_course() })).toBeNull())
    await userEvent.click(within(region).getByRole('button', { name: m.collapse() }))
    await expect(args.onExpandedChange).toHaveBeenLastCalledWith(false)
    await waitFor(() => expect(page.getByRole('heading', { level: 1, name: m.timeline() })).toBeVisible())
  },
}

/** Full screen lays the timeline out as Expand does, across the whole screen; leaving it brings the page back. */
export const FullScreen: Story = {
  beforeEach: withScreen,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    const region = within(await chart(canvasElement))
    await userEvent.click(region.getByRole('button', { name: m.fullscreen() }))
    await expect(screen?.calls.requests).toBe(1)
    await waitFor(() => expect(page.queryByRole('heading', { level: 1 })).toBeNull())
    await expect(region.queryByRole('button', { name: m.expand() })).toBeNull()
    await userEvent.click(region.getByRole('button', { name: m.fullscreen_exit() }))
    await expect(screen?.calls.exits).toBe(1)
    await waitFor(() => expect(page.getByRole('heading', { level: 1, name: m.timeline() })).toBeVisible())
  },
}

/** The planner's keys work here too: E expands, Shift + F fills the screen. */
export const ExpandAndFullScreenByKeys: Story = {
  beforeEach: withScreen,
  play: async ({ args, canvasElement }) => {
    await chart(canvasElement)
    await userEvent.keyboard('e')
    await expect(args.onExpandedChange).toHaveBeenCalledWith(true)
    await userEvent.keyboard('{Shift>}F{/Shift}')
    await expect(screen?.calls.requests).toBe(1)
  },
}

/** The how-to under the title folds to one line, and stays folded in this browser. */
export const TheHintFolds: Story = {
  beforeEach: () => localStorage.removeItem('learning-curve:timeline-hint'),
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await expect(page.getByText(m.timeline_page_hint())).toBeVisible()
    await userEvent.click(page.getByText(m.timeline_how()))
    await waitFor(() => expect(page.getByText(m.timeline_page_hint())).not.toBeVisible())
    await expect(localStorage.getItem('learning-curve:timeline-hint')).toBe('folded')
  },
}

/** `Icons only` in the header leaves Expand and Full screen with their icons, named in their tooltips. */
export const IconsOnly: Story = {
  beforeEach: () => {
    clearIconsOnly()
    return clearIconsOnly
  },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement)
    await userEvent.click(page.getByRole('button', { name: m.icons_only() }))
    const expand = within(await chart(canvasElement)).getByRole('button', { name: m.expand() })
    await expect(within(expand).getByText(m.expand()).getBoundingClientRect().width).toBeLessThanOrEqual(1)
  },
}
