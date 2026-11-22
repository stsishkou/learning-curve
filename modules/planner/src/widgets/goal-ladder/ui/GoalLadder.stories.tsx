import { mondayOf, parseLocal } from '@lc/plan-domain'
import { fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { GoalLadder } from './GoalLadder'

const meta = {
  title: 'Planner/Widgets/GoalLadder',
  component: GoalLadder,
  args: { plan: fixturePlan, weekStart: fixtureWeek, onReview: fn() },
  argTypes: { plan: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[360px] rounded-2xl border border-line bg-surface p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GoalLadder>

export default meta
type Story = StoryObj<typeof meta>

/** The fixture's week: the modules finished before the fixed "now" are ticked, the rest show their sessions. */
export const Default: Story = {}

/** A week in January, when three courses run side by side and one of them ends that month. */
export const ThreeCourses: Story = { args: { weekStart: mondayOf(parseLocal('2027-01-11')) } }

/** A week after the plan: no module ends in it and the month asks nothing. */
export const NoGoals: Story = { args: { weekStart: mondayOf(parseLocal('2027-06-07')) } }
