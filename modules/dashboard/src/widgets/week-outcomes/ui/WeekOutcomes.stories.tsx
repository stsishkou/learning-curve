import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { WeekOutcomes } from './WeekOutcomes'

const meta = {
  title: 'Dashboard/Widgets/WeekOutcomes',
  component: WeekOutcomes,
  args: { plan: fixturePlan, now: fixtureNow },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof WeekOutcomes>

export default meta
type Story = StoryObj<typeof meta>

/** The weeks up to the fixture's "now", none of them reviewed: their numbers are the plan's as it stands. */
export const Default: Story = {}
