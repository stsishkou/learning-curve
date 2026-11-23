import { m } from '@lc/i18n/messages'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import type { CalendarSyncStatus } from '../model/source'
import { CalendarSyncDialog } from './CalendarSyncDialog'

const fresh: CalendarSyncStatus = {
  provider: 'google',
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
const connected: CalendarSyncStatus = {
  ...fresh,
  configured: true,
  connectedAt: Date.UTC(2026, 10, 20, 9),
  calendars: 6,
  events: 148,
  lastRound: Date.UTC(2026, 10, 23, 10, 15),
}
const outlook: CalendarSyncStatus = { ...fresh, provider: 'outlook' }
const CALLBACK = '/api/google/callback'
/** The JSON Google offers when a client is made */
const clientFile = (kind: 'web' | 'installed', redirect: string) =>
  JSON.stringify({
    [kind]: { client_id: 'client.apps.googleusercontent.com', client_secret: 'secret', redirect_uris: [redirect] },
  })

const meta = {
  title: 'Planner/Features/CalendarSyncDialog',
  component: CalendarSyncDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 720 } } },
  args: {
    open: true,
    status: fresh,
    // A fragment: saving the client goes on to it without leaving the story.
    connectUrl: '#connect',
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
} satisfies Meta<typeof CalendarSyncDialog>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Google, nothing set up yet: each step opens its page of Google's console and gives the value to paste there. The
 * client's JSON pasted into the ID field fills both fields, and saving goes on to Google's sign-in.
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
    await userEvent.click(body.getByLabelText(m.sync_client_id()))
    await userEvent.paste(clientFile('web', callback))
    await expect(body.getByLabelText(m.sync_client_id())).toHaveValue('client.apps.googleusercontent.com')
    await expect(body.queryByRole('alert')).toBeNull()
    await userEvent.click(body.getByRole('button', { name: m.sync_save_connect() }))
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

/** Outlook, nothing set up yet: the steps go through Microsoft Entra, where the app is registered. */
export const OutlookNotSetUp: Story = {
  args: { status: outlook, callbackPath: '/api/outlook/callback' },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('link', { name: m.outlook_link_register() })).toBeVisible())
    await expect(body.getByText(`${window.location.origin}/api/outlook/callback`)).toBeVisible()
    await userEvent.type(body.getByLabelText(m.sync_client_id()), '00000000-0000-0000-0000-000000000000')
    await userEvent.type(body.getByLabelText(m.sync_client_secret()), 'secret')
    await userEvent.click(body.getByRole('button', { name: m.sync_save_connect() }))
    await expect(args.onSaveClient).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000000', 'secret')
  },
}

/** A client is saved: signing in to the app is one link away. */
export const ReadyToConnect: Story = {
  args: { status: { ...fresh, configured: true } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.getByRole('link', { name: m.sync_connect({ app: m.sync_app_google() }) })).toHaveAttribute(
      'href',
      '#connect',
    )
    await expect(body.queryByLabelText(m.sync_client_id())).toBeNull()
  },
}

/** The person cancelled on the app's sign-in page. */
export const SignInCancelled: Story = {
  args: { status: { ...outlook, configured: true }, ended: 'denied' },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.sync_denied({ app: m.sync_app_outlook() }))).toBeVisible())
  },
}

export const Connected: Story = {
  args: { status: connected },
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.sync_counts({ calendars: 6, events: 148 }))).toBeVisible())
    await userEvent.click(body.getByRole('button', { name: m.sync_sync_now() }))
    await expect(args.onSync).toHaveBeenCalled()
  },
}

/** The Calendar API is off in the Google client's project: the note links to the page that turns it on. */
export const ApiOff: Story = {
  args: { status: { ...connected, error: 'api-off' } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByRole('link', { name: m.google_turn_on() })).toBeVisible())
  },
}

/** A Microsoft account without an Outlook mailbox has no calendar to keep the plan in. */
export const NoMailbox: Story = {
  args: { status: { ...connected, provider: 'outlook', calendars: 0, events: 0, error: 'mailbox' } },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.outlook_problem_mailbox())).toBeVisible())
  },
}

/** The app ended the sign-in, as Google does every week for an app left in testing. */
export const SignInEnded: Story = {
  args: { status: { ...connected, connectedAt: null, error: 'reconnect' } },
  play: async ({ canvasElement }) => {
    const app = m.sync_app_google()
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.sync_reconnect({ app }))).toBeVisible())
    await expect(body.getByRole('link', { name: m.sync_connect({ app }) })).toBeVisible()
  },
}
