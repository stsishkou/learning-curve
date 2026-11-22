import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ShiftDialog } from './ShiftDialog'

const meta = {
  title: 'Planner/Features/ShiftDialog',
  component: ShiftDialog,
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
  args: {
    plan: fixturePlan,
    from: fixturePlan.events[0].start.slice(0, 10),
    onChange: fn(async () => {}),
    onClose: fn(),
  },
} satisfies Meta<typeof ShiftDialog>

export default meta
type Story = StoryObj<typeof meta>

/** Every session from the chosen day that is not done yet moves by the same number of days. */
export const Default: Story = {}

/** The host rejects the change: the reason is shown and the dialog stays open. */
export const SaveFails: Story = {
  args: { onChange: fn(async () => Promise.reject(new Error('The plan file is read-only'))) },
}
