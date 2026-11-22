import { fixturePlan } from '@lc/plan-domain/fixtures'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, fn, within } from 'storybook/test'

import { CommandPalette } from './CommandPalette'

const meta = {
  title: 'Planner/Features/CommandPalette',
  component: CommandPalette,
  parameters: { dialog: true, docs: { story: { inline: false, iframeHeight: 520 } } },
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

/** Two letters or more also search the events of the plan; Enter opens the first match. */
export const SearchingEvents: Story = {
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    // The dialog opens in an effect, after the first render: wait for it.
    const input = await body.findByRole('combobox')
    // Not `userEvent.type`: here it writes through the value tracker React keeps on the input, so React sees
    // no change and `onChange` never runs. `fireEvent.change` sets the value the way the browser does.
    await fireEvent.change(input, { target: { value: 'ADK' } })
    const [first] = await body.findAllByRole('option')
    await expect(first).toHaveTextContent('ADK')
    // Sent to the input itself: on a docs page the story sits in a frame that may not have the focus.
    await fireEvent.keyDown(input, { key: 'Enter' })
    await expect(args.onSelectEvent).toHaveBeenCalledWith(expect.objectContaining({ calendar: 'certs' }))
  },
}
