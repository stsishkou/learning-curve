import { fmtDay } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { deadlineOf, parseLocal, type Plan, type PlanEvent } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

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

const certsDay = deadlineOf(fixturePlan, 'certs') ?? ''
const hfllmName = fixturePlan.calendars.find((c) => c.id === 'hfllm')?.name ?? ''
const counting = (plan: Plan, calendar: string): Plan => ({ ...plan, meta: { ...plan.meta, countdown: calendar } })
const hfllmDeadline: PlanEvent = {
  uid: 'hfllm-deadline',
  calendar: 'hfllm',
  title: 'Дедлайн: LLM Course',
  start: '2027-02-15T00:00',
  end: '2027-02-15T00:00',
  allDay: true,
  kind: 'milestone',
  availability: 'free',
  description: '',
}

/** The bar names the course and the day it counts to; Set up opens the settings of the countdown. */
export const NamesItsCourseAndDay: Story = {
  args: { onConfigure: fn() },
  play: async ({ args, canvasElement }) => {
    const bar = within(within(canvasElement).getByRole('region', { name: m.runway_label({ name: 'Gemini Certs' }) }))
    await expect(bar.getByText(`Gemini Certs · ${fmtDay(parseLocal(`${certsDay}T00:00`))}`)).toBeVisible()
    await userEvent.click(bar.getByRole('button', { name: m.countdown_edit() }))
    await expect(args.onConfigure).toHaveBeenCalled()
  },
}

/** A course chosen in the settings is followed, though the certificates' deadline comes first. */
export const FollowsTheChosenCourse: Story = {
  args: { plan: counting({ ...fixturePlan, events: [...fixturePlan.events, hfllmDeadline] }, 'hfllm') },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('region', { name: m.runway_label({ name: hfllmName }) })).toBeVisible()
  },
}

/** The chosen course has no deadline yet: the bar says so and offers to set one. */
export const ChosenCourseWithoutADeadline: Story = {
  args: { plan: counting(fixturePlan, 'hfllm'), onConfigure: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(m.countdown_no_deadline({ name: hfllmName }))).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: m.countdown_set() }))
    await expect(args.onConfigure).toHaveBeenCalled()
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

/** A plan without any deadline has no strip where it cannot be changed. */
export const NoDeadline: Story = {
  args: { plan: noDeadline },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('section')).toBeNull()
  },
}

/** Where the plan can be changed, a plan with nothing to count to offers to set a deadline instead of hiding the bar. */
export const NoDeadlineToCountTo: Story = {
  args: { plan: noDeadline, onConfigure: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(m.countdown_empty())).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: m.countdown_set() }))
    await expect(args.onConfigure).toHaveBeenCalled()
  },
}

const reserveInside = async (canvasElement: HTMLElement) => {
  const strip = within(canvasElement).getByRole('region')
  const inner = strip.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(strip).paddingRight)
  const reserve = within(strip).getByText(m.reserve())
  await expect(reserve.getBoundingClientRect().right).toBeLessThanOrEqual(inner)
}

// Three spare days after the last session, as in a plan with little room left.
const shortReserve: Plan = {
  ...fixturePlan,
  events: fixturePlan.events.map((e) =>
    e.uid === 'certs-041@learning-curve' ? { ...e, start: '2026-12-26T00:00', end: '2026-12-26T00:00' } : e,
  ),
}

/** A short reserve sits at the very end of the strip: its label, dates and all, stays inside the card. */
export const ShortReserveStaysInside: Story = {
  globals: { viewport: { value: 'desktop', isRotated: false } },
  args: { plan: shortReserve },
  play: async ({ canvasElement }) => reserveInside(canvasElement),
}

/** On a phone too, where the strip is short and the reserve a sliver at its end. */
export const ShortReserveStaysInsideOnAPhone: Story = {
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  args: { plan: shortReserve },
  play: async ({ canvasElement }) => reserveInside(canvasElement),
}
