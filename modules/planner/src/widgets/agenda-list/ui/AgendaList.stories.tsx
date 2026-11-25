import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, doneWithoutTime, isSession, occurrences, parseLocal, type PlanChange } from '@lc/plan-domain'
import { fixtureNow, fixturePlan, fixtureWeek } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { AgendaList } from './AgendaList'

const meta = {
  title: 'Planner/Widgets/AgendaList',
  component: AgendaList,
  args: {
    plan: fixturePlan,
    items: occurrences(fixturePlan, fixtureWeek - 7 * DAY, fixtureWeek + 21 * DAY, new Set()),
    now: fixtureNow,
    onSelect: fn(),
  },
  argTypes: { plan: { control: false }, items: { control: false } },
} satisfies Meta<typeof AgendaList>

export default meta
type Story = StoryObj<typeof meta>

/** Four weeks around the fixed "now": the list opens scrolled to today's heading. */
export const Default: Story = {}

export const Empty: Story = { args: { items: [] } }

const next = fixturePlan.events.filter((e) => isSession(e) && !e.done && parseLocal(e.start) > fixtureNow).slice(0, 2)

/**
 * Picked sessions marked done in bulk go to the page with their uids, so it can ask how long each took, instead of
 * being stored at once without a time.
 */
export const MarkDoneAsksForTimes: Story = {
  args: { onChanges: fn((_changes: PlanChange[]) => {}), onMarkDone: fn((_uids: string[]) => {}) },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    for (const e of next)
      // oxlint-disable-next-line no-await-in-loop -- a person ticks one box after another
      await userEvent.click(canvas.getByRole('checkbox', { name: m.list_select({ title: e.title }) }))
    await userEvent.click(canvas.getByRole('button', { name: m.bulk_done() }))
    await expect(args.onMarkDone).toHaveBeenCalledWith(next.map((e) => e.uid))
    await expect(args.onChanges).not.toHaveBeenCalled()
  },
}

const firstDone = fixturePlan.events.find((e) => isSession(e) && e.done)
const partlyLogged = {
  ...fixturePlan,
  events: fixturePlan.events.map((e) => (e === firstDone ? { ...e, actual: 75 } : e)),
}
const partlyLoggedItems = occurrences(partlyLogged, fixtureWeek - 7 * DAY, fixtureWeek + 21 * DAY, new Set())

/** A logged time says which way it went from the plan with a glyph, not with colour alone. */
export const TookLongerPointsUp: Story = {
  args: { plan: partlyLogged, items: partlyLoggedItems },
  play: async ({ canvasElement }) => {
    if (!firstDone || parseLocal(firstDone.end) - parseLocal(firstDone.start) >= 75 * 60_000) {
      throw new Error('The first done session must be planned shorter than the 75 minutes it took')
    }
    const took = `${m.grid_took({ time: fmtDuration(75 * 60_000) })} ▲`
    await expect(within(canvasElement).getByText(took)).toBeVisible()
  },
}

/**
 * A done session without a logged time has a hollow tick, and a screen reader hears that its time is not logged; one
 * with a time keeps the plain tick.
 */
export const DoneWithoutTime: Story = {
  args: { plan: partlyLogged, items: partlyLoggedItems },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const unlogged = partlyLoggedItems.filter(doneWithoutTime).length
    await expect(unlogged).toBe(partlyLoggedItems.filter((o) => o.done).length - 1)
    await expect(canvas.getAllByText(m.spent_not_logged())).toHaveLength(unlogged)
  },
}
