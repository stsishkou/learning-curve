import { planStats } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { BurnUp } from './BurnUp'

const stats = planStats(fixturePlan, fixtureNow)

const meta = {
  title: 'Dashboard/Widgets/BurnUp',
  component: BurnUp,
  args: { stats, now: fixtureNow },
} satisfies Meta<typeof BurnUp>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
