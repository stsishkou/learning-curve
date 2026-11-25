import { m } from '@lc/i18n/messages'
import { MIN_LOGGED, isSession, parseLocal, type Plan } from '@lc/plan-domain'
import { fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, waitFor, within } from 'storybook/test'

import { BiasTrend } from './BiasTrend'

const MINUTE = 60_000
const SPREAD = [1.25, 1, 1.5, 0.75, 1.25, 1.25, 2, 1, 1.5, 0.9, 1.25, 1.1, 1.75, 1.25]

/** Real ÷ planned of the i-th session of each course: one settles, one drifts, one runs short, one stays noisy. */
const RATIOS: Record<string, (i: number) => number> = {
  certs: (i) => itemAt(SPREAD, i % SPREAD.length),
  hfllm: (i) => 1 + i * 0.025 + ((i % 3) - 1) * 0.12,
  hfagents: (i) => itemAt([0.8, 0.9, 0.85, 0.75, 1, 0.8], i % 6),
  pypy: (i) => itemAt([1, 1.6, 0.7, 1.3, 0.9, 1.8, 0.8], i % 7),
}

/** The fixture with every session that ends before `until` done and logged at its course's ratio. */
function loggedUntil(until: string): Plan {
  const end = parseLocal(until)
  const seen = new Map<string, number>()
  return {
    ...fixturePlan,
    events: fixturePlan.events.map((e) => {
      if (!isSession(e) || parseLocal(e.end) > end) return e
      const i = seen.get(e.calendar) ?? 0
      seen.set(e.calendar, i + 1)
      const ratio = RATIOS[e.calendar]?.(i) ?? 1
      return { ...e, done: true, actual: Math.round(((parseLocal(e.end) - parseLocal(e.start)) / MINUTE) * ratio) }
    }),
  }
}

const nameOf = (id: string) => fixturePlan.calendars.find((calendar) => calendar.id === id)?.name ?? id
/** The accessible name of a course's chart starts with the course. */
const chartOf = (id: string) => ({ name: (name: string) => name.startsWith(`${nameOf(id)}: `) })

const meta = {
  title: 'Dashboard/Widgets/BiasTrend',
  component: BiasTrend,
  args: { plan: loggedUntil('2027-02-15T00:00') },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof BiasTrend>

export default meta
type Story = StoryObj<typeof meta>

/**
 * One panel per course on shared axes: the line is the typical session after each logged one, the band its 95%
 * interval. Moving along a panel reads the value at that session.
 */
export const Settling: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const chart = await canvas.findByRole('img', chartOf('certs'))
    const { x, width } = chart.getBoundingClientRect()
    await fireEvent.pointerMove(chart, { clientX: x + width / 2 })
    await waitFor(() => expect(canvas.getByText((text) => text.startsWith(`${nameOf('certs')} · n `))).toBeVisible())
  },
}

/** A course with fewer logged sessions than the line needs says how many are left instead of drawing a guess. */
export const OneStillWaiting: Story = {
  args: { plan: loggedUntil('2027-01-15T00:00') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(m.dash_trend_wait({ min: MIN_LOGGED, left: 2 }))).toBeVisible()
    await expect(await canvas.findByRole('img', chartOf('certs'))).toBeVisible()
  },
}

/** Nothing logged yet: no empty axes, a line that says when one will appear. */
export const NothingLogged: Story = {
  args: { plan: fixturePlan },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(m.dash_trend_none({ min: MIN_LOGGED }))).toBeVisible()
  },
}
