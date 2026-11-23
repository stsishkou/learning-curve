import { m } from '@lc/i18n/messages'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import type { GoogleSyncStatus } from '../model/source'
import { GoogleSyncDialog } from './GoogleSyncDialog'

const fresh: GoogleSyncStatus = {
  writable: true,
  configured: false,
  connectedAt: null,
  calendars: 0,
  events: 0,
  inbox: [],
  lastRound: null,
  error: null,
}
const connected: GoogleSyncStatus = {
  ...fresh,
  configured: true,
  connectedAt: Date.UTC(2026, 10, 20, 9),
  calendars: 6,
  events: 148,
  lastRound: Date.UTC(2026, 10, 23, 10, 15),
}

const meta = {
  title: 'Planner/Features/GoogleSyncDialog',
  component: GoogleSyncDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 520 } } },
  args: {
    open: true,
    status: fresh,
    connectUrl: '/api/google/connect',
    failed: false,
    working: false,
    error: '',
    onSaveClient: fn(async () => {}),
    onSync: fn(),
    onDisconnect: fn(async () => {}),
    onClose: fn(),
  },
  argTypes: { status: { control: false } },
} satisfies Meta<typeof GoogleSyncDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Nothing set up yet: the person's own OAuth client comes first. */
export const NotSetUp: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.type(body.getByLabelText(m.google_client_id()), 'client.apps.googleusercontent.com')
    await userEvent.type(body.getByLabelText(m.google_client_secret()), 'secret')
    await userEvent.click(body.getByRole('button', { name: m.google_save_client() }))
    await expect(args.onSaveClient).toHaveBeenCalledWith('client.apps.googleusercontent.com', 'secret')
  },
}

/** A client is saved: signing in to Google is one link away. */
export const ReadyToConnect: Story = {
  args: { status: { ...fresh, configured: true } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByRole('link', { name: m.google_connect() })).toHaveAttribute('href', '/api/google/connect')
    await expect(body.queryByLabelText(m.google_client_id())).toBeNull()
  },
}

export const Connected: Story = {
  args: { status: connected },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.google_counts({ calendars: 6, events: 148 }))).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: m.google_sync_now() }))
    await expect(args.onSync).toHaveBeenCalled()
  },
}

/** Google ended the sign-in, as it does every week for an app left in testing. */
export const SignInEnded: Story = {
  args: { status: { ...connected, connectedAt: null, error: 'reconnect' } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.google_reconnect())).toBeVisible())
    await expect(body.getByRole('link', { name: m.google_connect() })).toBeVisible()
  },
}
