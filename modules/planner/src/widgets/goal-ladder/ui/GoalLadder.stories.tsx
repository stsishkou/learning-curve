import { fmtDay } from '@lc/i18n/format'
import { mondayOf, parseLocal, type Plan } from '@lc/plan-domain'
import { fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

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
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const deadline = fmtDay(parseLocal('2026-12-30T00:00'))
    await expect(within(canvasElement).getByText(new RegExp(`${deadline}.*Gemini Certs`))).toBeVisible()
  },
}

const noDeadline: Plan = { ...fixturePlan, events: fixturePlan.events.filter((e) => e.kind !== 'milestone') }

/** Without a deadline the ladder has no last line. */
export const NoDeadline: Story = {
  args: { plan: noDeadline },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/%/)).toBeNull()
  },
}

/** A week in January, when three courses run side by side and one of them ends that month. */
export const ThreeCourses: Story = { args: { weekStart: mondayOf(parseLocal('2027-01-11')) } }

/** A week after the plan: no module ends in it and the month asks nothing. */
export const NoGoals: Story = { args: { weekStart: mondayOf(parseLocal('2027-06-07')) } }
