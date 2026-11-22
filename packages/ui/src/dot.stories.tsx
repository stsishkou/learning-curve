import type { Meta, StoryObj } from '@storybook/react-vite'

import { calendarColor } from './calendar-color'
import { Dot } from './dot'

const meta = {
  title: 'UI kit/Dot',
  component: Dot,
  args: { className: 'size-2.5' },
  argTypes: { className: { control: 'text' } },
  decorators: [
    (Story) => (
      <span className="inline-flex items-center gap-2" style={calendarColor('#2F5BEA')}>
        <Story />
        Gemini Certs
      </span>
    ),
  ],
} satisfies Meta<typeof Dot>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Large: Story = { args: { className: 'size-4' } }
