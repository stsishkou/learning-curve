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
  parameters: {
    docs: {
      description: {
        component:
          'Seven day columns with the events of one week. With `onMove`, `onRemove` and `onCreate` it is an editor: drag an event to move it, drag its edge to resize, double-click an empty slot to add one, or do the same from the keyboard.',
      },
    },
  },
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

export const Default: Story = {}

export const FullDay: Story = { args: { fullDay: true } }

export const ThreeCourses: Story = {
  args: { weekStart: coursesWeek, items: week(coursesWeek), now: coursesWeek + 2 * DAY },
}

export const ReadOnly: Story = { args: { onMove: undefined, onRemove: undefined, onCreate: undefined } }
