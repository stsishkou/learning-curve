import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ShortcutsDialog } from './ShortcutsDialog'

const meta = {
  title: 'Planner/Features/ShortcutsDialog',
  component: ShortcutsDialog,
  parameters: {
    dialog: true,
    docs: {
      description: {
        component:
          'The list of keyboard shortcuts. The page builds `rows` from the same actions it registers with `useShortcuts`, so the list cannot drift from what the keys do.',
      },
      story: { inline: false, iframeHeight: 460 },
    },
  },
  args: {
    open: true,
    rows: [
      { keys: '⌘ K', label: 'Search' },
      { keys: 'T', label: 'Today' },
      { keys: '←', label: 'Previous week' },
      { keys: '→', label: 'Next week' },
      { keys: 'W', label: 'Week' },
      { keys: 'M', label: 'Month' },
      { keys: 'L', label: 'List' },
      { keys: 'N', label: 'New event' },
      { keys: 'Alt ← ↑ ↓ →', label: 'Move the focused event' },
      { keys: 'Delete', label: 'Remove the focused event' },
    ],
    onClose: fn(),
  },
} satisfies Meta<typeof ShortcutsDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
