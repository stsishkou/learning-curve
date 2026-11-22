import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

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

export const Commands: Story = {}

export const SearchingEvents: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    // The dialog opens in an effect, after the first render: wait for it.
    await userEvent.type(await body.findByRole('combobox'), 'ADK')
    const found = await body.findAllByRole('option')
    await expect(found.length).toBeGreaterThan(0)
    await userEvent.keyboard('{Enter}')
    await expect(args.onSelectEvent).toHaveBeenCalled()
  },
}
