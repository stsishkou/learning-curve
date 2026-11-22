import { DAY, mondayOf, occurrences, startOfMonth } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { MonthGrid } from './MonthGrid'

function month(offset: number) {
  const monthStart = startOfMonth(fixtureNow, offset)
  const gridStart = mondayOf(monthStart)
  const weeks = Math.ceil((startOfMonth(monthStart, 1) - gridStart) / (7 * DAY))
  const items = occurrences(fixturePlan, gridStart, gridStart + weeks * 7 * DAY, new Set())
  return { monthStart, gridStart, weeks, items }
}

const meta = {
  title: 'Planner/Widgets/MonthGrid',
  component: MonthGrid,
  args: { plan: fixturePlan, ...month(0), now: fixtureNow, onSelect: fn(), onPickDay: fn(), onMove: fn() },
  argTypes: { plan: { control: false }, items: { control: false } },
} satisfies Meta<typeof MonthGrid>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NextMonth: Story = { args: month(1) }

export const ReadOnly: Story = { args: { onMove: undefined } }
