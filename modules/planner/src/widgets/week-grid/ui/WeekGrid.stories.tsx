import { DAY, mondayOf, occurrences, parseLocal } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

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
export const ReadOnly: Story = { args: { onMove: undefined, onRemove: undefined, onCreate: undefined } }

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
