import type { Meta, StoryObj } from '@storybook/react-vite'

import { HelpToggle, Hint } from './hint'

const meta = {
  title: 'UI kit/Hint',
  component: Hint,
} satisfies Meta<typeof Hint>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Press the switch: a mark appears next to the heading, and a click on the mark opens its note. The switch is
 * shared by every page, so one press shows the marks everywhere.
 */
export const Default: Story = {
  args: { title: 'Weekly budget', text: 'Hours of study planned for the week.\nThe gym does not count.' },
  render: (args) => (
    <div className="flex items-center gap-3">
      <HelpToggle label="Explain this page" />
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        Budget
        <Hint {...args} />
      </h2>
    </div>
  ),
}
