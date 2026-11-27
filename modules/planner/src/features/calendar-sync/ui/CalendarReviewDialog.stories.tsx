import { m } from '@lc/i18n/messages'
import { isSession, skipDay, type PlanChange } from '@lc/plan-domain'
import { fixturePlan, itemAt } from '@lc/plan-domain/fixtures'
import { googleEventId } from '@lc/plan-domain/sync'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import type { HeldEdit } from '../model/source'
import { CalendarReviewDialog } from './CalendarReviewDialog'

const sessions = fixturePlan.events.filter((e) => isSession(e) && !e.done)
const [ticked, moved, deleted] = [itemAt(sessions), itemAt(sessions, 1), itemAt(sessions, 2)]
const repeat = itemAt(fixturePlan.events.filter((e) => e.rrule))
const day = moved.start.slice(0, 10)

const item = (uid: string, change: PlanChange | null, extra: Partial<HeldEdit> = {}): HeldEdit => ({
  id: `${uid}-${change?.type ?? 'deleted'}`,
  provider: 'google',
  uid,
  source: googleEventId(uid),
  change,
  etag: '"1"',
  basis: 'b',
  ...extra,
})

const items: HeldEdit[] = [
  item(ticked.uid, { type: 'events.done', uids: [ticked.uid], done: true }, { hold: 'both' }),
  item(
    moved.uid,
    { type: 'event.patch', uid: moved.uid, patch: { start: `${day}T06:00`, end: `${day}T07:00` } },
    { hold: 'both', provider: 'outlook' },
  ),
  item(deleted.uid, null, { provider: 'outlook' }),
  item(repeat.uid, skipDay(repeat, repeat.start.slice(0, 10)), { day: repeat.start.slice(0, 10) }),
]

const meta = {
  title: 'Planner/Features/CalendarReviewDialog',
  component: CalendarReviewDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 560 } } },
  args: {
    open: true,
    plan: fixturePlan,
    items,
    working: false,
    error: '',
    onAccept: fn(),
    onKeep: fn(),
    onClose: fn(),
  },
  argTypes: { plan: { control: false }, items: { control: false } },
} satisfies Meta<typeof CalendarReviewDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Edits from Google and Outlook that waited for a decision: a ✓ and a move to sessions the planner changed too, a
 * deletion and a skipped repeat, each with what using the app's version would change.
 */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const rows = body.getAllByRole('listitem')
    await expect(rows).toHaveLength(4)
    await waitFor(() => expect(within(itemAt(rows)).getByText(m.diff_done())).toBeVisible())
    await expect(within(itemAt(rows)).getByText(m.sync_both())).toBeVisible()
    await expect(within(itemAt(rows, 2)).getByText(m.sync_deleted({ app: m.sync_app_outlook() }))).toBeVisible()
    await expect(
      within(itemAt(rows, 1)).getByRole('button', { name: m.sync_accept({ app: m.sync_app_outlook() }) }),
    ).toBeVisible()
    await userEvent.click(within(itemAt(rows, 1)).getByRole('button', { name: m.sync_keep() }))
    await expect(args.onKeep).toHaveBeenCalledWith([itemAt(items, 1).id])
    await userEvent.click(body.getByRole('button', { name: m.sync_accept_all() }))
    await expect(args.onAccept).toHaveBeenCalledWith(items.map((i) => i.id))
  },
}

/** A decision that did not go through: the reason shows under the list, and every row can be tried again. */
export const Failed: Story = { args: { error: 'Outlook answered 500' } }
