import { isSession, parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { PaceForecast } from './PaceForecast'

/** The fixture with a time logged on every done session: `ratio` times its planned length. */
const logged = (ratio: number): Plan => ({
  ...fixturePlan,
  events: fixturePlan.events.map((e) =>
    e.done && isSession(e)
      ? { ...e, actual: Math.round(((parseLocal(e.end) - parseLocal(e.start)) / 60_000) * ratio) }
      : e,
  ),
})

const meta = {
  title: 'Dashboard/Widgets/PaceForecast',
  component: PaceForecast,
  args: { plan: fixturePlan, now: fixtureNow },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof PaceForecast>

export default meta
type Story = StoryObj<typeof meta>

/** Sessions are done but no time is logged: each counts as planned, so the forecast equals the plan. */
export const NothingLogged: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Gemini Certs.*30/)).toBeVisible()
  },
}

const noDeadline: Plan = { ...fixturePlan, events: fixturePlan.events.filter((e) => e.kind !== 'milestone') }

/** Without a deadline the forecast has no line about one. */
export const NoDeadline: Story = {
  args: { plan: noDeadline },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByText(/Gemini Certs.*30/)).toBeNull()
  },
}

/** Every done session took half as long again: the rest needs more hours than the plan holds, and the finish slips. */
export const SlowerThanPlanned: Story = { args: { plan: logged(1.5) } }

/** Sessions took three quarters of their slot: the work runs out before the last planned day. */
export const FasterThanPlanned: Story = { args: { plan: logged(0.75) } }
