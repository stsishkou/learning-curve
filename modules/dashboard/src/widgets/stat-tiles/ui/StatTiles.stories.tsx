import { planStats } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatTiles } from './StatTiles'

const stats = planStats(fixturePlan, fixtureNow)

const meta = {
  title: 'Dashboard/Widgets/StatTiles',
  component: StatTiles,
  args: { plan: fixturePlan, stats, now: fixtureNow },
  argTypes: { plan: { control: false }, stats: { control: false } },
} satisfies Meta<typeof StatTiles>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** The clock is not known yet, as on the server. */
export const BeforeTheClock: Story = { args: { now: null } }
