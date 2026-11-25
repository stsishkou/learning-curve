import { fmtShort } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { MIN_LOGGED, doneWithoutTime, finishRange, isSession, parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { PaceForecast } from './PaceForecast'

/** The fixture with a time logged on the first `count` done sessions (all by default): `ratio` times their plan. */
const logged = (ratio: number, count = Infinity): Plan => {
  let left = count
  return {
    ...fixturePlan,
    events: fixturePlan.events.map((e) => {
      if (!e.done || !isSession(e) || left-- <= 0) return e
      return { ...e, actual: Math.round(((parseLocal(e.end) - parseLocal(e.start)) / 60_000) * ratio) }
    }),
  }
}

/** The fixture with a time logged on every done session, its ratio to the plan taken from `ratios` in turn. */
const loggedAt = (ratios: number[]): Plan => {
  let i = 0
  return {
    ...fixturePlan,
    events: fixturePlan.events.map((e) => {
      if (!e.done || !isSession(e)) return e
      const ratio = ratios[i++ % ratios.length] ?? 1
      return { ...e, actual: Math.round(((parseLocal(e.end) - parseLocal(e.start)) / 60_000) * ratio) }
    }),
  }
}

/** Text as the page reads: Testing Library turns a no-break space into a plain one. */
const asRead = (text: string) => text.replaceAll('\u00a0', ' ')

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

/**
 * Done sessions without a time are counted above the table, and a host that can open them offers to fill them in:
 * the dashboard is read-only, so the planner opens the list.
 */
export const FillTimes: Story = {
  args: { onFillTimes: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const count = fixturePlan.events.filter(doneWithoutTime).length
    await expect(canvas.getByText(m.unlogged_bar({ count }))).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: m.unlogged_fill() }))
    await expect(args.onFillTimes).toHaveBeenCalled()
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

/**
 * A few sessions logged, all slow: too few to judge, so the course shows no pace and the forecast keeps to the
 * plan until six are logged.
 */
export const TooFewLogged: Story = {
  args: { plan: logged(2, 3) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(m.dash_pace_wait({ count: MIN_LOGGED }))).toBeVisible()
  },
}

/** Most sessions logged: the pace comes from them, and a second line shows what it would be if the rest took their plan. */
export const PartlyLogged: Story = { args: { plan: logged(1.5, 8) } }

/**
 * Logged times that vary: under each forecast a range says by when half and nine in ten of the simulated futures
 * are done. A course with too few logged sessions of its own draws from those of every course, and says so.
 */
export const WithRange: Story = {
  args: { plan: loggedAt([1, 1.5, 0.75, 2, 1.25]) },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const lines = fixturePlan.calendars.flatMap((calendar) => {
      const range = finishRange(args.plan, fixtureNow, { calendar: calendar.id })
      if (!range) return []
      const text = m.dash_forecast_range({ likely: fmtShort(range.likely), late: fmtShort(range.late) })
      return [asRead(range.scope === 'all' ? `${text} · ${m.dash_forecast_range_all()}` : text)]
    })
    await expect(lines.length).toBeGreaterThan(1)
    await Promise.all(lines.map((line) => expect(canvas.getByText(line)).toBeVisible()))
  },
}
