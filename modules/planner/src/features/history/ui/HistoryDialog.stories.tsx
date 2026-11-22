import type { HistoryView } from '@lc/plan-domain'
import { fixtureNow } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

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
  args: { open: true, history, mod: 'Ctrl', now: fixtureNow, onTravel: fn(async () => {}), onClose: fn() },
  argTypes: { history: { control: false } },
} satisfies Meta<typeof HistoryDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Three steps are applied and the last one was undone: it can be redone or replaced by a new change. */
export const OneStepBack: Story = {}

export const Empty: Story = { args: { history: { cursor: 0, steps: [] } } }
