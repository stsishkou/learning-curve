import { countsToBudget, DAY, durationHours, occurrences } from '@lc/plan-domain'
import { fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { BudgetLine } from './BudgetLine'

const week = occurrences(fixturePlan, fixtureWeek, fixtureWeek + 7 * DAY, new Set())
const doneHours = week.filter((o) => countsToBudget(o) && o.done).reduce((sum, o) => sum + durationHours(o), 0)

const meta = {
  title: 'Planner/Widgets/BudgetLine',
  component: BudgetLine,
  args: { plan: fixturePlan, weekItems: week },
  argTypes: { plan: { control: false }, weekItems: { control: false } },
} satisfies Meta<typeof BudgetLine>

export default meta
type Story = StoryObj<typeof meta>

/** The week of the fixture, partly done: the green part of the bar is what is done, the grey what is planned. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(doneHours).toBeGreaterThan(0)
    await expect(within(canvasElement).getByText(/done|сделано/)).toBeInTheDocument()
  },
}

export const EmptyWeek: Story = { args: { weekItems: [] } }
