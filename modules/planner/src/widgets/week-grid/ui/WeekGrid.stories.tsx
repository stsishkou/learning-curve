import { DAY, isSession, mondayOf, occurrences, parseLocal, ymd, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ComponentProps } from 'react'
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test'

import { WeekGrid } from './WeekGrid'

const week = (monday: number) => occurrences(fixturePlan, monday, monday + 7 * DAY, new Set())
const coursesWeek = mondayOf(parseLocal('2027-01-11'))

const meta = {
  title: 'Planner/Widgets/WeekGrid',
  component: WeekGrid,
  args: {
    plan: fixturePlan,
    weekStart: fixtureWeek,
    items: week(fixtureWeek),
    now: fixtureNow,
    onSelect: fn(),
    onMove: fn(),
    onRemove: fn(),
    onCreate: fn(),
  },
  argTypes: { plan: { control: false }, items: { control: false } },
} satisfies Meta<typeof WeekGrid>

export default meta
type Story = StoryObj<typeof meta>

/** Only the hours around the week's events are drawn. */
export const Default: Story = {}

/** All 24 hours in a box that scrolls, opened at the first event. */
export const FullDay: Story = { args: { fullDay: true } }

/** A busier week in January with sessions of three courses. */
export const ThreeCourses: Story = {
  args: { weekStart: coursesWeek, items: week(coursesWeek), now: coursesWeek + 2 * DAY },
}

/** Without the three edit callbacks an event can only be opened. */
export const ReadOnly: StoryObj<typeof WeekGrid> = {
  args: { onMove: undefined, onRemove: undefined, onCreate: undefined },
}

/**
 * An event that is being created: pressing on an empty part of a day and dragging draws it, and while its form is
 * open the page passes it back as `draft`, so the dashed block follows the title and the times typed there.
 */
export const Drafting: Story = {
  args: {
    draft: {
      s: fixtureWeek + 2 * DAY + 15 * 3_600_000,
      e: fixtureWeek + 2 * DAY + 17 * 3_600_000,
      title: 'Deep work',
      calendar: 'personal',
    },
  },
}

/** The event whose dialog is open carries a ring, so it can be found next to the docked dialog. */
export const SelectedEvent: Story = {
  args: {
    selectedKey: week(fixtureWeek)
      .filter((o) => !o.allDay)
      .map((o) => `${o.uid}-${o.s}`)[0],
  },
}

/** One day as a single wide column: `weekStart` is that day and `dayCount` is 1. */
export const OneDay: Story = {
  args: {
    weekStart: fixtureWeek + DAY,
    dayCount: 1,
    items: week(fixtureWeek).filter((o) => o.s >= fixtureWeek + DAY && o.s < fixtureWeek + 2 * DAY),
  },
}

/** Monday to Friday on a larger time scale: 84 px to the hour instead of 56. */
export const WorkWeekZoomed: Story = {
  args: { dayCount: 5, hourHeight: 84, items: week(fixtureWeek).filter((o) => o.s < fixtureWeek + 5 * DAY) },
}

/** A second clock in the hour column: here Warsaw, two hours behind the plan's Minsk time. */
export const SecondZone: Story = { args: { secondZone: { label: 'Warsaw', shift: -2 * 3_600_000 } } }

/**
 * Busy time of the person's own calendar, passed as `busy`: grey hatched blocks behind the events, with a strip at
 * the edge of the day where an event covers one, and a chip in the all-day row for a day that is taken whole.
 */
export const OwnCalendar: Story = {
  args: {
    fullDay: true,
    busy: [
      { title: 'Standup', s: fixtureWeek + 9.5 * 3_600_000, e: fixtureWeek + 10 * 3_600_000 },
      { title: 'Planning', s: fixtureWeek + DAY + 18 * 3_600_000, e: fixtureWeek + DAY + 20 * 3_600_000 },
      { title: '', s: fixtureWeek + 2 * DAY + 13 * 3_600_000, e: fixtureWeek + 2 * DAY + 14.5 * 3_600_000 },
      { title: 'Day off', s: fixtureWeek + 3 * DAY, e: fixtureWeek + 4 * DAY, allDay: true },
    ],
  },
}

/** Minutes logged for two finished sessions of the fixture week: one ended early, one ran over. */
const LOGGED: Record<string, number> = { 'certs-011@learning-curve': 40, 'certs-014@learning-curve': 90 }
const loggedPlan: Plan = {
  ...fixturePlan,
  events: fixturePlan.events.map((e) => {
    const actual = LOGGED[e.uid]
    return actual === undefined ? e : { ...e, actual }
  }),
}

/**
 * A finished session with its real time logged keeps its planned slot and shows what happened in it: the part it
 * did not need is dashed, a session that ran over gets a hatched tail, and a timer next to the times says how
 * long it took.
 */
export const RealTime: Story = {
  args: { plan: loggedPlan, items: occurrences(loggedPlan, fixtureWeek, fixtureWeek + 7 * DAY, new Set()) },
  play: async ({ canvasElement }) => {
    const times = within(canvasElement)
      .getAllByRole('button')
      .map((button) => button.textContent)
    await expect(times.filter((text) => text.includes('12:00–13:000:40'))).toHaveLength(1)
    await expect(times.filter((text) => text.includes('13:00–14:001:30'))).toHaveLength(1)
  },
}

/** A grid whose events turn done when clicked, as they do from the event dialog. */
function DoneOnClick(props: ComponentProps<typeof WeekGrid>) {
  const [plan, setPlan] = useState(fixturePlan)
  return (
    <WeekGrid
      {...props}
      plan={plan}
      items={occurrences(plan, fixtureWeek, fixtureWeek + 7 * DAY, new Set())}
      onSelect={(o) =>
        setPlan({ ...plan, events: plan.events.map((e) => (e.uid === o.uid ? { ...e, done: true } : e)) })
      }
    />
  )
}
const open = itemAt(week(fixtureWeek).filter((o) => isSession(o) && !o.done && !o.allDay))

/**
 * An event marked done gets its check with a spring and a glow that fades, once: events that were done already stay
 * still. With reduced motion neither moves.
 */
export const JustDone: Story = {
  render: (args) => <DoneOnClick {...args} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('.lc-done-pop')).toBeNull()
    const card = canvasElement.querySelector<HTMLElement>(`[data-key="${open.uid}-${open.s}"]`)
    await expect(card).not.toBeNull()
    if (!card) return
    await userEvent.click(card)
    await expect(card.querySelector('.lc-done-pop')).not.toBeNull()
    await expect(card.querySelector('.lc-done-glow')).not.toBeNull()
    await expect(canvasElement.querySelectorAll('.lc-done-pop')).toHaveLength(1)
    await waitFor(() => expect(card.querySelector('.lc-done-pop')).toBeNull(), { timeout: 2500 })
  },
}

const carried = itemAt(fixturePlan.events.filter((e) => isSession(e) && parseLocal(e.end) < fixtureWeek))
const dropIn = fn<(start: number) => void>()

/**
 * A missed session dragged in from the backlog: the slot under the pointer shows where it lands, with its title and
 * its length, and letting go gives that start.
 */
export const DropIn: Story = {
  args: { carried, onDropIn: dropIn },
  play: async ({ canvasElement }) => {
    const wednesday = ymd(fixtureWeek + 2 * DAY)
    const column = canvasElement.querySelector<HTMLElement>(`[data-day="${wednesday}"]`)
    await expect(column).not.toBeNull()
    if (!column) return
    const clientY = column.getBoundingClientRect().y + 120
    await fireEvent.dragOver(column, { clientY, dataTransfer: new DataTransfer() })
    const preview = canvasElement.querySelector('[data-draft]')
    await expect(preview?.textContent).toContain(carried.title.slice(0, 12))
    await fireEvent.drop(column, { clientY, dataTransfer: new DataTransfer() })
    await expect(dropIn).toHaveBeenCalledOnce()
    const [start] = dropIn.mock.calls[0] ?? []
    await expect(start === undefined ? '' : ymd(start)).toBe(wednesday)
    await expect(canvasElement.querySelector('[data-draft]')).toBeNull()
  },
}

const moved = fn<NonNullable<ComponentProps<typeof WeekGrid>['onMove']>>()

/**
 * An event held above the first hour drawn makes the day longer, an hour at a time, so it can be moved to an early
 * morning without the full day.
 */
export const PastTheHours: Story = {
  args: { onMove: moved },
  play: async ({ canvasElement }) => {
    const firstLabel = () => canvasElement.querySelector('.rounded-bl-2xl > span')?.textContent ?? ''
    const before = firstLabel()
    const cards = [...canvasElement.querySelectorAll<HTMLElement>('[data-day] button[data-key]')].filter(
      (card) => card.closest<HTMLElement>('[data-day]')?.style.height,
    )
    const card = cards.toSorted((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).at(0)
    await expect(card).toBeDefined()
    if (!card) return
    const { x, y } = card.getBoundingClientRect()
    const pointer = { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x + 20 }
    await fireEvent.pointerDown(card, { ...pointer, clientY: y + 10 })
    await fireEvent.pointerMove(card, { ...pointer, clientY: y })
    await fireEvent.pointerMove(card, { ...pointer, clientY: 0 })
    // The labels name every hour after the first one drawn: the earliest is earlier now.
    await waitFor(() => expect(firstLabel() < before).toBe(true), { timeout: 2000 })
    await fireEvent.pointerUp(card, { ...pointer, clientY: 0 })
    await expect(moved).toHaveBeenCalledOnce()
    const [occurrence, slot] = moved.mock.calls[0] ?? []
    await expect(slot && occurrence && slot.s < occurrence.s && slot.e - slot.s === occurrence.e - occurrence.s).toBe(
      true,
    )
    await expect(firstLabel() < before).toBe(true)
  },
}
