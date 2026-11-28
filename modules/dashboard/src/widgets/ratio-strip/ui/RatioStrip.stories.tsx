import { fmtDay, fmtDuration, fmtRatio } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { MIN_LOGGED, isSession, parseLocal, toLocalString, type Plan, type PlanEvent } from '@lc/plan-domain'
import { fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
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

const MINUTE = 60_000
const certs = fixturePlan.events.filter((e) => e.calendar === 'certs' && isSession(e))
const certsName = fixturePlan.calendars.find((c) => c.id === 'certs')?.name ?? ''
/** 2026-11-23 12:00–13:00, done */
const root = itemAt(certs)
/** 2026-11-23 13:00–14:00, done */
const cut = itemAt(certs, 1)

/** A sitting added to continue the root, `minutes` long from `start` */
const sitting = (uid: string, start: string, minutes: number, fields: Partial<PlanEvent>): PlanEvent => ({
  ...root,
  uid,
  start,
  end: toLocalString(parseLocal(start) + minutes * MINUTE),
  from: root.uid,
  ...fields,
})
const SITTINGS = [
  sitting('sitting-2@learning-curve', '2026-11-24T18:00', 30, { done: true, actual: 20, unfinished: true }),
  sitting('sitting-3@learning-curve', '2026-11-25T18:00', 15, { done: true, actual: 15 }),
]

/** The logged fixture with the root done in 25 minutes and continued in two sittings, and the next one cut short. */
const spread = (): Plan => {
  const plan = logged(SPREAD)
  const shortened = { actual: 25, unfinished: true }
  return {
    ...plan,
    events: [
      ...plan.events.map((e) => (e.uid === root.uid || e.uid === cut.uid ? { ...e, ...shortened } : e)),
      ...SITTINGS,
    ],
  }
}

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
    const [label] = await canvas.findAllByText(/^n \d+ · .*×/)
    await expect(label).toBeVisible()
    // The marks are drawn once the row is measured, after its label.
    const [row] = await canvas.findAllByRole('img')
    const mark = row?.querySelector('[data-mark]')
    if (!mark) throw new Error('No mark to hover')
    const uid = mark.getAttribute('data-mark')
    const title = fixturePlan.events.find((e) => e.uid === uid)?.title ?? ''
    await userEvent.hover(mark)
    await waitFor(() => expect(canvas.getAllByText(title).length).toBeGreaterThan(1))
  },
}

/** From the keyboard: Tab to a course's row, and the arrows, Home and End move from mark to mark, left to right. */
export const Keyboard: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const marks = args.plan.events
      .filter((e) => e.calendar === 'certs' && e.actual !== undefined)
      .map((e) => ({ title: e.title, ratio: (e.actual ?? 0) / ((parseLocal(e.end) - parseLocal(e.start)) / 60_000) }))
      .toSorted((a, b) => a.ratio - b.ratio)
    const name = fixturePlan.calendars.find((c) => c.id === 'certs')?.name ?? ''
    const row = await canvas.findByRole('img', { name: (label: string) => label.startsWith(`${name}: `) })
    row.focus()
    // The table under the chart lists every title once: the readout makes it twice.
    const shown = (title: string) => expect(canvas.getAllByText(title)).toHaveLength(2)
    await waitFor(() => shown(marks.at(0)?.title ?? ''))
    await userEvent.keyboard('{End}')
    await shown(marks.at(-1)?.title ?? '')
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

/**
 * A session spread over sittings is one mark, its time over its first plan at its latest sitting's day: 25 + 20 + 15
 * minutes of a 60-minute session read ×1, not as three fast sessions. A session cut short and not finished has none.
 */
export const SpreadSession: Story = {
  args: { plan: spread() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const row = await canvas.findByRole('img', { name: (label: string) => label.startsWith(`${certsName}: `) })
    const uids = [root.uid, cut.uid, ...SITTINGS.map((e) => e.uid)]
    await expect(uids.filter((uid) => row.querySelector(`[data-mark="${uid}"]`))).toEqual([root.uid])
    // The table under the chart: one line for the session, none for the one cut short.
    const [title, ...more] = canvas.getAllByText(root.title)
    await expect(more).toHaveLength(0)
    const cells = [...(title?.closest('tr')?.querySelectorAll('td') ?? [])].map((td) => td.textContent)
    await expect(cells).toEqual([
      root.title,
      fmtDay(parseLocal('2026-11-25T18:00')),
      fmtDuration(60 * MINUTE),
      fmtDuration(60 * MINUTE),
      fmtRatio(1),
    ])
    await expect(canvas.queryAllByText(cut.title)).toHaveLength(0)
  },
}
