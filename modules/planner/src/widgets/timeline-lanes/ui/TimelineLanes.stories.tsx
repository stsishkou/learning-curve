import { m } from '@lc/i18n/messages'
import { isSession, parseLocal, type Plan } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { TimelineLanes } from './TimelineLanes'

const NONE: ReadonlySet<string> = new Set()
const COURSES = ['Gemini Certs', 'Hugging Face: LLM Course', 'Hugging Face: AI Agents Course', 'Practical Python']

const meta = {
  title: 'Planner/Widgets/TimelineLanes',
  component: TimelineLanes,
  args: { plan: fixturePlan, hidden: NONE, now: fixtureNow, position: 'below', onPosition: fn() },
  argTypes: { plan: { control: false }, hidden: { control: false } },
} satisfies Meta<typeof TimelineLanes>

export default meta
type Story = StoryObj<typeof meta>

const strip = (canvasElement: HTMLElement) => within(canvasElement).getByRole('region', { name: m.timeline() })

/** Every course with something ahead, in its colour, with how much of it is done, its deadline and today. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const region = within(strip(canvasElement))
    await expect(COURSES.filter((name) => region.queryByText(name) === null)).toEqual([])
    await expect(region.getByText('14/40')).toBeVisible()
    await expect(canvasElement.querySelectorAll('[data-today]').length).toBe(COURSES.length)
    await expect(canvasElement.querySelectorAll('[data-deadline]').length).toBe(1)

    const page = within(canvasElement.ownerDocument.body)
    await userEvent.click(region.getByRole('button', { name: m.timeline_position() }))
    await userEvent.click(await page.findByRole('menuitemcheckbox', { name: m.timeline_above() }))
    await expect(args.onPosition).toHaveBeenCalledWith('above')
    await userEvent.click(page.getByRole('menuitem', { name: m.timeline_hide() }))
    await expect(args.onPosition).toHaveBeenLastCalledWith('hidden')
  },
}

/** A calendar switched off in the filter has no lane either. */
export const HiddenCalendar: Story = {
  args: { hidden: new Set(['pypy']) },
  play: async ({ canvasElement }) => {
    await expect(within(strip(canvasElement)).queryByText('Practical Python')).toBeNull()
  },
}

const certs = fixturePlan.events
  .filter((e) => e.calendar === 'certs' && isSession(e))
  .toSorted((a, b) => a.start.localeCompare(b.start))
const forgotten = itemAt(certs, 0)
const withMissed: Plan = {
  ...fixturePlan,
  events: fixturePlan.events.map((e) => (e.uid === forgotten.uid ? { ...e, done: false } : e)),
}

/** A past session that was never marked done stands out on its lane. */
export const MissedSession: Story = {
  args: { plan: withMissed },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-state="missed"]').length).toBe(1)
  },
}

/** Before the clock is known, as on the server, the lanes are drawn without a today line. */
export const BeforeTheClock: Story = {
  args: { now: null },
  play: async ({ canvasElement }) => {
    await expect(within(strip(canvasElement)).getByText('Gemini Certs')).toBeVisible()
    await expect(canvasElement.querySelector('[data-today]')).toBeNull()
  },
}

/** Three weeks on, the certificates began before the drawn days: their bar is cut at the start and fades there. */
export const CutAtTheStart: Story = {
  args: { now: parseLocal('2026-12-21T10:00') },
  play: async ({ canvasElement }) => {
    const cut = canvasElement.querySelector<HTMLElement>('[data-cut="start"]')
    await expect(cut).not.toBeNull()
    await expect(cut?.style.left).toBe('0%')
  },
}

/** A narrow screen: the names stand above their lanes and nothing scrolls sideways. */
export const Narrow: Story = {
  decorators: [(Story) => <div className="w-[320px]">{Story()}</div>],
  play: async ({ canvasElement }) => {
    const region = strip(canvasElement)
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth)
  },
}

/** With every calendar switched off there is nothing to draw: the strip steps aside. */
export const NoLanes: Story = {
  args: { hidden: new Set(fixturePlan.calendars.map((c) => c.id)) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull()
  },
}
