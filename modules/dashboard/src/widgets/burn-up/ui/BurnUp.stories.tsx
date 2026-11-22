import { parseLocal, planStats } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { BurnUp } from './BurnUp'

const stats = planStats(fixturePlan, fixtureNow)

const meta = {
  title: 'Dashboard/Widgets/BurnUp',
  component: BurnUp,
  args: { stats, now: fixtureNow },
  argTypes: { stats: { control: false } },
} satisfies Meta<typeof BurnUp>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** With a forecast past the last planned week the time axis runs on to it and a dashed line leads there. */
export const WithForecast: Story = { args: { forecast: parseLocal('2027-04-06T00:00') } }
