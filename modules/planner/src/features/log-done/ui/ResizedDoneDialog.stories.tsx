import { fmtDuration } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import { DAY, hm, isSession, moveOccurrence, occurrences, type PlanChange } from '@lc/plan-domain'
import { fixturePlan, fixtureWeek, itemAt } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { ResizedDoneDialog } from './ResizedDoneDialog'

const MINUTE = 60_000
const done = itemAt(
  occurrences(fixturePlan, fixtureWeek, fixtureWeek + 7 * DAY, new Set()).filter((o) => isSession(o) && o.done),
)
const slot = { s: done.s, e: done.e + 30 * MINUTE }
const longer = (done.e - done.s) / MINUTE + 30

const meta = {
  title: 'Planner/Features/ResizedDoneDialog',
  component: ResizedDoneDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 420 } } },
  args: { resized: { event: done, slot }, onChange: fn(async (_change: PlanChange) => {}), onClose: fn() },
  argTypes: { resized: { control: false } },
} satisfies Meta<typeof ResizedDoneDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * A done session made longer in the grid: the new length is most likely how long it took, so logging that is the
 * first choice and has the focus. The plan changes only when that is picked.
 */
export const LogsTheTime: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const took = await body.findByRole('button', { name: m.resize_done_time({ time: fmtDuration(longer * MINUTE) }) })
    await waitFor(() => expect(took).toHaveFocus())
    await userEvent.click(took)
    await expect(args.onChange).toHaveBeenCalledWith({ type: 'event.patch', uid: done.uid, patch: { actual: longer } })
    await expect(args.onClose).toHaveBeenCalled()
  },
}

/** The other choice moves the session's edges, as a resize of a session that is not done does. */
export const ChangesThePlan: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      await body.findByRole('button', { name: m.resize_done_plan({ slot: `${hm(slot.s)}–${hm(slot.e)}` }) }),
    )
    await expect(args.onChange).toHaveBeenCalledWith(moveOccurrence(done, slot))
  },
}

/** Nothing was resized: the dialog stays closed. */
export const Closed: Story = { args: { resized: null } }
