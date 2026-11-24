import { fmtHours } from '@lc/i18n/format'
import { m } from '@lc/i18n/messages'
import type { HistoryView } from '@lc/plan-domain'
import { fixtureNow } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { HistoryDialog } from './HistoryDialog'

const history: HistoryView = {
  cursor: 3,
  steps: [
    {
      at: '2026-12-01T08:10:00Z',
      subject: 'GE Agent Dev — ADK',
      change: { type: 'event.patch', uid: 'a', patch: { start: '2026-12-01T13:00', end: '2026-12-01T14:00' } },
    },
    {
      at: '2026-12-02T07:30:00Z',
      subject: 'English',
      change: { type: 'calendar.save', name: 'English', color: '#00897b' },
    },
    {
      at: '2026-12-02T08:05:00Z',
      subject: 'GE Agent Dev — MCP',
      change: { type: 'event.patch', uid: 'b', patch: { done: true } },
    },
    { at: '2026-12-02T09:20:00Z', subject: 'Buffer', change: { type: 'event.remove', uid: 'c' } },
  ],
}

const meta = {
  title: 'Planner/Features/HistoryDialog',
  component: HistoryDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 520 } } },
  args: {
    open: true,
    history,
    mod: 'Ctrl',
    now: fixtureNow,
    onTravel: fn(async () => {}),
    onTrim: fn(async () => {}),
    onClose: fn(),
  },
  argTypes: { history: { control: false } },
} satisfies Meta<typeof HistoryDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Four steps are stored, three are applied and the last one was undone: it can be redone or replaced by a new change. */
export const OneStepBack: Story = {}

export const Empty: Story = { args: { history: { cursor: 0, steps: [] } } }

/**
 * A shift by a day and back an hour, a shift of every calendar by half an hour, and a re-balance: each says how far
 * and which calendar.
 */
export const ShiftsAndRebalance: Story = {
  args: {
    history: {
      cursor: 3,
      steps: [
        {
          at: '2026-12-03T08:00:00Z',
          subject: 'Gemini Certs',
          change: { type: 'events.shift', calendar: 'certs', from: '2026-12-03', days: 1, hours: -1 },
        },
        { at: '2026-12-03T08:10:00Z', subject: '', change: { type: 'events.shift', from: '2026-12-03', hours: 0.5 } },
        {
          at: '2026-12-03T08:20:00Z',
          subject: 'Gemini Certs',
          change: {
            type: 'events.move',
            moves: [{ uid: 'a', start: '2026-12-04T13:00', end: '2026-12-04T14:00' }],
            reason: 'rebalance',
            calendar: 'certs',
          },
        },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const amount = `+${m.duration_d({ count: 1 })} −${fmtHours(1)}`
    await waitFor(() => expect(body.getByText(m.history_shifted({ amount, name: 'Gemini Certs' }))).toBeVisible())
    await expect(body.getByText(m.history_shifted({ amount: `+${fmtHours(0.5)}`, name: m.shift_all() }))).toBeVisible()
    await expect(body.getByText(m.history_rebalanced({ name: 'Gemini Certs' }))).toBeVisible()
  },
}

/**
 * Clearing keeps the ends of the history: the first change and the current one. It asks first, since the changes
 * between them can no longer be picked one by one.
 */
export const ClearKeepsTheEnds: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const clear = await body.findByRole('button', { name: m.history_trim() })
    await waitFor(() => expect(clear).toBeVisible())
    await userEvent.click(clear)
    await waitFor(() => expect(body.getByText(m.history_trim_confirm())).toBeVisible())
    await expect(args.onTrim).not.toHaveBeenCalled()
    await userEvent.click(body.getByRole('button', { name: m.history_trim_now() }))
    await expect(args.onTrim).toHaveBeenCalledOnce()
    await waitFor(() => expect(body.queryByText(m.history_trim_confirm())).toBeNull())
  },
}

/** After a clear the current change says how many it took in: undoing it takes them back too. */
export const Cleared: Story = {
  args: {
    history: {
      cursor: 2,
      steps: [
        {
          at: '2026-12-01T08:10:00Z',
          subject: 'GE Agent Dev — ADK',
          change: { type: 'event.patch', uid: 'a', patch: { start: '2026-12-01T13:00', end: '2026-12-01T14:00' } },
        },
        { at: '2026-12-02T09:20:00Z', subject: 'Buffer', change: { type: 'event.remove', uid: 'c' }, folded: 37 },
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText(m.history_folded({ count: 37 }))).toBeVisible())
    await expect(body.queryByRole('button', { name: m.history_trim() })).toBeNull()
  },
}

/** A long history scrolls under the buttons, which stay at the bottom of the dialog. */
export const LongHistoryKeepsItsButtons: Story = {
  args: {
    history: {
      cursor: 60,
      steps: Array.from({ length: 60 }, (_, i) => ({
        at: `2026-12-02T08:${String(i % 60).padStart(2, '0')}:00Z`,
        subject: `Session ${i + 1}`,
        change: { type: 'event.patch', uid: `s${i}`, patch: { done: true } },
      })),
    },
  },
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole('dialog')
    const close = body.getByRole('button', { name: m.close() })
    await expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight)
    const box = dialog.getBoundingClientRect()
    await expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom)
    dialog.scrollTop = dialog.scrollHeight / 2
    await waitFor(() => expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(box.bottom))
  },
}
