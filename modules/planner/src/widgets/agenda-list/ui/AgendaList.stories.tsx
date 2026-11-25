import { m } from '@lc/i18n/messages'
import { DAY, isSession, occurrences, parseLocal, type PlanChange } from '@lc/plan-domain'
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
      await userEvent.click(canvas.getByRole('checkbox', { name: m.list_select({ title: e.title }) }))
    await userEvent.click(canvas.getByRole('button', { name: m.bulk_done() }))
    await expect(args.onMarkDone).toHaveBeenCalledWith(next.map((e) => e.uid))
    await expect(args.onChanges).not.toHaveBeenCalled()
  },
}
