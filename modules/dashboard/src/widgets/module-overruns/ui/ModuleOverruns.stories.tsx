import { fmtRatio } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, isSession, moduleOverruns, parseLocal, toLocalString, type Plan, type PlanEvent } from '@lc/plan-domain'
import { fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'

import { ModuleOverruns } from './ModuleOverruns'

const RATIOS = [1.25, 1, 1.5, 0.75, 1.25, 2, 1, 0.9]
const minutesOf = (e: PlanEvent) => (parseLocal(e.end) - parseLocal(e.start)) / 60_000
const later = (time: string) => toLocalString(parseLocal(time) + 7 * DAY)
/** The text as a matcher reads it: Testing Library turns the DOM's no-break spaces into plain ones. */
const asRead = (text: string) => text.replaceAll('\u00a0', ' ')

/**
 * The fixture with every done session logged at one of `RATIOS`, one module given an extra session and one whose only
 * session ran out of time.
 */
function logged(): Plan {
  let i = 0
  const events = fixturePlan.events.map((e) =>
    e.done && isSession(e) ? { ...e, actual: Math.round(minutesOf(e) * itemAt(RATIOS, i++ % RATIOS.length)) } : e,
  )
  const done = events.filter((e) => e.done && isSession(e) && e.kind === 'study')
  const grown = itemAt(done)
  const cut = itemAt(done.filter((e) => e.title !== grown.title && !/\(\d+\/\d+\)$/.test(e.title)))
  const extra = { ...grown, uid: 'custom-extra@learning-curve', start: later(grown.start), end: later(grown.end) }
  return {
    ...fixturePlan,
    events: [...events.map((e) => (e.uid === cut.uid ? { ...e, unfinished: true } : e)), { ...extra, actual: 45 }],
  }
}

const meta = {
  title: 'Dashboard/Widgets/ModuleOverruns',
  component: ModuleOverruns,
  args: { plan: logged() },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof ModuleOverruns>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Collapsed until opened. Modules whose every session is logged come first, the longest overrun on top; the others
 * follow with the reason they have no ratio yet. An added session is counted apart.
 */
export const Ranked: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText(m.dash_modules_title()))
    const [top] = moduleOverruns(args.plan)
    if (!top?.ratio) throw new Error('No module with a ratio')
    const first = canvas.getAllByRole('row').find((row) => row.querySelector('th[scope="row"]'))
    await expect(first).toHaveTextContent(top.title)
    await expect(first).toHaveTextContent(asRead(fmtRatio(top.ratio)))
    await expect(canvas.getByText(m.dash_modules_waiting())).toBeVisible()
    await expect(canvas.getByText(m.dash_modules_rest())).toBeVisible()
    await expect(canvas.getByText('+1')).toBeVisible()
  },
}

/** Done sessions without a time: no module has a ratio, and each says how many times are missing. */
export const WithoutTimes: Story = {
  args: { plan: fixturePlan },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText(m.dash_modules_title()))
    await expect(canvas.getByText(`· ${m.dash_modules_count({ count: 0 })}`)).toBeVisible()
    await expect(canvas.getAllByText(m.dash_modules_unlogged({ count: 1 })).length).toBeGreaterThan(0)
  },
}

/** Nothing done yet. */
export const NothingDone: Story = {
  args: { plan: { ...fixturePlan, events: fixturePlan.events.map((e) => ({ ...e, done: false })) } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByText(m.dash_modules_title()))
    await expect(canvas.getByText(m.dash_modules_none())).toBeVisible()
  },
}
