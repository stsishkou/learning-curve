import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { isSession, parseLocal, type PlanChange } from '@lc/plan-domain'
import { fixtureNow, fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { LogDoneDialog } from './LogDoneDialog'

const MINUTE = 60_000
const open = fixturePlan.events.filter((e) => isSession(e) && !e.done && parseLocal(e.start) > fixtureNow).slice(0, 3)
const uids = open.map((e) => e.uid)
const [first] = open
const plannedOf = (start: string, end: string) => (parseLocal(end) - parseLocal(start)) / MINUTE

const meta = {
  title: 'Planner/Features/LogDoneDialog',
  component: LogDoneDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 560 } } },
  args: { plan: fixturePlan, uids, onChange: fn(async (_change: PlanChange) => {}), onClose: fn() },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof LogDoneDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Several sessions marked done at once each get a time: one click per row. A row left without one is marked done
 * without a time, as a choice the dialog counts, and all of it is one step to undo.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const rows = await body.findAllByRole('listitem')
    const [row] = rows
    if (!row || !first) throw new Error('No session to log')
    await userEvent.click(
      within(row).getByRole('button', { name: m.spent_over_plan({ time: fmtDuration(15 * MINUTE) }) }),
    )
    const left = body.getByText(m.log_done_unlogged({ count: uids.length - 1 }))
    await waitFor(() => expect(left).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: m.mark_done() }))
    await expect(args.onChange).toHaveBeenCalledWith({
      type: 'events.done',
      uids,
      done: true,
      actual: { [first.uid]: plannedOf(first.start, first.end) + 15 },
    })
  },
}

/** Nothing to mark: the dialog stays closed. */
export const Closed: Story = { args: { uids: [] } }
