import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import {
  calendarLanes,
  compareLanes,
  DAY,
  isSession,
  lanesRange,
  movedSessions,
  parseLocal,
  previewUpdate,
  type Plan,
  type PlanChange,
} from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'

import { TimelineChart } from './TimelineChart'

const NONE: ReadonlySet<string> = new Set()
const COURSES = ['Gemini Certs', 'Hugging Face: LLM Course', 'Hugging Face: AI Agents Course', 'Practical Python']

/** The chart's props for a plan as it is, or as a list of changes would leave it. */
function chartOf(plan: Plan, now: number | null = fixtureNow, changes: PlanChange[] = []) {
  const before = calendarLanes(plan, now, NONE)
  const { after, diff } = previewUpdate(plan, changes, now ?? fixtureNow)
  const lanes = calendarLanes(after, now, NONE)
  const range = lanesRange([...before, ...lanes], now) ?? { start: 0, end: DAY }
  const moved = movedSessions(diff)
  return { lanes, range, now, changes: compareLanes(before, lanes, moved), moved }
}

const meta = {
  title: 'Planner/Widgets/TimelineChart',
  component: TimelineChart,
  args: chartOf(fixturePlan),
  argTypes: { lanes: { control: false }, changes: { control: false }, range: { control: false } },
  // The zoom is remembered per browser: every story starts from the whole plan.
  beforeEach: () => localStorage.removeItem('learning-curve:timeline-zoom'),
} satisfies Meta<typeof TimelineChart>

export default meta
type Story = StoryObj<typeof meta>

const chart = (canvasElement: HTMLElement) => within(canvasElement).getByRole('region', { name: m.timeline() })

/** Every course with something ahead, in its colour, with how much of it is done, its deadline, today and the months. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    await expect(COURSES.filter((name) => region.queryByText(name) === null)).toEqual([])
    await expect(region.getByText('14/40')).toBeVisible()
    await expect(canvasElement.querySelectorAll('[data-today]').length).toBe(COURSES.length)
    await expect(canvasElement.querySelectorAll('[data-deadline]').length).toBe(1)
    // January is named with its year, whichever length the month names get at this width.
    await expect(region.getByText('2027')).toBeVisible()
    const legend = within(region.getByRole('list', { name: m.timeline_legend() }))
    for (const label of [m.timeline_legend_done(), m.timeline_legend_ahead(), m.timeline_legend_deadline()]) {
      // oxlint-disable-next-line no-await-in-loop -- one assertion per legend entry
      await expect(legend.getByText(label)).toBeVisible()
    }
    await expect(region.getByText(m.timeline_spare({ days: 6 }))).toBeVisible()
  },
}

const certs = fixturePlan.events
  .filter((e) => e.calendar === 'certs' && isSession(e))
  .toSorted((a, b) => a.start.localeCompare(b.start))
const forgotten = itemAt(certs, 0)
const withMissed: Plan = {
  ...fixturePlan,
  events: fixturePlan.events.map((e) => (e.uid === forgotten.uid ? { ...e, done: false } : e)),
}

/** A past session that was never marked done stands out on its lane. */
export const MissedSession: Story = {
  args: chartOf(withMissed),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-state="missed"]').length).toBe(1)
  },
}

/** Before the clock is known, as on the server, the lanes are drawn without a today line. */
export const BeforeTheClock: Story = {
  args: chartOf(fixturePlan, null),
  play: async ({ canvasElement }) => {
    await expect(within(chart(canvasElement)).getByText('Gemini Certs')).toBeVisible()
    await expect(canvasElement.querySelector('[data-today]')).toBeNull()
  },
}

/** Three weeks on, the certificates began before the drawn days: their bar is cut at the start and fades there. */
export const CutAtTheStart: Story = {
  args: chartOf(fixturePlan, parseLocal('2026-12-21T10:00')),
  play: async ({ canvasElement }) => {
    const cut = canvasElement.querySelector<HTMLElement>('[data-cut="start"]')
    await expect(cut).not.toBeNull()
    await expect(cut?.style.left).toBe('0%')
  },
}

/** A narrow screen: only the chart's own scroller moves sideways, never the page. */
export const Narrow: Story = {
  decorators: [(Story) => <div className="w-[320px]">{Story()}</div>],
  play: async ({ canvasElement }) => {
    const region = chart(canvasElement)
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth)
    await userEvent.click(within(region).getByRole('button', { name: m.timeline_zoom_week() }))
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth)
  },
}

/**
 * Month names, Monday numbers and today stay inside the axis, and a month that starts a short way in does not run
 * into the name of the one before it, however narrow the chart.
 */
export const AxisLabelsFit: Story = {
  args: chartOf(fixturePlan, parseLocal('2026-11-25T12:00')),
  decorators: [(Story) => <div className="w-[320px]">{Story()}</div>],
  play: async ({ canvasElement }) => {
    const axis = canvasElement.querySelector<HTMLElement>('[data-axis]')
    if (!axis) throw new Error('no axis')
    await waitFor(() => expect(axis.querySelectorAll('[data-month]').length).toBeGreaterThan(1))
    const box = axis.getBoundingClientRect()
    const outside = [...axis.querySelectorAll('span')]
      .filter((label) => {
        const at = label.getBoundingClientRect()
        return at.bottom > box.bottom + 0.5 || at.top < box.top - 0.5
      })
      .map((label) => label.textContent)
    await expect(outside).toEqual([])
    const months = [...axis.querySelectorAll('[data-month]')]
      .map((label) => label.getBoundingClientRect())
      .toSorted((a, b) => a.left - b.left)
    const crowded = months.filter((at, i) => i > 0 && at.left < (months[i - 1]?.right ?? 0))
    await expect(crowded).toEqual([])
  },
}

/** With nothing ahead in any course there is nothing to draw. */
export const NoLanes: Story = {
  args: { lanes: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull()
  },
}

const scroller = (canvasElement: HTMLElement) => {
  const box = canvasElement.querySelector<HTMLElement>('[data-scroller]')
  if (!box) throw new Error('no scroller')
  return box
}

/** A closer zoom makes the days wider than the screen: the chart scrolls, and Today brings today back into view. */
export const Zoomed: Story = {
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const box = scroller(canvasElement)
    await expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth)
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_week() }))
    await expect(box.scrollWidth).toBeGreaterThan(box.clientWidth * 2)
    box.scrollLeft = box.scrollWidth
    await userEvent.click(region.getByRole('button', { name: m.go_today() }))
    const inView = () => {
      const line = canvasElement.querySelector('[data-today]')?.getBoundingClientRect()
      const view = box.getBoundingClientRect()
      return line !== undefined && line.left > view.left && line.left < view.right
    }
    await waitFor(() => expect(inView()).toBe(true))
  },
}

const moveCerts: PlanChange[] = [{ type: 'events.shift', calendars: ['certs'], from: '2026-12-02', days: 14 }]

/** A course the draft moves: its old bar stays under the new one, moved sessions are marked, the shift is named. */
export const ChangedLane: Story = {
  args: chartOf(fixturePlan, fixtureNow, moveCerts),
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    await expect(canvasElement.querySelectorAll('[data-before]').length).toBe(1)
    await expect(canvasElement.querySelectorAll('[data-moved]').length).toBe(26)
    await expect(region.getByText(m.timeline_delta_days({ days: '+14' }))).toBeVisible()
    await expect(region.getByText(m.timeline_late({ days: 8 }))).toBeVisible()
    await userEvent.click(region.getByRole('checkbox', { name: m.timeline_show_before() }))
    await expect(canvasElement.querySelector('[data-before]')).toBeNull()
  },
}

const editing = () => ({ onSelect: fn(), onMove: fn(), onFinish: fn(), onDeadline: fn() })
const drawn = lanesRange(calendarLanes(fixturePlan, fixtureNow, NONE), fixtureNow)
const RANGE_DAYS = drawn ? (drawn.end - drawn.start) / DAY : 1
const LLM = /Hugging Face: LLM Course/
const CERTS = /Gemini Certs/
const MOUSE = { pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true }
const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Presses a lane in its middle and moves the pointer sideways by `weeks` of the track. */
async function pressAndMove(lane: HTMLElement, weeks: number) {
  const box = lane.getBoundingClientRect()
  const track = (lane.parentElement ?? lane).getBoundingClientRect()
  const at = { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 }
  const week = (track.width / RANGE_DAYS) * 7
  await fireEvent.pointerDown(lane, { ...MOUSE, ...at })
  await fireEvent.pointerMove(lane, { ...MOUSE, ...at, clientX: at.clientX + (week * weeks) / 2 })
  await fireEvent.pointerMove(lane, { ...MOUSE, ...at, clientX: at.clientX + week * weeks })
  return { ...MOUSE, ...at, clientX: at.clientX + week * weeks }
}

/**
 * While a course is dragged it fades where it is, and the tip names the shift, the sessions it takes along, the new
 * dates and that it would end after its deadline.
 */
export const MoveTipSaysTheResult: Story = {
  args: { edit: editing() },
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const lane = region.getByRole('button', { name: CERTS })
    const end = await pressAndMove(lane, 1.2)
    const tip = region.getByText(m.timeline_shift_weeks({ weeks: '+1' }), { exact: false })
    await expect(tip).toBeVisible()
    await expect(tip).toHaveTextContent(m.timeline_sessions({ count: 26 }))
    await expect(tip).toHaveTextContent(m.timeline_late({ days: 1 }))
    const course = lane.parentElement?.querySelector('[data-course]')
    await expect(course && getComputedStyle(course).opacity).toBe('0.4')
    await fireEvent.keyDown(lane, { key: 'Escape' })
    await fireEvent.pointerUp(lane, end)
  },
}

/** While the end of a course is dragged, the tip says how many sessions would be placed again. */
export const FinishTipCountsSessions: Story = {
  args: { edit: editing() },
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const finish = region.getByRole('slider', { name: m.timeline_finish({ name: 'Hugging Face: LLM Course' }) })
    finish.focus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}')
    const open = calendarLanes(fixturePlan, fixtureNow, NONE).find((lane) => lane.calendar.id === 'hfllm')
    const count = open?.sessions.filter((s) => s.state !== 'done').length ?? 0
    await expect(region.getByText(m.timeline_sessions({ count }), { exact: false })).toBeVisible()
  },
}

/** While the deadline is moved, the tip says how many days the course would have to spare. */
export const DeadlineTipSaysSpare: Story = {
  args: { edit: editing() },
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const deadline = region.getByRole('slider', { name: m.timeline_deadline({ name: 'Gemini Certs' }) })
    deadline.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')
    await expect(region.getByText(m.timeline_spare({ days: 9 }), { exact: false })).toBeVisible()
  },
}

/** Zoomed in, the names stay over the days however far they are scrolled, and the days pass under them, deadline too. */
export const NamesStayOverTheDays: Story = {
  args: { edit: editing() },
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const box = scroller(canvasElement)
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_week() }))
    const name = region.getByText('Gemini Certs')
    const deadline = region.getByRole('slider', { name: m.timeline_deadline({ name: 'Gemini Certs' }) })
    const axis = canvasElement.querySelector('[data-axis]')
    if (!axis) throw new Error('no axis')
    box.scrollLeft = box.scrollWidth
    const view = box.getBoundingClientRect()
    await expect(name.getBoundingClientRect().left).toBeGreaterThanOrEqual(view.left)
    box.scrollLeft = 0
    const names = axis.getBoundingClientRect().left - view.left
    const mark = deadline.getBoundingClientRect()
    box.scrollLeft = mark.left + mark.width / 2 - view.left - names / 2
    const under = deadline.getBoundingClientRect()
    const hit = document.elementFromPoint(under.left + under.width / 2, under.top + under.height / 2)
    await expect(hit && deadline.contains(hit)).toBe(false)
  },
}

/** A click on a lane selects that course; nothing moves. */
export const SelectALane: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(chart(canvasElement)).getByRole('button', { name: LLM }))
    await expect(args.edit?.onSelect).toHaveBeenCalledWith('hfllm')
    await expect(args.edit?.onMove).not.toHaveBeenCalled()
  },
}

/** The selected course is pressed. */
export const Selected: Story = {
  args: { edit: editing(), selected: 'hfllm' },
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    await expect(region.getByRole('button', { name: LLM })).toHaveAttribute('aria-pressed', 'true')
    await expect(region.getByRole('button', { name: CERTS })).toHaveAttribute('aria-pressed', 'false')
  },
}

/** A course whose re-balance is being worked out says so. */
export const WorkingLane: Story = {
  args: { edit: editing(), working: new Set(['hfllm']) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[aria-busy="true"]').length).toBe(1)
  },
}

/** A lane dragged a week and a bit moves its open sessions by one week; the click after the drop selects nothing. */
export const DragALaneByAWeek: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const lane = within(chart(canvasElement)).getByRole('button', { name: LLM })
    const end = await pressAndMove(lane, 1.2)
    await fireEvent.pointerUp(lane, end)
    await fireEvent.click(lane)
    await waitFor(() => expect(args.edit?.onMove).toHaveBeenCalledWith('hfllm', 7))
    await expect(args.edit?.onSelect).not.toHaveBeenCalled()
  },
}

const order: string[] = []

/**
 * A drop is acted on only after the click it leaves behind: a dialog the drop opens would otherwise take that click
 * as one outside it and close at once.
 */
export const ADropActsAfterItsClick: Story = {
  args: { edit: { ...editing(), onMove: (_calendar: string, days: number) => void order.push(`move ${days}`) } },
  play: async ({ canvasElement }) => {
    order.length = 0
    const lane = within(chart(canvasElement)).getByRole('button', { name: LLM })
    const end = await pressAndMove(lane, 1.2)
    lane.addEventListener('click', () => order.push('click'), { once: true })
    // Both in one go, as a browser sends them: nothing awaited in between.
    lane.dispatchEvent(new PointerEvent('pointerup', { ...end, bubbles: true }))
    lane.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitFor(() => expect(order).toEqual(['click', 'move 7']))
  },
}

/** Escape during a drag puts the lane back: letting go a moment later moves nothing and selects nothing. */
export const EscapeCancelsADrag: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const lane = within(chart(canvasElement)).getByRole('button', { name: LLM })
    const end = await pressAndMove(lane, 1.2)
    await fireEvent.keyDown(lane, { key: 'Escape' })
    await pause(150)
    await fireEvent.pointerUp(lane, end)
    await fireEvent.click(lane)
    await pause(50)
    await expect(args.edit?.onMove).not.toHaveBeenCalled()
    await expect(args.edit?.onSelect).not.toHaveBeenCalled()
  },
}

/** The deadline moves by keys: two days later and Enter asks for it; Escape puts back a day not asked for. */
export const DeadlineByKeys: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const deadline = within(chart(canvasElement)).getByRole('slider', {
      name: m.timeline_deadline({ name: 'Gemini Certs' }),
    })
    await expect(deadline).toHaveAccessibleDescription(m.timeline_keys())
    deadline.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{Enter}')
    await expect(args.edit?.onDeadline).toHaveBeenCalledWith('certs', '2027-01-01')
    await userEvent.keyboard('{ArrowRight}')
    await expect(deadline).toHaveAttribute('aria-valuetext', fmtDay(parseLocal('2026-12-31')))
    await userEvent.keyboard('{Escape}')
    await expect(deadline).toHaveAttribute('aria-valuetext', fmtDay(parseLocal('2026-12-30')))
    await expect(args.edit?.onDeadline).toHaveBeenCalledTimes(1)
  },
}

/** The end of a course a week earlier by keys asks to re-balance it to finish by that day. */
export const FinishByKeys: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const finish = within(chart(canvasElement)).getByRole('slider', {
      name: m.timeline_finish({ name: 'Hugging Face: LLM Course' }),
    })
    finish.focus()
    await userEvent.keyboard('{PageDown}{Enter}')
    await expect(args.edit?.onFinish).toHaveBeenCalledWith('hfllm', '2027-02-15')
  },
}

/** Without editing the lanes are a picture: nothing to press or drag. */
export const ReadOnly: Story = {
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    await expect(region.queryAllByRole('slider')).toEqual([])
    await expect(region.queryByRole('button', { name: LLM })).toBeNull()
  },
}

/** Keys pressed while the deadline is dragged: Escape cancels the drag, Enter leaves the drop to ask once. */
export const KeysDuringAHandleDrag: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const deadline = within(chart(canvasElement)).getByRole('slider', {
      name: m.timeline_deadline({ name: 'Gemini Certs' }),
    })
    const cancelled = await pressAndMove(deadline, 3 / 7)
    await fireEvent.keyDown(deadline, { key: 'Escape' })
    await fireEvent.pointerUp(deadline, cancelled)
    await expect(args.edit?.onDeadline).not.toHaveBeenCalled()

    const dropped = await pressAndMove(deadline, 2 / 7)
    await fireEvent.keyDown(deadline, { key: 'Enter' })
    await fireEvent.pointerUp(deadline, dropped)
    await waitFor(() => expect(args.edit?.onDeadline).toHaveBeenCalledWith('certs', '2027-01-01'))
    await pause(50)
    await expect(args.edit?.onDeadline).toHaveBeenCalledTimes(1)
  },
}

/** A second finger on a lane is ignored: once both have lifted, the page still scrolls by touch. */
export const SecondFinger: Story = {
  args: { edit: editing() },
  play: async ({ canvasElement }) => {
    const lane = within(chart(canvasElement)).getByRole('button', { name: LLM })
    const box = lane.getBoundingClientRect()
    const at = { pointerType: 'touch', button: 0, clientX: box.left + box.width / 2, clientY: box.top + 10 }
    await fireEvent.pointerDown(lane, { ...at, pointerId: 2, isPrimary: true })
    await fireEvent.pointerDown(lane, { ...at, pointerId: 3, isPrimary: false, clientX: at.clientX + 40 })
    await fireEvent.pointerUp(lane, { ...at, pointerId: 3, isPrimary: false, clientX: at.clientX + 40 })
    await fireEvent.pointerUp(lane, { ...at, pointerId: 2, isPrimary: true })
    await pause(500)
    const swipe = new Event('touchmove', { bubbles: true, cancelable: true })
    canvasElement.ownerDocument.dispatchEvent(swipe)
    await expect(swipe.defaultPrevented).toBe(false)
  },
}

/** The course that ends last can still end later: the drawn days run two weeks past it. */
export const LastCourseEndsLater: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const finish = within(chart(canvasElement)).getByRole('slider', {
      name: m.timeline_finish({ name: 'Practical Python' }),
    })
    finish.focus()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    await expect(args.edit?.onFinish).toHaveBeenCalledWith('pypy', '2027-03-10')
  },
}

/** The day in the middle of the days in view, past the names over them, in days from the start of the range. */
function middleDay(canvasElement: HTMLElement, range: { start: number; end: number }) {
  const box = scroller(canvasElement)
  const view = box.getBoundingClientRect()
  const track = canvasElement.querySelector('[data-axis]')?.getBoundingClientRect()
  if (!track) throw new Error('no axis')
  const names = track.left - view.left + box.scrollLeft
  const middle = (view.left + names + view.right) / 2
  return ((middle - track.left) / track.width) * ((range.end - range.start) / DAY)
}

/** A new zoom keeps the day that was in the middle of the view there, instead of jumping to other dates. */
export const ZoomKeepsTheDayInView: Story = {
  play: async ({ args, canvasElement }) => {
    const region = within(chart(canvasElement))
    const box = scroller(canvasElement)
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_month() }))
    box.scrollLeft = 600
    const day = middleDay(canvasElement, args.range)
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_week() }))
    await waitFor(() => expect(Math.abs(middleDay(canvasElement, args.range) - day)).toBeLessThan(1))
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_month() }))
    await waitFor(() => expect(Math.abs(middleDay(canvasElement, args.range) - day)).toBeLessThan(1))
  },
}

/** Dispatches a wheel turn over the days and says whether the chart took it. */
function wheel(target: Element, init: WheelEventInit) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event.defaultPrevented
}

/**
 * With a mouse wheel and nothing left to scroll up or down, turning it scrolls the days sideways; Shift + wheel and a
 * trackpad's sideways swipe stay the browser's own.
 */
export const WheelScrollsTheDays: Story = {
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const box = scroller(canvasElement)
    const [track] = canvasElement.querySelectorAll('[data-track]')
    if (!track) throw new Error('no track')
    await expect(wheel(track, { deltaY: 120 })).toBe(false)
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_month() }))
    const start = box.scrollLeft
    await expect(wheel(track, { deltaY: 120 })).toBe(true)
    await expect(box.scrollLeft).toBe(start + 120)
    await expect(wheel(track, { deltaY: -40 })).toBe(true)
    await expect(box.scrollLeft).toBe(start + 80)
    await expect(wheel(track, { deltaY: 120, shiftKey: true })).toBe(false)
    await expect(wheel(track, { deltaX: 30, deltaY: 5 })).toBe(false)
    await expect(box.scrollLeft).toBe(start + 80)
  },
}

/** While the page itself can still scroll, the wheel scrolls the page; at its end, the days. */
export const WheelScrollsThePageFirst: Story = {
  decorators: [
    (Story) => (
      <>
        <Story />
        <div style={{ height: 2000 }} />
      </>
    ),
  ],
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const box = scroller(canvasElement)
    const [track] = canvasElement.querySelectorAll('[data-track]')
    if (!track) throw new Error('no track')
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_month() }))
    box.scrollLeft = 200
    window.scrollTo(0, 0)
    await expect(wheel(track, { deltaY: 120 })).toBe(false)
    await expect(box.scrollLeft).toBe(200)
    await expect(wheel(track, { deltaY: -120 })).toBe(true)
    await expect(box.scrollLeft).toBe(80)
    window.scrollTo(0, canvasElement.ownerDocument.documentElement.scrollHeight)
    await expect(wheel(track, { deltaY: 120 })).toBe(true)
    await expect(box.scrollLeft).toBe(200)
    window.scrollTo(0, 0)
  },
}

/** Days with nothing on them can be grabbed with the mouse and dragged to scroll; a press on a course stays the course's. */
export const DragTheDaysToPan: Story = {
  args: { edit: editing() },
  play: async ({ canvasElement }) => {
    const region = within(chart(canvasElement))
    const box = scroller(canvasElement)
    await userEvent.click(region.getByRole('button', { name: m.timeline_zoom_month() }))
    box.scrollLeft = 300
    const [track] = canvasElement.querySelectorAll('[data-track]')
    const axis = canvasElement.querySelector('[data-axis]')
    if (!track || !axis) throw new Error('no track')
    const at = { pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true, clientX: 700, clientY: 10 }
    await fireEvent.pointerDown(track, at)
    await fireEvent.pointerMove(box, { ...at, clientX: 600 })
    await fireEvent.pointerMove(box, { ...at, clientX: 500 })
    await fireEvent.pointerUp(box, { ...at, clientX: 500 })
    await expect(box.scrollLeft).toBe(500)
    await fireEvent.pointerDown(axis, at)
    await fireEvent.pointerMove(box, { ...at, clientX: 800 })
    await fireEvent.pointerUp(box, { ...at, clientX: 800 })
    await expect(box.scrollLeft).toBe(400)
    const lane = region.getByRole('button', { name: LLM })
    await fireEvent.pointerDown(lane, at)
    await fireEvent.pointerMove(box, { ...at, clientX: 500 })
    await fireEvent.pointerUp(box, { ...at, clientX: 500 })
    await expect(box.scrollLeft).toBe(400)
  },
}

/** Given a height, the chart fills it: the lanes scroll up and down inside, under the days that stay at the top. */
export const FillsAHeight: Story = {
  args: { height: 220 },
  play: async ({ canvasElement }) => {
    await expect(Math.round(chart(canvasElement).getBoundingClientRect().height)).toBe(220)
    const box = scroller(canvasElement)
    await expect(box.scrollHeight).toBeGreaterThan(box.clientHeight)
    box.scrollTop = 60
    const axis = canvasElement.querySelector('[data-axis]')
    await waitFor(() =>
      expect(Math.abs((axis?.getBoundingClientRect().top ?? 0) - box.getBoundingClientRect().top)).toBeLessThan(2),
    )
  },
}

/** Controls the host owns, such as how much of the screen the chart takes, sit at the end of the chart's own bar. */
export const WithTools: Story = {
  args: { tools: <button type="button">Host tool</button> },
  play: async ({ canvasElement }) => {
    await expect(within(chart(canvasElement)).getByRole('button', { name: 'Host tool' })).toBeVisible()
  },
}
