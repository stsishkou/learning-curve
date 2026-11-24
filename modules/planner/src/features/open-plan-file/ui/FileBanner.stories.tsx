import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { FileBanner } from './FileBanner'

const meta = {
  title: 'Planner/Features/FileBanner',
  component: FileBanner,
  args: { name: 'plan-2026-11-22.json', changes: 0, onDownload: fn(), onClose: fn() },
} satisfies Meta<typeof FileBanner>

export default meta
type Story = StoryObj<typeof meta>

export const JustOpened: Story = {}

export const WithChanges: Story = { args: { changes: 4 } }
