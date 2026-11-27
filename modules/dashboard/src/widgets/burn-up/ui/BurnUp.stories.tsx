import { m } from '@lc/i18n/messages'
import { parseLocal } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import { planStats } from '@lc/plan-domain/insights'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

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

/** A finish range as well: a band from the day half of the simulated futures are done to the day nine in ten are. */
export const WithRange: Story = {
  args: {
    forecast: parseLocal('2027-04-06T00:00'),
    range: { likely: parseLocal('2027-04-08T00:00'), late: parseLocal('2027-04-29T00:00'), scope: 'course' },
  },
  play: async ({ canvasElement }) => {
    const label = m.dash_burnup_range().replaceAll('\u00a0', ' ')
    await expect(within(canvasElement).getByText(label)).toBeVisible()
  },
}
