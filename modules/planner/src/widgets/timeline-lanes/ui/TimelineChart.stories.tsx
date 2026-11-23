import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { calendarLanes, DAY, isSession, lanesRange, parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'

import { TimelineLanes } from './TimelineLanes'

const NONE: ReadonlySet<string> = new Set()
const COURSES = ['Gemini Certs', 'Hugging Face: LLM Course', 'Hugging Face: AI Agents Course', 'Practical Python']

const meta = {
  title: 'Planner/Widgets/TimelineLanes',
  component: TimelineLanes,
  args: { plan: fixturePlan, hidden: NONE, now: fixtureNow, position: 'below', onPosition: fn() },
  argTypes: { plan: { control: false }, hidden: { control: false } },
} satisfies Meta<typeof TimelineLanes>

export default meta
type Story = StoryObj<typeof meta>

const strip = (canvasElement: HTMLElement) => within(canvasElement).getByRole('region', { name: m.timeline() })

/** Every course with something ahead, in its colour, with how much of it is done, its deadline and today. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const region = within(strip(canvasElement))
    await expect(COURSES.filter((name) => region.queryByText(name) === null)).toEqual([])
    await expect(region.getByText('14/40')).toBeVisible()
    await expect(canvasElement.querySelectorAll('[data-today]').length).toBe(COURSES.length)
    await expect(canvasElement.querySelectorAll('[data-deadline]').length).toBe(1)

    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(region.getByRole('button', { name: m.timeline_position() }))
    await userEvent.click(await page.findByRole('menuitemcheckbox', { name: m.timeline_above() }))
    await expect(args.onPosition).toHaveBeenCalledWith('above')
    await userEvent.click(page.getByRole('menuitem', { name: m.timeline_hide() }))
    await expect(args.onPosition).toHaveBeenLastCalledWith('hidden')
  },
}

/** A calendar switched off in the filter has no lane either. */
export const HiddenCalendar: Story = {
  args: { hidden: new Set(['pypy']) },
  play: async ({ canvasElement }) => {
    await expect(within(strip(canvasElement)).queryByText('Practical Python')).toBeNull()
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
  args: { plan: withMissed },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-state="missed"]').length).toBe(1)
  },
}

/** Before the clock is known, as on the server, the lanes are drawn without a today line. */
export const BeforeTheClock: Story = {
  args: { now: null },
  play: async ({ canvasElement }) => {
    await expect(within(strip(canvasElement)).getByText('Gemini Certs')).toBeVisible()
    await expect(canvasElement.querySelector('[data-today]')).toBeNull()
  },
}

/** Three weeks on, the certificates began before the drawn days: their bar is cut at the start and fades there. */
export const CutAtTheStart: Story = {
  args: { now: parseLocal('2026-12-21T10:00') },
  play: async ({ canvasElement }) => {
    const cut = canvasElement.querySelector<HTMLElement>('[data-cut="start"]')
    await expect(cut).not.toBeNull()
    await expect(cut?.style.left).toBe('0%')
  },
}

/** A narrow screen: the names stand above their lanes and nothing scrolls sideways. */
export const Narrow: Story = {
  decorators: [(Story) => <div className="w-[320px]">{Story()}</div>],
  play: async ({ canvasElement }) => {
    const region = strip(canvasElement)
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth)
  },
}

/** With every calendar switched off there is nothing to draw: the strip steps aside. */
export const NoLanes: Story = {
  args: { hidden: new Set(fixturePlan.calendars.map((c) => c.id)) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull()
  },
}

const editing = () => ({ onOpen: fn(), onMove: fn(), onFinish: fn(), onDeadline: fn() })
const drawn = lanesRange(calendarLanes(fixturePlan, fixtureNow, NONE), fixtureNow)
const RANGE_DAYS = drawn ? (drawn.end - drawn.start) / DAY : 1
const LLM = /Hugging Face: LLM Course/
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

/** A click on a lane opens Reschedule for that calendar; nothing moves. */
export const OpenFromALane: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    await userEvent.click(within(strip(canvasElement)).getByRole('button', { name: LLM }))
    await expect(args.edit?.onOpen).toHaveBeenCalledWith('hfllm')
    await expect(args.edit?.onMove).not.toHaveBeenCalled()
  },
}

/** A lane dragged a week and a bit moves its open sessions by one week; the click after the drop opens nothing. */
export const DragALaneByAWeek: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const lane = within(strip(canvasElement)).getByRole('button', { name: LLM })
    const end = await pressAndMove(lane, 1.2)
    await fireEvent.pointerUp(lane, end)
    await fireEvent.click(lane)
    await waitFor(() => expect(args.edit?.onMove).toHaveBeenCalledWith('hfllm', 7))
    await expect(args.edit?.onOpen).not.toHaveBeenCalled()
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
    const lane = within(strip(canvasElement)).getByRole('button', { name: LLM })
    const end = await pressAndMove(lane, 1.2)
    lane.addEventListener('click', () => order.push('click'), { once: true })
    // Both in one go, as a browser sends them: nothing awaited in between.
    lane.dispatchEvent(new PointerEvent('pointerup', { ...end, bubbles: true }))
    lane.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await waitFor(() => expect(order).toEqual(['click', 'move 7']))
  },
}

/** Escape during a drag puts the lane back: letting go a moment later moves nothing and opens nothing. */
export const EscapeCancelsADrag: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const lane = within(strip(canvasElement)).getByRole('button', { name: LLM })
    const end = await pressAndMove(lane, 1.2)
    await fireEvent.keyDown(lane, { key: 'Escape' })
    await pause(150)
    await fireEvent.pointerUp(lane, end)
    await fireEvent.click(lane)
    await expect(args.edit?.onMove).not.toHaveBeenCalled()
    await expect(args.edit?.onOpen).not.toHaveBeenCalled()
  },
}

/** The deadline moves by keys: two days later and Enter stores it; Escape puts back a day that was not stored. */
export const DeadlineByKeys: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const deadline = within(strip(canvasElement)).getByRole('slider', {
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
    const finish = within(strip(canvasElement)).getByRole('slider', {
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
    const region = within(strip(canvasElement))
    await expect(region.queryAllByRole('slider')).toEqual([])
    await expect(region.queryByRole('button', { name: LLM })).toBeNull()
  },
}

/** Keys pressed while the deadline is dragged: Escape cancels the drag, Enter leaves the drop to store it once. */
export const KeysDuringAHandleDrag: Story = {
  args: { edit: editing() },
  play: async ({ args, canvasElement }) => {
    const deadline = within(strip(canvasElement)).getByRole('slider', {
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
    const lane = within(strip(canvasElement)).getByRole('button', { name: LLM })
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
    const finish = within(strip(canvasElement)).getByRole('slider', {
      name: m.timeline_finish({ name: 'Practical Python' }),
    })
    finish.focus()
    await userEvent.keyboard('{ArrowRight}{Enter}')
    await expect(args.edit?.onFinish).toHaveBeenCalledWith('pypy', '2027-03-10')
  },
}
