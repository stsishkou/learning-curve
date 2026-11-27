import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import { planStats } from '@lc/plan-domain/insights'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { WeeklyLoad } from './WeeklyLoad'

const stats = planStats(fixturePlan, fixtureNow)

const meta = {
  title: 'Dashboard/Widgets/WeeklyLoad',
  component: WeeklyLoad,
  args: { plan: fixturePlan, stats, now: fixtureNow },
  argTypes: { plan: { control: false }, stats: { control: false } },
} satisfies Meta<typeof WeeklyLoad>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
