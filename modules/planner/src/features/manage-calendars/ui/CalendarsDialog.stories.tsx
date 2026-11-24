import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CalendarsDialog } from './CalendarsDialog'

const meta = {
  title: 'Planner/Features/CalendarsDialog',
  component: CalendarsDialog,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 640 } } },
  args: {
    open: true,
    plan: fixturePlan,
    onChange: fn(async () => {}),
    undo: null,
    trashCount: 0,
    onOpenTrash: fn(),
    onClose: fn(),
  },
  argTypes: { plan: { control: false }, undo: { control: false } },
} satisfies Meta<typeof CalendarsDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** After a removal: the last change can be taken back from inside the dialog, and the trash shows its count. */
export const WithUndoAndTrash: Story = {
  args: { undo: { label: 'AI Journey moved to the trash', run: fn(async () => {}) }, trashCount: 3 },
}

/** The host rejects every change: rename a calendar to see the reason in the dialog. */
export const SaveFails: Story = {
  args: { onChange: fn(async () => Promise.reject(new Error('The plan is read-only on this host'))) },
}
