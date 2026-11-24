import { m } from '@lc/i18n/messages'
import { parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { Runway } from './Runway'

const meta = {
  title: 'Planner/Widgets/Runway',
  component: Runway,
  args: { plan: fixturePlan, now: fixtureNow, onSelect: fn() },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof Runway>

export default meta
type Story = StoryObj<typeof meta>

/** The way to the nearest deadline, the certificates' one, and the calendar that has it. */
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('region', { name: m.runway_label({ name: 'Gemini Certs' }) }),
    ).toBeVisible()
  },
}

/** The "today" marker close to the deadline. */
export const LastWeek: Story = { args: { now: parseLocal('2026-12-28T10:00') } }

/** Past the last deadline there is no way left to show: the strip steps aside. */
export const AfterTheDeadline: Story = {
  args: { now: parseLocal('2027-01-12T10:00') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull()
  },
}

const noDeadline: Plan = { ...fixturePlan, events: fixturePlan.events.filter((e) => e.kind !== 'milestone') }

/** A plan without any deadline has no strip. */
export const NoDeadline: Story = {
  args: { plan: noDeadline },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull()
  },
}
