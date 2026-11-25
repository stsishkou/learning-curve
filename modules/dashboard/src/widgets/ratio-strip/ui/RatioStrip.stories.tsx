import { m } from '@lc/i18n/messages'
import { MIN_LOGGED, isSession, parseLocal, type Plan } from '@lc/plan-domain'
import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { RatioStrip } from './RatioStrip'

/** The fixture with the first `count` done sessions logged, the i-th at `ratios[i % length]` times its plan. */
const logged = (ratios: number[], count = Infinity): Plan => {
  let i = 0
  return {
    ...fixturePlan,
    events: fixturePlan.events.map((e) => {
      if (!e.done || !isSession(e) || i >= count) return e
      const ratio = ratios[i++ % ratios.length] ?? 1
      return { ...e, actual: Math.round(((parseLocal(e.end) - parseLocal(e.start)) / 60_000) * ratio) }
    }),
  }
}

const SPREAD = [1.25, 1, 1.5, 0.75, 1.25, 1.25, 2, 1, 1.5, 0.9, 1.25, 1.1, 1.75, 1.25]

const meta = {
  title: 'Dashboard/Widgets/RatioStrip',
  component: RatioStrip,
  args: { plan: logged(SPREAD) },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof RatioStrip>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Every logged session is a mark on a log axis: right of the line of the plan it took longer. A lab is a triangle.
 * The course has enough logged sessions for its typical session, the diamond, with its 95% interval. Hovering a mark
 * names its session.
 */
export const Logged: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // The table under the chart repeats each label: the first is the chart's.
    const [label] = canvas.getAllByText(/^n \d+ · .*×/)
    await expect(label).toBeVisible()
    const mark = canvasElement.querySelector('[data-mark]')
    if (!mark) throw new Error('No mark to hover')
    const uid = mark.getAttribute('data-mark')
    const title = fixturePlan.events.find((e) => e.uid === uid)?.title ?? ''
    await userEvent.hover(mark)
    await waitFor(() => expect(canvas.getAllByText(title).length).toBeGreaterThan(1))
  },
}

/** Fewer logged sessions than a summary needs: the marks are there, the typical session is not. */
export const FewLogged: Story = {
  args: { plan: logged(SPREAD, MIN_LOGGED - 2) },
  play: async ({ canvasElement }) => {
    const wait = m.dash_strip_n_wait({ count: MIN_LOGGED - 2, min: MIN_LOGGED })
    const [label] = within(canvasElement).getAllByText(wait)
    await expect(label).toBeVisible()
  },
}

/** Nothing logged yet: no empty chart, a line that says what will appear. */
export const NothingLogged: Story = {
  args: { plan: fixturePlan },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(m.dash_strip_none())).toBeVisible()
  },
}
