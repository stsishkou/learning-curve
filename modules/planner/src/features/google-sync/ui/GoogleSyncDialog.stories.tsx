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
  takenAt: null,
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
const CALLBACK = '/api/google/callback'
/** The JSON Google offers when a client is made */
const clientFile = (kind: 'web' | 'installed', redirect: string) =>
  JSON.stringify({
    [kind]: { client_id: 'client.apps.googleusercontent.com', client_secret: 'secret', redirect_uris: [redirect] },
  })

const meta = {
  title: 'Planner/Features/GoogleSyncDialog',
  component: GoogleSyncDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 720 } } },
  args: {
    open: true,
    status: fresh,
    // A fragment: saving the client goes on to it without leaving the story.
    connectUrl: '#google-connect',
    callbackPath: CALLBACK,
    ended: null,
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

/**
 * Nothing set up yet: each step opens its page of Google's console and gives the value to paste there. The client's
 * JSON pasted into the ID field fills both fields, and saving goes on to Google's sign-in.
 */
export const NotSetUp: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('link', { name: m.google_link_api() })).toBeVisible())
    await expect(body.getByRole('link', { name: m.google_link_api() })).toHaveAttribute(
      'href',
      'https://console.cloud.google.com/flows/enableapi?apiid=calendar-json.googleapis.com',
    )
    const callback = `${window.location.origin}${CALLBACK}`
    await expect(body.getByText(callback)).toBeVisible()
    await userEvent.click(body.getByLabelText(m.google_client_id()))
    await userEvent.paste(clientFile('web', callback))
    await expect(body.getByLabelText(m.google_client_id())).toHaveValue('client.apps.googleusercontent.com')
    await expect(body.queryByRole('alert')).toBeNull()
    await userEvent.click(body.getByRole('button', { name: m.google_save_connect() }))
    await expect(args.onSaveClient).toHaveBeenCalledWith('client.apps.googleusercontent.com', 'secret')
  },
}

/** A client file that would not work here says so before Google refuses the sign-in. */
export const WrongClientFile: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const input = await waitFor(() => body.getByLabelText(m.google_load_file()))
    await userEvent.upload(input, new File([clientFile('web', 'http://example.test/cb')], 'client.json'))
    await waitFor(() => expect(body.getByText(m.google_file_redirect())).toBeVisible())
    await userEvent.upload(input, new File([clientFile('installed', 'http://localhost')], 'client.json'))
    await waitFor(() => expect(body.getByText(m.google_file_desktop())).toBeVisible())
    await userEvent.upload(input, new File(['{}'], 'other.json'))
    await waitFor(() => expect(body.getByText(m.google_file_wrong())).toBeVisible())
  },
}

/** A client is saved: signing in to Google is one link away. */
export const ReadyToConnect: Story = {
  args: { status: { ...fresh, configured: true } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByRole('link', { name: m.google_connect() })).toHaveAttribute('href', '#google-connect')
    await expect(body.queryByLabelText(m.google_client_id())).toBeNull()
  },
}

/** The person cancelled on Google's page. */
export const SignInCancelled: Story = {
  args: { status: { ...fresh, configured: true }, ended: 'denied' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.google_denied())).toBeVisible())
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

/** The Calendar API is off in the client's project: the note links to the page that turns it on. */
export const ApiOff: Story = {
  args: { status: { ...connected, error: 'api-off' } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('link', { name: m.google_turn_on() })).toBeVisible())
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
