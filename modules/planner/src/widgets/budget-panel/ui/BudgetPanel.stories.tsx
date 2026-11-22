import { DAY, mondayOf, occurrences, parseLocal } from '@lc/plan-domain'
import { fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { BudgetPanel } from './BudgetPanel'

const week = (monday: number) => occurrences(fixturePlan, monday, monday + 7 * DAY, new Set())

const meta = {
  title: 'Planner/Widgets/BudgetPanel',
  component: BudgetPanel,
  args: { plan: fixturePlan, weekItems: week(fixtureWeek) },
  argTypes: { plan: { control: false }, weekItems: { control: false } },
  decorators: [
    (Story) => (
      <div className="max-w-[360px] rounded-2xl border border-line bg-surface p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BudgetPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ThreeCourses: Story = { args: { weekItems: week(mondayOf(parseLocal('2027-01-11'))) } }

export const EmptyWeek: Story = { args: { weekItems: [] } }
