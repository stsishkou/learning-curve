import { m } from '@lc/i18n/messages'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import type { CalendarSyncStatus } from '../model/source'
import { IntegrationsDialog } from './IntegrationsDialog'

const google: CalendarSyncStatus = {
  provider: 'google',
  writable: true,
  configured: true,
  connectedAt: Date.UTC(2026, 10, 20, 9),
  calendars: 6,
  events: 148,
  inbox: [],
  lastRound: Date.UTC(2026, 10, 23, 10, 15),
  takenAt: null,
  error: null,
}
const outlook: CalendarSyncStatus = { ...google, provider: 'outlook', configured: false, connectedAt: null }

const meta = {
  title: 'Planner/Features/IntegrationsDialog',
  component: IntegrationsDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 560 } } },
  args: {
    open: true,
    apps: [google, outlook],
    working: () => false,
    busy: { host: null },
    onExport: fn(),
    onApp: fn(),
    onReview: fn(),
    onBusy: fn(),
    onClose: fn(),
  },
  argTypes: { apps: { control: false } },
} satisfies Meta<typeof IntegrationsDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Google kept in sync, Outlook not set up yet; each row opens its own dialog. */
export const Default: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.outlook_calendar())).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: new RegExp(m.outlook_calendar()) }))
    await expect(args.onApp).toHaveBeenCalledWith('outlook')
    await userEvent.click(body.getByRole('button', { name: new RegExp(m.export_to_calendar()) }))
    await expect(args.onExport).toHaveBeenCalled()
  },
}

/** Edits from Outlook wait for a decision and Google needs a new sign-in: both rows say so. */
export const NeedsAttention: Story = {
  args: {
    apps: [
      { ...google, connectedAt: null, error: 'reconnect' },
      {
        ...outlook,
        configured: true,
        connectedAt: google.connectedAt,
        inbox: [{ id: 'a', uid: 'a', source: 'a', change: null, etag: '"1"', basis: 'b' }],
      },
    ],
  },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.integrations_waiting({ count: 1 }))).toBeVisible())
    await expect(body.getByText(m.integrations_attention())).toBeVisible()
    await userEvent.click(body.getByRole('button', { name: new RegExp(m.sync_review()) }))
    await expect(args.onReview).toHaveBeenCalled()
  },
}

/** Where the plan cannot change, only what goes one way is offered. */
export const ReadOnly: Story = { args: { apps: [], busy: undefined } }
