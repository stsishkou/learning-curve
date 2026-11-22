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
