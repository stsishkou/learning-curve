import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CommandPalette } from './CommandPalette'

const meta = {
  title: 'Planner/Features/CommandPalette',
  component: CommandPalette,
  parameters: { docs: { story: { inline: false, iframeHeight: 520 } } },
  args: {
    open: true,
    plan: fixturePlan,
    commands: [
      { id: 'today', group: 'Go to', label: 'Today', keys: 'T', run: fn() },
      { id: 'next', group: 'Go to', label: 'Next week', keys: '→', run: fn() },
      { id: 'week', group: 'View', label: 'Week', keys: 'W', run: fn() },
      { id: 'month', group: 'View', label: 'Month', keys: 'M', run: fn() },
      { id: 'theme-dark', group: 'Theme', label: 'Dark', run: fn() },
    ],
    onSelectEvent: fn(),
    onClose: fn(),
  },
  argTypes: { plan: { control: false } },
} satisfies Meta<typeof CommandPalette>

export default meta
type Story = StoryObj<typeof meta>

/** Type two letters or more to search the events of the plan as well, for example `ADK`. */
export const Commands: Story = {}
