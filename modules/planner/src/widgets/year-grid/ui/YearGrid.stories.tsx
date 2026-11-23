import { occurrences } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { YearGrid } from './YearGrid'

const year = new Date(fixtureNow).getUTCFullYear()
const items = (of: number) => occurrences(fixturePlan, Date.UTC(of, 0, 1), Date.UTC(of + 1, 0, 1), new Set())

const meta = {
  title: 'Planner/Widgets/YearGrid',
  component: YearGrid,
  args: {
    plan: fixturePlan,
    year,
    items: items(year),
    now: fixtureNow,
    onPickDay: fn(),
    onPickMonth: fn(),
  },
  argTypes: { plan: { control: false }, items: { control: false } },
} satisfies Meta<typeof YearGrid>

export default meta
type Story = StoryObj<typeof meta>

/** The year the plan starts in: the shaded days are study days, deeper for more hours; a dot is an all-day event. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const days = within(canvasElement).getAllByRole('button', { name: /: / })
    await userEvent.click(itemAt(days))
    await expect(args.onPickDay).toHaveBeenCalled()
  },
}

/** The next year, where three courses overlap in the winter. */
export const NextYear: Story = { args: { year: year + 1, items: items(year + 1) } }
