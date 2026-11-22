import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Button } from './button'

const meta = {
  title: 'UI kit/Button',
  component: Button,
  args: { children: 'Save', onClick: fn() },
  argTypes: { className: { control: 'text' } },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Primary: Story = { args: { primary: true } }

export const Disabled: Story = { args: { disabled: true } }

export const Sizes: Story = {
  name: 'With utility classes',
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      <Button {...args} />
      <Button {...args} className="px-2.5 py-1 text-[13px]" />
      <Button {...args} primary className="px-2.5 py-1 text-[13px]" />
    </div>
  ),
}
