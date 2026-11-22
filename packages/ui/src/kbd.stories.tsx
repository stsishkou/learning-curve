import type { Meta, StoryObj } from '@storybook/react-vite'

import { Kbd } from './kbd'

const meta = {
  title: 'UI kit/Kbd',
  component: Kbd,
  parameters: {
    docs: { description: { component: 'A key or a key combination, as shown in the shortcuts list.' } },
  },
  args: { children: '⌘ K' },
} satisfies Meta<typeof Kbd>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InText: Story = {
  render: () => (
    <p className="text-[14px]">
      Press <Kbd>?</Kbd> for the list of shortcuts, <Kbd>Alt ← →</Kbd> to move an event.
    </p>
  ),
}
