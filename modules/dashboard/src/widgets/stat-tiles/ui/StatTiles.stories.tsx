import { m } from '@lc/i18n/messages'
import type { Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import { paceForecast, planStats } from '@lc/plan-domain/insights'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { StatTiles } from './StatTiles'

const stats = planStats(fixturePlan, fixtureNow)

const meta = {
  title: 'Dashboard/Widgets/StatTiles',
  component: StatTiles,
  args: { plan: fixturePlan, stats, now: fixtureNow, forecast: paceForecast(fixturePlan, fixtureNow).finish },
  argTypes: { plan: { control: false }, stats: { control: false } },
} satisfies Meta<typeof StatTiles>

export default meta
type Story = StoryObj<typeof meta>

/** The fixture's Wednesday, 2 December: 28 days to the certificates' deadline. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(m.dash_days({ count: 28 }))).toBeVisible()
  },
}

const noDeadline: Plan = { ...fixturePlan, events: fixturePlan.events.filter((e) => e.kind !== 'milestone') }

/** Without a deadline the last tile has no count. */
export const NoDeadline: Story = {
  args: { plan: noDeadline },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(m.dash_days({ count: 28 }))).toBeNull()
    await expect(within(canvasElement).getByText('—')).toBeVisible()
  },
}

/** The clock is not known yet, as on the server. */
export const BeforeTheClock: Story = { args: { now: null } }
